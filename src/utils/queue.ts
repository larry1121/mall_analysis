import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

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

// 메모리 기반 간단한 큐 (Redis 없을 때 사용)
class InMemoryQueue extends EventEmitter {
  private jobs: Map<string, any> = new Map();
  private statusCounts: QueueCounts = {
    active: 0,
    waiting: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0
  };
  private _isPaused: boolean = false;

  async add(name: string, data: AuditJobData, options?: any): Promise<any> {
    const job = {
      id: data.runId,
      name,
      data,
      opts: options,
      progress: 0,
      attemptsMade: 0,
      status: 'waiting'
    };
    
    this.jobs.set(data.runId, job);
    this.statusCounts.waiting++;
    
    // 비동기로 작업 처리 시뮬레이션
    setTimeout(() => {
      this.emit('job-ready', job);
    }, 100);
    
    return job;
  }

  async getJob(jobId: string): Promise<any> {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    
    return {
      ...job,
      progress: () => job.progress,
      getPosition: async () => 0,
      getEstimatedTime: async () => 10000,
      remove: async () => {
        this.jobs.delete(jobId);
      }
    };
  }

  async getActiveCount(): Promise<number> {
    return this.statusCounts.active;
  }

  async getJobCounts(): Promise<QueueCounts> {
    return { ...this.statusCounts };
  }

  async pause(): Promise<void> {
    this.isPaused = true;
  }

  async resume(): Promise<void> {
    this._isPaused = false;
  }

  async clean(_grace: number, limit: number, status: 'completed' | 'failed'): Promise<string[]> {
    const cleaned: string[] = [];
    this.jobs.forEach((job, id) => {
      if (job.status === status && cleaned.length < limit) {
        this.jobs.delete(id);
        cleaned.push(id);
      }
    });
    return cleaned;
  }

  async obliterate(): Promise<void> {
    this.jobs.clear();
    this.statusCounts = {
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0
    };
  }

  async close(): Promise<void> {
    this.removeAllListeners();
  }

  getQueue(): any {
    return this;
  }
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

let queueInstance: QueueManager | InMemoryQueue | null = null;

export async function setupQueue(): Promise<void> {
  if (!queueInstance) {
    // REDIS_URL이 없으면 메모리 큐 사용
    if (!process.env.REDIS_URL) {
      console.log('📝 REDIS_URL not set, using in-memory queue');
      queueInstance = new InMemoryQueue();
    } else {
      try {
        queueInstance = new QueueManager();
        console.log('✅ Connected to Redis queue');
      } catch (error) {
        console.warn('⚠️  Failed to connect to Redis, falling back to in-memory queue:', error);
        queueInstance = new InMemoryQueue();
      }
    }
  }
}

export async function getQueue(): Promise<QueueManager | InMemoryQueue> {
  if (!queueInstance) {
    await setupQueue();
  }
  return queueInstance!;
}

export { Queue, Worker, Job } from 'bullmq';