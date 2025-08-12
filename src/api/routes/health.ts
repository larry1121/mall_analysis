import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../../utils/database.js';
import { getQueue } from '../../utils/queue.js';
import { getStorage } from '../../utils/storage.js';

const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  uptime: z.number(),
  checks: z.object({
    database: z.object({
      status: z.enum(['ok', 'error']),
      message: z.string().optional()
    }),
    queue: z.object({
      status: z.enum(['ok', 'error']),
      active: z.number().optional(),
      waiting: z.number().optional(),
      message: z.string().optional()
    }),
    storage: z.object({
      status: z.enum(['ok', 'error']),
      message: z.string().optional()
    }),
    memory: z.object({
      used: z.number(),
      total: z.number(),
      percentage: z.number()
    })
  })
});

export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/health - 시스템 상태 확인
   */
  fastify.get('/', {
    schema: {
      response: {
        200: HealthResponseSchema,
        503: HealthResponseSchema
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now();
    const checks: any = {
      database: { status: 'error' },
      queue: { status: 'error' },
      storage: { status: 'error' },
      memory: {
        used: 0,
        total: 0,
        percentage: 0
      }
    };

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // 데이터베이스 체크
    try {
      const db = await getDatabase();
      await db.ping();
      checks.database.status = 'ok';
    } catch (error) {
      checks.database.status = 'error';
      checks.database.message = error instanceof Error ? error.message : 'Database connection failed';
      overallStatus = 'unhealthy';
      fastify.log.error({ error }, 'Database health check failed');
    }

    // 큐 체크
    try {
      const queue = await getQueue();
      const counts = await queue.getJobCounts();
      checks.queue.status = 'ok';
      checks.queue.active = counts.active;
      checks.queue.waiting = counts.waiting;
      
      // 큐가 막혀있는지 확인
      if (counts.waiting > 100) {
        checks.queue.message = 'High queue backlog';
        if (overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      }
    } catch (error) {
      checks.queue.status = 'error';
      checks.queue.message = error instanceof Error ? error.message : 'Queue connection failed';
      overallStatus = 'unhealthy';
      fastify.log.error({ error }, 'Queue health check failed');
    }

    // 스토리지 체크
    try {
      const storage = await getStorage();
      await storage.ping();
      checks.storage.status = 'ok';
    } catch (error) {
      checks.storage.status = 'error';
      checks.storage.message = error instanceof Error ? error.message : 'Storage connection failed';
      if (overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
      fastify.log.error({ error }, 'Storage health check failed');
    }

    // 메모리 체크
    const memoryUsage = process.memoryUsage();
    const totalMemory = process.memoryUsage.rss ? memoryUsage.rss : 0;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercentage = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0;

    checks.memory = {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: Math.round(memoryPercentage)
    };

    // 메모리 사용량이 너무 높으면 degraded
    if (memoryPercentage > 90) {
      if (overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks
    };

    // 응답 시간 체크
    const responseTime = Date.now() - startTime;
    if (responseTime > 5000) {
      overallStatus = 'degraded';
      fastify.log.warn({ responseTime }, 'Slow health check response');
    }

    // 상태에 따라 HTTP 상태 코드 설정
    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
    
    return reply.status(statusCode).send(response);
  });

  /**
   * GET /api/health/live - Kubernetes liveness probe
   */
  fastify.get('/live', async (request, reply) => {
    // 프로세스가 살아있으면 OK
    return reply.send({ status: 'ok' });
  });

  /**
   * GET /api/health/ready - Kubernetes readiness probe
   */
  fastify.get('/ready', async (request, reply) => {
    try {
      // 주요 서비스들이 준비되었는지 확인
      const db = await getDatabase();
      await db.ping();
      
      const queue = await getQueue();
      const counts = await queue.getJobCounts();
      
      // 큐가 너무 막혀있으면 not ready
      if (counts.waiting > 200) {
        return reply.status(503).send({ 
          status: 'not ready', 
          reason: 'Queue backlog too high' 
        });
      }

      return reply.send({ status: 'ready' });
    } catch (error) {
      fastify.log.error({ error }, 'Readiness check failed');
      return reply.status(503).send({ 
        status: 'not ready',
        reason: error instanceof Error ? error.message : 'Service not ready'
      });
    }
  });

  /**
   * GET /api/health/metrics - Prometheus metrics
   */
  fastify.get('/metrics', async (request, reply) => {
    try {
      const queue = await getQueue();
      const counts = await queue.getJobCounts();
      const memoryUsage = process.memoryUsage();

      // Prometheus 형식으로 메트릭 생성
      const metrics = [
        '# HELP mall_analysis_queue_active_jobs Number of active jobs in the queue',
        '# TYPE mall_analysis_queue_active_jobs gauge',
        `mall_analysis_queue_active_jobs ${counts.active}`,
        '',
        '# HELP mall_analysis_queue_waiting_jobs Number of waiting jobs in the queue',
        '# TYPE mall_analysis_queue_waiting_jobs gauge',
        `mall_analysis_queue_waiting_jobs ${counts.waiting}`,
        '',
        '# HELP mall_analysis_queue_completed_jobs Number of completed jobs in the queue',
        '# TYPE mall_analysis_queue_completed_jobs gauge',
        `mall_analysis_queue_completed_jobs ${counts.completed}`,
        '',
        '# HELP mall_analysis_queue_failed_jobs Number of failed jobs in the queue',
        '# TYPE mall_analysis_queue_failed_jobs gauge',
        `mall_analysis_queue_failed_jobs ${counts.failed}`,
        '',
        '# HELP mall_analysis_memory_heap_used_bytes Heap memory used in bytes',
        '# TYPE mall_analysis_memory_heap_used_bytes gauge',
        `mall_analysis_memory_heap_used_bytes ${memoryUsage.heapUsed}`,
        '',
        '# HELP mall_analysis_memory_heap_total_bytes Total heap memory in bytes',
        '# TYPE mall_analysis_memory_heap_total_bytes gauge',
        `mall_analysis_memory_heap_total_bytes ${memoryUsage.heapTotal}`,
        '',
        '# HELP mall_analysis_uptime_seconds Process uptime in seconds',
        '# TYPE mall_analysis_uptime_seconds counter',
        `mall_analysis_uptime_seconds ${Math.floor(process.uptime())}`,
      ];

      reply.header('Content-Type', 'text/plain; version=0.0.4');
      return reply.send(metrics.join('\n'));
    } catch (error) {
      fastify.log.error({ error }, 'Failed to generate metrics');
      throw error;
    }
  });
}