import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { getQueue } from '../../utils/queue.js';
import { getDatabase } from '../../utils/database.js';
import { getStorage } from '../../utils/storage.js';
import { AuditRequest, AuditRun } from '../../types/index.js';

// 요청 스키마 (JSON Schema)
const AuditRequestSchema = {
  type: 'object',
  required: ['url'],
  properties: {
    url: { 
      type: 'string', 
      format: 'uri',
      pattern: '^https?://'
    }
  }
};

// 응답 스키마 (JSON Schema)
const AuditRunSchema = {
  type: 'object',
  properties: {
    runId: { type: 'string', format: 'uuid' },
    url: { type: 'string', format: 'uri' },
    status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
    startedAt: { type: 'string', format: 'date-time' },
    message: { type: 'string' }
  }
};

const ErrorSchema = {
  type: 'object',
  properties: {
    error: { type: 'boolean' },
    message: { type: 'string' }
  }
};

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
        400: ErrorSchema,
        429: ErrorSchema
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
      
      if (error instanceof Error && error.message.includes('validation')) {
        return reply.status(400).send({
          error: true,
          message: 'Invalid request: ' + error.message
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
      params: {
        type: 'object',
        required: ['runId'],
        properties: {
          runId: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: { 
          type: 'object',
          additionalProperties: true  // Allow any properties
        },
        404: ErrorSchema
      }
    }
  }, async (request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;

    try {
      // DB에서 조회
      const result = await db.getRun(runId);
      
      fastify.log.info({ runId, status: result?.status }, 'Fetched run from DB');

      if (!result) {
        return reply.status(404).send({
          error: true,
          message: 'Audit run not found'
        });
      }

      // Date 객체를 ISO 문자열로 변환
      const serializedResult = {
        runId: result.runId,
        url: result.url,
        status: result.status,
        startedAt: result.startedAt instanceof Date ? result.startedAt.toISOString() : result.startedAt,
        elapsedMs: result.elapsedMs,
        totalScore: result.totalScore,
        error: result.error,
        screenshots: result.screenshots
      };

      // 진행 중인 경우 큐 상태 확인
      if (result.status === 'pending' || result.status === 'processing') {
        const job = await queue.getJob(runId);
        console.log(`[API] Job found: ${!!job}, status: ${result.status}`);
        
        if (job) {
          // BullMQ's progress is stored as an object or number
          const progressData = job.progress;
          const progress = typeof progressData === 'number' ? progressData : (progressData?.value || 0);
          console.log(`[API] Progress data:`, progressData);
          
          const response = {
            ...serializedResult,
            progress,
            progressMessage: progressData?.message || undefined
          };
          console.log(`[API] Sending response:`, JSON.stringify(response).substring(0, 100));
          return reply.send(response);
        }
        // job이 없어도 result는 반환
        console.log(`[API] No job found, returning basic result`);
        return reply.send(serializedResult);
      }

      // 완료된 경우 전체 결과 반환
      if (result.status === 'completed') {
        const fullResult = await db.getFullResult(runId);
        fastify.log.info({ runId, fullResult: !!fullResult }, 'Getting full result');
        
        if (fullResult) {
          // Date 객체를 ISO 문자열로 변환
          const serializedFullResult = {
            ...fullResult,
            startedAt: fullResult.startedAt instanceof Date ? fullResult.startedAt.toISOString() : fullResult.startedAt
          };
          fastify.log.info({ runId }, 'Sending serialized result');
          return reply.send(serializedFullResult);
        } else {
          fastify.log.warn({ runId }, 'Full result not found, sending basic result');
          return reply.send(serializedResult);
        }
      }

      // 실패한 경우 또는 기타 상태
      fastify.log.info({ runId, status: result.status }, 'Returning basic result');
      return reply.send(serializedResult);

    } catch (error) {
      fastify.log.error({ error, runId }, 'Failed to get audit status');
      throw error;
    }
  });

  /**
   * GET /api/audit/:runId/stream - SSE로 실시간 상태 업데이트
   */
  fastify.get<{
    Params: { runId: string }
  }>('/:runId/stream', async (request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;
    
    // SSE 헤더 설정
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // nginx 버퍼링 비활성화
    });

    // 클라이언트 연결 확인
    const sendEvent = (data: any) => {
      if (!reply.raw.destroyed) {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    // 초기 상태 전송
    try {
      const initialResult = await db.getRun(runId);
      if (initialResult) {
        const job = await queue.getJob(runId);
        const progressData = job ? await job.progress : 0;
        const progress = typeof progressData === 'number' ? progressData : (progressData?.value || 0);
        
        sendEvent({
          runId,
          url: initialResult.url,
          status: initialResult.status,
          startedAt: initialResult.startedAt,
          progress
        });
      }
    } catch (error) {
      fastify.log.error({ error, runId }, 'Failed to get initial status');
    }

    // 주기적으로 상태 업데이트 전송 (2초마다)
    const interval = setInterval(async () => {
      try {
        const result = await db.getRun(runId);
        
        if (!result) {
          clearInterval(interval);
          reply.raw.end();
          return;
        }

        // 진행 중인 경우 progress 정보 포함
        if (result.status === 'pending' || result.status === 'processing') {
          const job = await queue.getJob(runId);
          const progressData = job ? await job.progress : 0;
          const progress = typeof progressData === 'number' ? progressData : (progressData?.value || 0);
          
          sendEvent({
            runId,
            url: result.url,
            status: result.status,
            startedAt: result.startedAt,
            progress
          });
        } 
        // 완료된 경우 전체 결과 전송 후 연결 종료
        else if (result.status === 'completed') {
          const fullResult = await db.getFullResult(runId);
          sendEvent(fullResult || result);
          clearInterval(interval);
          reply.raw.end();
        }
        // 실패한 경우 연결 종료
        else if (result.status === 'failed') {
          sendEvent(result);
          clearInterval(interval);
          reply.raw.end();
        }
      } catch (error) {
        fastify.log.error({ error, runId }, 'Error in SSE stream');
        clearInterval(interval);
        reply.raw.end();
      }
    }, 2000);

    // 클라이언트 연결 종료 시 정리
    request.raw.on('close', () => {
      clearInterval(interval);
      reply.raw.end();
    });
  });

  /**
   * GET /api/audit/:runId/download/pdf - PDF 리포트 다운로드
   */
  fastify.get<{
    Params: { runId: string }
  }>('/:runId/download/pdf', async (request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = request.params;

    try {
      // DB에서 결과 조회
      const fullResult = await db.getFullResult(runId);
      
      if (!fullResult) {
        return reply.status(404).send({
          error: true,
          message: 'Audit result not found'
        });
      }

      if (fullResult.status !== 'completed') {
        return reply.status(400).send({
          error: true,
          message: 'Audit is not completed yet'
        });
      }

      // PDF 생성
      const { Reporter } = await import('../../lib/reporter.js');
      const reporter = new Reporter();
      const { pdf } = await reporter.generateReport(fullResult, {
        format: 'pdf',
        includeScreenshots: true
      });

      if (!pdf) {
        return reply.status(500).send({
          error: true,
          message: 'Failed to generate PDF'
        });
      }

      // PDF 응답
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="mall-analysis-${runId}.pdf"`)
        .send(pdf);

    } catch (error) {
      fastify.log.error({ error, runId }, 'Failed to generate PDF');
      return reply.status(500).send({
        error: true,
        message: 'Failed to generate PDF report'
      });
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
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: { limit?: number; offset?: number; status?: string }
  }>, reply: FastifyReply) => {
    const { limit = 10, offset = 0, status } = request.query;

    try {
      const runs = await db.listRuns({ limit, offset, status });
      const total = await db.countRuns({ status });

      // Date 객체를 ISO 문자열로 변환
      const serializedRuns = runs.map(run => ({
        ...run,
        startedAt: run.startedAt instanceof Date ? run.startedAt.toISOString() : run.startedAt
      }));

      return reply.send({
        runs: serializedRuns,
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
      params: {
        type: 'object',
        required: ['runId'],
        properties: {
          runId: { type: 'string', format: 'uuid' }
        }
      }
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