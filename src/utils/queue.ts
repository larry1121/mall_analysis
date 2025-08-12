import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

export interface AuditJobData {
  runId: string;
  url: string;
}

export interface QueueCounts {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

class QueueManager {
  private queue: Queue<AuditJobData>;
  private connection: Redis;

  constructor(queueName: string = 'audit-queue') {
    this.connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });

    this.queue = new Queue<AuditJobData>(queueName, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: {
          age: 24 * 3600, // 24시간
          count: 100
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // 7일
          count: 500
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });
  }

  async add(
    name: string,
    data: AuditJobData,
    options?: any
  ): Promise<Job<AuditJobData>> {
    return await this.queue.add(name, data, {
      ...options,
      jobId: data.runId // runId를 jobId로 사용
    });
  }

  async getJob(jobId: string): Promise<Job<AuditJobData> | undefined> {
    return await this.queue.getJob(jobId);
  }

  async getActiveCount(): Promise<number> {
    return await this.queue.getActiveCount();
  }

  async getJobCounts(): Promise<QueueCounts> {
    const counts = await this.queue.getJobCounts(
      'active',
      'waiting',
      'completed',
      'failed',
      'delayed',
      'paused'
    );

    return {
      active: counts.active || 0,
      waiting: counts.waiting || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0
    };
  }

  async pause(): Promise<void> {
    await this.queue.pause();
  }

  async resume(): Promise<void> {
    await this.queue.resume();
  }

  async clean(grace: number, limit: number, status: 'completed' | 'failed'): Promise<string[]> {
    return await this.queue.clean(grace, limit, status);
  }

  async obliterate(): Promise<void> {
    await this.queue.obliterate();
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }

  getQueue(): Queue<AuditJobData> {
    return this.queue;
  }
}

let queueInstance: QueueManager | null = null;

export async function setupQueue(): Promise<void> {
  if (!queueInstance) {
    queueInstance = new QueueManager();
  }
}

export async function getQueue(): Promise<QueueManager> {
  if (!queueInstance) {
    queueInstance = new QueueManager();
  }
  return queueInstance;
}

export { Queue, Worker, Job } from 'bullmq';