import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { AuditJobData, getQueue } from '../utils/queue.js';
import { getDatabase } from '../utils/database.js';
// import { getStorage } from '../utils/storage.js';
import { runAudit } from './job-runner.js';

let worker: Worker<AuditJobData> | null = null;

export async function startWorker() {
  console.log('🚀 Starting audit worker...');

  const queue = await getQueue();
  const _db = await getDatabase();

  // BullMQ Worker 또는 InMemory 리스너
  if ('getQueue' in queue && typeof queue.getQueue === 'function') {
    // BullMQ Worker
    const connection = (queue as any).connection;
    
    worker = new Worker<AuditJobData>(
      'audit-queue',
      async (job: Job<AuditJobData>) => {
        return await processJob(job);
      },
      {
        connection,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
        autorun: true,
        lockDuration: 600000, // 10분 lock duration
        stalledInterval: 600000, // 10분 stalled check
        maxStalledCount: 0 // stalled 무시
      }
    );

    worker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err);
    });

    worker.on('error', (err) => {
      console.error('Worker error:', err);
    });

    console.log('✅ BullMQ worker started');
  } else {
    // InMemory Queue 리스너
    const memQueue = queue as any;
    
    memQueue.on('job-ready', async (job: any) => {
      console.log(`📋 Processing job ${job.id}...`);
      try {
        await processJob(job);
        console.log(`✅ Job ${job.id} completed`);
      } catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error);
      }
    });

    console.log('✅ In-memory worker started');
  }
}

async function processJob(job: Job<AuditJobData> | any): Promise<any> {
  const { runId, url } = job.data || job;
  const db = await getDatabase();
  
  console.log(`🔍 Starting audit for ${url} (${runId})`);

  try {
    // 상태를 processing으로 업데이트
    await db.updateRun(runId, { status: 'processing' });

    // 진행률 업데이트 함수
    const updateProgress = async (progress: number, message?: string) => {
      if (job.updateProgress) {
        // Update progress with message for better UI feedback
        await job.updateProgress({ value: progress, message });
      }
      console.log(`📊 Progress [${runId}]: ${progress}% ${message || ''}`);
    };

    // 감사 실행
    const result = await runAudit(url, runId, updateProgress);

    // 결과 저장
    await db.updateRun(runId, {
      status: 'completed',
      elapsedMs: result.elapsedMs,
      totalScore: result.totalScore,
      screenshots: result.screenshots
    });

    // 체크 결과 저장
    for (const check of result.checks) {
      await db.saveCheckResult(runId, check);
    }

    // 구매 플로우 저장
    if (result.purchaseFlow?.steps) {
      for (let i = 0; i < result.purchaseFlow.steps.length; i++) {
        await db.saveFlowStep(runId, i, result.purchaseFlow.steps[i]);
      }
    }

    console.log(`✅ Audit completed for ${url} - Score: ${result.totalScore}/100`);
    
    return result;

  } catch (error) {
    console.error(`❌ Audit failed for ${url}:`, error);
    
    await db.updateRun(runId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    throw error;
  }
}

export async function stopWorker() {
  if (worker) {
    console.log('Stopping worker...');
    await worker.close();
    worker = null;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down worker...');
  await stopWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down worker...');
  await stopWorker();
  process.exit(0);
});

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch(err => {
    console.error('Failed to start worker:', err);
    process.exit(1);
  });
}