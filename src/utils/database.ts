import pg from 'pg';
import { AuditRun, AuditResult, CheckResult } from '../types/index.js';
import { FileDatabase } from './file-database.js';

const { Pool } = pg;

// 메모리 저장소 (DB 없을 때 사용)
class InMemoryDatabase {
  private runs: Map<string, AuditRun> = new Map();
  private checks: Map<string, CheckResult[]> = new Map();
  private flowSteps: Map<string, any[]> = new Map();

  async ping(): Promise<void> {
    // 메모리 DB는 항상 OK
    return Promise.resolve();
  }

  async setupTables(): Promise<void> {
    // 메모리 DB는 테이블 설정 불필요
    return Promise.resolve();
  }

  async createRun(run: AuditRun): Promise<void> {
    this.runs.set(run.runId, run);
  }

  async updateRun(runId: string, updates: Partial<AuditRun>): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      this.runs.set(runId, { ...run, ...updates });
    }
  }

  async getRun(runId: string): Promise<AuditRun | null> {
    const run = this.runs.get(runId);
    console.log(`[InMemoryDB] getRun(${runId}):`, run ? 'found' : 'not found');
    console.log(`[InMemoryDB] Total runs:`, this.runs.size);
    return run || null;
  }

  async getFullResult(runId: string): Promise<AuditResult | null> {
    const run = this.runs.get(runId);
    if (!run) return null;

    const checks = this.checks.get(runId) || [];
    const steps = this.flowSteps.get(runId) || [];

    return {
      ...run,
      checks,
      purchaseFlow: steps.length > 0 ? {
        ok: true,
        steps
      } : undefined
    };
  }

  async saveCheckResult(runId: string, check: CheckResult): Promise<void> {
    const checks = this.checks.get(runId) || [];
    checks.push(check);
    this.checks.set(runId, checks);
  }

  async saveFlowStep(runId: string, stepIndex: number, step: any): Promise<void> {
    const steps = this.flowSteps.get(runId) || [];
    steps[stepIndex] = step;
    this.flowSteps.set(runId, steps);
  }

  async listRuns(options: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<AuditRun[]> {
    let runs = Array.from(this.runs.values());
    
    if (options.status) {
      runs = runs.filter(r => r.status === options.status);
    }
    
    // 최신순 정렬
    runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    
    const start = options.offset || 0;
    const end = start + (options.limit || runs.length);
    
    return runs.slice(start, end);
  }

  async countRuns(options: { status?: string }): Promise<number> {
    let runs = Array.from(this.runs.values());
    
    if (options.status) {
      runs = runs.filter(r => r.status === options.status);
    }
    
    return runs.length;
  }

  async deleteRun(runId: string): Promise<void> {
    this.runs.delete(runId);
    this.checks.delete(runId);
    this.flowSteps.delete(runId);
  }

  async close(): Promise<void> {
    // 메모리 DB는 클린업 불필요
  }
}

