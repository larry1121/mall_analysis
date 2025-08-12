import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AuditRun, AuditResult, CheckResult } from '../types/index.js';

// 파일 기반 데이터베이스 (프로세스 간 공유 가능)
export class FileDatabase {
  private dbPath: string;

  constructor() {
    this.dbPath = join(tmpdir(), 'mall-analysis-db');
    this.ensureDir();
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.dbPath, { recursive: true });
    } catch (error) {
      // 디렉토리가 이미 존재하면 무시
    }
  }

  private getRunPath(runId: string): string {
    return join(this.dbPath, `run-${runId}.json`);
  }

  async ping(): Promise<void> {
    await this.ensureDir();
  }

  async setupTables(): Promise<void> {
    await this.ensureDir();
  }

  async createRun(run: AuditRun): Promise<void> {
    const path = this.getRunPath(run.runId);
    await fs.writeFile(path, JSON.stringify({
      ...run,
      checks: [],
      flowSteps: []
    }, null, 2));
  }

  async updateRun(runId: string, updates: Partial<AuditRun>): Promise<void> {
    const path = this.getRunPath(runId);
    try {
      const data = await fs.readFile(path, 'utf-8');
      const current = JSON.parse(data);
      const updated = {
        ...current,
        ...updates,
        checks: current.checks || [],
        flowSteps: current.flowSteps || [],
        screenshots: updates.screenshots || current.screenshots
      };
      await fs.writeFile(path, JSON.stringify(updated, null, 2));
    } catch (error) {
      console.error(`Failed to update run ${runId}:`, error);
    }
  }

  async getRun(runId: string): Promise<AuditRun | null> {
    const path = this.getRunPath(runId);
    try {
      const data = await fs.readFile(path, 'utf-8');
      const parsed = JSON.parse(data);
      console.log(`[FileDB] getRun(${runId}) parsed:`, parsed);
      
      // Date 객체로 변환
      if (parsed.startedAt) {
        parsed.startedAt = new Date(parsed.startedAt);
      }
      
      const result = {
        runId: parsed.runId,
        url: parsed.url,
        status: parsed.status,
        startedAt: parsed.startedAt,
        elapsedMs: parsed.elapsedMs,
        totalScore: parsed.totalScore,
        error: parsed.error
      };
      
      console.log(`[FileDB] getRun(${runId}) returning:`, result);
      return result;
    } catch (error) {
      console.log(`[FileDB] getRun(${runId}) error:`, error);
      return null;
    }
  }

  async getFullResult(runId: string): Promise<AuditResult | null> {
    const path = this.getRunPath(runId);
    try {
      const data = await fs.readFile(path, 'utf-8');
      const parsed = JSON.parse(data);
      
      console.log(`[FileDB] getFullResult(${runId}) parsed:`, parsed);
      
      // Date 객체로 변환
      if (parsed.startedAt) {
        parsed.startedAt = new Date(parsed.startedAt);
      }

      const result = {
        runId: parsed.runId,
        url: parsed.url,
        status: parsed.status,
        startedAt: parsed.startedAt,
        elapsedMs: parsed.elapsedMs,
        totalScore: parsed.totalScore,
        error: parsed.error,
        checks: parsed.checks || [],
        purchaseFlow: parsed.flowSteps && parsed.flowSteps.length > 0 ? {
          ok: true,
          steps: parsed.flowSteps
        } : undefined,
        screenshots: parsed.screenshots || undefined
      };
      
      console.log(`[FileDB] getFullResult(${runId}) returning:`, result);
      return result;
    } catch (error) {
      console.log(`[FileDB] getFullResult(${runId}) error:`, error);
      return null;
    }
  }

  async saveCheckResult(runId: string, check: CheckResult): Promise<void> {
    const path = this.getRunPath(runId);
    try {
      const data = await fs.readFile(path, 'utf-8');
      const current = JSON.parse(data);
      if (!current.checks) {
        current.checks = [];
      }
      current.checks.push(check);
      await fs.writeFile(path, JSON.stringify(current, null, 2));
    } catch (error) {
      console.error(`Failed to save check result for ${runId}:`, error);
    }
  }

  async saveFlowStep(runId: string, stepIndex: number, step: any): Promise<void> {
    const path = this.getRunPath(runId);
    try {
      const data = await fs.readFile(path, 'utf-8');
      const current = JSON.parse(data);
      if (!current.flowSteps) {
        current.flowSteps = [];
      }
      current.flowSteps[stepIndex] = step;
      await fs.writeFile(path, JSON.stringify(current, null, 2));
    } catch (error) {
      console.error(`Failed to save flow step for ${runId}:`, error);
    }
  }

  async listRuns(options: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<AuditRun[]> {
    try {
      const files = await fs.readdir(this.dbPath);
      const runFiles = files.filter(f => f.startsWith('run-') && f.endsWith('.json'));
      
      const runs: AuditRun[] = [];
      for (const file of runFiles) {
        const runId = file.replace('run-', '').replace('.json', '');
        const run = await this.getRun(runId);
        if (run && (!options.status || run.status === options.status)) {
          runs.push(run);
        }
      }

      // 최신순 정렬
      runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

      const start = options.offset || 0;
      const end = start + (options.limit || runs.length);

      return runs.slice(start, end);
    } catch (error) {
      return [];
    }
  }

  async countRuns(options: { status?: string }): Promise<number> {
    const runs = await this.listRuns({ status: options.status });
    return runs.length;
  }

  async deleteRun(runId: string): Promise<void> {
    const path = this.getRunPath(runId);
    try {
      await fs.unlink(path);
    } catch (error) {
      // 파일이 없으면 무시
    }
  }
}