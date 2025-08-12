import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getQueue } from '../../utils/queue.js';
import { getDatabase } from '../../utils/database.js';
import { getStorage } from '../../utils/storage.js';
import { AuditRequest, AuditRun, AuditResult } from '../../types/index.js';

// 요청 스키마
const AuditRequestSchema = z.object({
  url: z.string().url().refine(url => {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  }, 'URL must be HTTP or HTTPS')
});

// 응답 스키마
const AuditRunSchema = z.object({
  runId: z.string().uuid(),
  url: z.string().url(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  startedAt: z.string().datetime(),
  message: z.string().optional()
});

export async function auditRoutes(fastify: FastifyInstance) {
  const queue = await getQueue();
  const db = await getDatabase();
  const storage = await getStorage();

  /**
   * POST /api/audit - 새로운 감사 시작
   */
  fastify.post<{
    Body: AuditRequest
  }>('/', {
    schema: {
      body: AuditRequestSchema,
      response: {
        202: AuditRunSchema,
        400: z.object({
          error: z.boolean(),
          message: z.string()
        }),
        429: z.object({
          error: z.boolean(),
          message: z.string()
        })
      }
    }
  }, async (request: FastifyRequest<{ Body: AuditRequest }>, reply: FastifyReply) => {
    const { url } = request.body;

    try {
      // URL 유효성 검사
      const validatedUrl = new URL(url);
      
      // 동시 실행 제한 체크
      const activeJobs = await queue.getActiveCount();
      const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_AUDITS || '5', 10);
      
      if (activeJobs >= maxConcurrent) {
        return reply.status(429).send({
          error: true,
          message: `Too many concurrent audits. Please try again later. (Active: ${activeJobs}/${maxConcurrent})`
        });
      }

      // 새 실행 생성
      const runId = uuidv4();
      const run: AuditRun = {
        runId,
        url: validatedUrl.href,
        status: 'pending',
        startedAt: new Date()
      };

      // DB에 저장
      await db.createRun(run);

      // 큐에 작업 추가
      await queue.add('audit', {
        runId,
        url: validatedUrl.href
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: {
          age: 24 * 3600, // 24시간
          count: 100
        },
        removeOnFail: {
          age: 7 * 24 * 3600 // 7일
        }
      });

      fastify.log.info({ runId, url }, 'Audit job queued');

      // 202 Accepted 응답
      return reply.status(202).send({
        runId,
        url: validatedUrl.href,
        status: 'pending',
        startedAt: run.startedAt.toISOString(),
        message: 'Audit has been queued and will start processing shortly'
      });

    } catch (error) {
      fastify.log.error({ error, url }, 'Failed to queue audit');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: true,
          message: 'Invalid request: ' + error.errors.map(e => e.message).join(', ')
        });
      }

      throw error;
    }
  });

  /**
   * GET /api/audit/:runId - 감사 상태 조회
   */
  fastify.get<{
    Params: { runId: string }
  }>('/:runId', {
    schema: {
      params: z.object({
        runId: z.string().uuid()
      }),
      response: {
        200: z.any(), // AuditResult는 너무 복잡해서 any 사용
        404: z.object({
          error: z.boolean(),
          message: z.string()
        })
      }
    }
  }, async (request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;

    try {
      // DB에서 조회
      const result = await db.getRun(runId);

      if (!result) {
        return reply.status(404).send({
          error: true,
          message: 'Audit run not found'
        });
      }

      // 진행 중인 경우 큐 상태 확인
      if (result.status === 'pending' || result.status === 'processing') {
        const job = await queue.getJob(runId);
        
        if (job) {
          const progress = job.progress();
          
          return reply.send({
            ...result,
            progress,
            position: await job.getPosition(),
            estimatedTimeRemaining: await job.getEstimatedTime()
          });
        }
      }

      // 완료된 경우 전체 결과 반환
      if (result.status === 'completed') {
        const fullResult = await db.getFullResult(runId);
        return reply.send(fullResult);
      }

      // 실패한 경우
      return reply.send(result);

    } catch (error) {
      fastify.log.error({ error, runId }, 'Failed to get audit status');
      throw error;
    }
  });

  /**
   * GET /api/audit/:runId/report.pdf - PDF 리포트 다운로드
   */
  fastify.get<{
    Params: { runId: string }
  }>('/:runId/report.pdf', async (request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;

    try {
      const result = await db.getRun(runId);

      if (!result || result.status !== 'completed') {
        return reply.status(404).send({
          error: true,
          message: 'Report not found or not ready'
        });
      }

      // S3에서 PDF 가져오기
      const pdfPath = `reports/${runId}/report.pdf`;
      const pdfBuffer = await storage.get(pdfPath);

      if (!pdfBuffer) {
        return reply.status(404).send({
          error: true,
          message: 'PDF report not found'
        });
      }

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="mall-analysis-${runId}.pdf"`);
      return reply.send(pdfBuffer);

    } catch (error) {
      fastify.log.error({ error, runId }, 'Failed to get PDF report');
      throw error;
    }
  });

  /**
   * GET /api/audit/:runId/artifacts.zip - 전체 아티팩트 다운로드
   */
  fastify.get<{
    Params: { runId: string }
  }>('/:runId/artifacts.zip', async (request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;

    try {
      const result = await db.getRun(runId);

      if (!result || result.status !== 'completed') {
        return reply.status(404).send({
          error: true,
          message: 'Artifacts not found or not ready'
        });
      }

      // S3에서 ZIP 가져오기
      const zipPath = `reports/${runId}/artifacts.zip`;
      const zipBuffer = await storage.get(zipPath);

      if (!zipBuffer) {
        return reply.status(404).send({
          error: true,
          message: 'Artifacts ZIP not found'
        });
      }

      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="mall-analysis-${runId}-artifacts.zip"`);
      return reply.send(zipBuffer);

    } catch (error) {
      fastify.log.error({ error, runId }, 'Failed to get artifacts ZIP');
      throw error;
    }
  });

  /**
   * GET /api/audit/list - 최근 감사 목록
   */
  fastify.get('/list', {
    schema: {
      querystring: z.object({
        limit: z.coerce.number().min(1).max(100).default(10),
        offset: z.coerce.number().min(0).default(0),
        status: z.enum(['pending', 'processing', 'completed', 'failed']).optional()
      })
    }
  }, async (request: FastifyRequest<{
    Querystring: { limit?: number; offset?: number; status?: string }
  }>, reply: FastifyReply) => {
    const { limit = 10, offset = 0, status } = request.query;

    try {
      const runs = await db.listRuns({ limit, offset, status });
      const total = await db.countRuns({ status });

      return reply.send({
        runs,
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      });

    } catch (error) {
      fastify.log.error({ error }, 'Failed to list audit runs');
      throw error;
    }
  });

  /**
   * DELETE /api/audit/:runId - 감사 삭제
   */
  fastify.delete<{
    Params: { runId: string }
  }>('/:runId', {
    schema: {
      params: z.object({
        runId: z.string().uuid()
      })
    }
  }, async (request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;

    try {
      const result = await db.getRun(runId);

      if (!result) {
        return reply.status(404).send({
          error: true,
          message: 'Audit run not found'
        });
      }

      // 진행 중인 작업 취소
      if (result.status === 'pending' || result.status === 'processing') {
        const job = await queue.getJob(runId);
        if (job) {
          await job.remove();
        }
      }

      // S3에서 파일 삭제
      if (result.status === 'completed') {
        await storage.deletePrefix(`reports/${runId}/`);
      }

      // DB에서 삭제
      await db.deleteRun(runId);

      return reply.send({
        success: true,
        message: 'Audit run deleted successfully'
      });

    } catch (error) {
      fastify.log.error({ error, runId }, 'Failed to delete audit run');
      throw error;
    }
  });
}