export class Database {
  private pool: pg.Pool;

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async ping(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  async setupTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_runs (
          run_id UUID PRIMARY KEY,
          url TEXT NOT NULL,
          status VARCHAR(20) NOT NULL,
          started_at TIMESTAMP NOT NULL,
          completed_at TIMESTAMP,
          elapsed_ms INTEGER,
          total_score INTEGER,
          error TEXT,
          pdf_path TEXT,
          zip_path TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_checks (
          id SERIAL PRIMARY KEY,
          run_id UUID REFERENCES audit_runs(run_id) ON DELETE CASCADE,
          category VARCHAR(50) NOT NULL,
          score INTEGER NOT NULL,
          metrics JSONB,
          evidence JSONB,
          insights TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS flow_steps (
          id SERIAL PRIMARY KEY,
          run_id UUID REFERENCES audit_runs(run_id) ON DELETE CASCADE,
          step_index INTEGER NOT NULL,
          name VARCHAR(20) NOT NULL,
          url TEXT NOT NULL,
          screenshot_path TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 인덱스 생성
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_runs_status 
        ON audit_runs(status)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_runs_created_at 
        ON audit_runs(created_at DESC)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_checks_run_id 
        ON audit_checks(run_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_flow_steps_run_id 
        ON flow_steps(run_id)
      `);

    } finally {
      client.release();
    }
  }

  async createRun(run: AuditRun): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO audit_runs (run_id, url, status, started_at) 
         VALUES ($1, $2, $3, $4)`,
        [run.runId, run.url, run.status, run.startedAt]
      );
    } finally {
      client.release();
    }
  }

  async updateRun(runId: string, updates: Partial<AuditRun>): Promise<void> {
    const client = await this.pool.connect();
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${paramCount++}`);
        values.push(updates.status);
      }
      if (updates.elapsedMs !== undefined) {
        fields.push(`elapsed_ms = $${paramCount++}`);
        values.push(updates.elapsedMs);
      }
      if (updates.totalScore !== undefined) {
        fields.push(`total_score = $${paramCount++}`);
        values.push(updates.totalScore);
      }
      if (updates.error !== undefined) {
        fields.push(`error = $${paramCount++}`);
        values.push(updates.error);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(runId);

      await client.query(
        `UPDATE audit_runs SET ${fields.join(', ')} WHERE run_id = $${paramCount}`,
        values
      );
    } finally {
      client.release();
    }
  }

  async getRun(runId: string): Promise<AuditRun | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM audit_runs WHERE run_id = $1',
        [runId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        runId: row.run_id,
        url: row.url,
        status: row.status,
        startedAt: row.started_at,
        elapsedMs: row.elapsed_ms,
        totalScore: row.total_score,
        error: row.error
      };
    } finally {
      client.release();
    }
  }

  async getFullResult(runId: string): Promise<AuditResult | null> {
    const client = await this.pool.connect();
    try {
      // 기본 정보 조회
      const runResult = await client.query(
        'SELECT * FROM audit_runs WHERE run_id = $1',
        [runId]
      );

      if (runResult.rows.length === 0) {
        return null;
      }

      const run = runResult.rows[0];

      // 체크 결과 조회
      const checksResult = await client.query(
        'SELECT * FROM audit_checks WHERE run_id = $1 ORDER BY category',
        [runId]
      );

      // 플로우 스텝 조회
      const stepsResult = await client.query(
        'SELECT * FROM flow_steps WHERE run_id = $1 ORDER BY step_index',
        [runId]
      );

      const checks: CheckResult[] = checksResult.rows.map(row => ({
        id: row.category,
        score: row.score,
        metrics: row.metrics,
        evidence: row.evidence,
        insights: row.insights || []
      }));

      const steps = stepsResult.rows.map(row => ({
        name: row.name,
        url: row.url,
        screenshot: row.screenshot_path
      }));

      return {
        runId: run.run_id,
        url: run.url,
        status: run.status,
        startedAt: run.started_at,
        elapsedMs: run.elapsed_ms,
        totalScore: run.total_score,
        checks,
        purchaseFlow: steps.length > 0 ? {
          ok: true,
          steps
        } : undefined,
        export: {
          pdf: run.pdf_path,
          zip: run.zip_path
        }
      };
    } finally {
      client.release();
    }
  }

  async saveCheckResult(runId: string, check: CheckResult): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO audit_checks (run_id, category, score, metrics, evidence, insights)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          runId,
          check.id,
          check.score,
          JSON.stringify(check.metrics || {}),
          JSON.stringify(check.evidence || {}),
          check.insights || []
        ]
      );
    } finally {
      client.release();
    }
  }

  async saveFlowStep(runId: string, stepIndex: number, step: any): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO flow_steps (run_id, step_index, name, url, screenshot_path)
         VALUES ($1, $2, $3, $4, $5)`,
        [runId, stepIndex, step.name, step.url, step.screenshot]
      );
    } finally {
      client.release();
    }
  }

  async listRuns(options: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<AuditRun[]> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM audit_runs';
      const params: any[] = [];
      
      if (options.status) {
        query += ' WHERE status = $1';
        params.push(options.status);
      }

      query += ' ORDER BY created_at DESC';
      
      if (options.limit) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(options.limit);
      }
      
      if (options.offset) {
        query += ` OFFSET $${params.length + 1}`;
        params.push(options.offset);
      }

      const result = await client.query(query, params);
      
      return result.rows.map(row => ({
        runId: row.run_id,
        url: row.url,
        status: row.status,
        startedAt: row.started_at,
        elapsedMs: row.elapsed_ms,
        totalScore: row.total_score,
        error: row.error
      }));
    } finally {
      client.release();
    }
  }

  async countRuns(options: { status?: string }): Promise<number> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT COUNT(*) FROM audit_runs';
      const params: any[] = [];
      
      if (options.status) {
        query += ' WHERE status = $1';
        params.push(options.status);
      }

      const result = await client.query(query, params);
      return parseInt(result.rows[0].count, 10);
    } finally {
      client.release();
    }
  }

  async deleteRun(runId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM audit_runs WHERE run_id = $1', [runId]);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// 전역 싱글톤 인스턴스 - FileDatabase 사용 (프로세스 간 공유 가능)
const globalFileDB = new FileDatabase();
let dbInstance: Database | InMemoryDatabase | FileDatabase | null = null;

export async function setupDatabase(): Promise<void> {
  if (!dbInstance) {
    // PostgreSQL 시도
    if (process.env.DATABASE_URL && process.env.DATABASE_URL !== 'postgresql://user:password@localhost:5432/mall_analysis') {
      try {
        dbInstance = new Database();
        await dbInstance.setupTables();
        console.log('✅ Connected to PostgreSQL database');
        return;
      } catch (error) {
        console.warn('⚠️  Failed to connect to PostgreSQL:', error);
      }
    }
    
    // FileDatabase 사용 (프로세스 간 공유 가능)
    console.log('📁 Using file-based database (shared across processes)');
    dbInstance = globalFileDB;
    await dbInstance.setupTables();
  }
}

export async function getDatabase(): Promise<Database | InMemoryDatabase | FileDatabase> {
  if (!dbInstance) {
    await setupDatabase();
  }
  return dbInstance!;
}