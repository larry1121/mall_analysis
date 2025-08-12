import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { LighthouseMetrics } from '../types/index.js';

export interface LighthouseOptions {
  url: string;
  device?: 'mobile' | 'desktop';
  throttling?: boolean;
  timeout?: number;
}

export interface LighthouseResult {
  success: boolean;
  metrics?: LighthouseMetrics;
  rawData?: any;
  error?: string;
}

export class LighthouseRunner {
  private timeout: number;

  constructor(timeout: number = 40000) {
    this.timeout = timeout;
  }

  /**
   * Lighthouse CLI 실행 및 결과 파싱
   */
  async run(options: LighthouseOptions): Promise<LighthouseResult> {
    const outputPath = join(tmpdir(), `lighthouse-${uuidv4()}.json`);
    
    try {
      // Lighthouse CLI 명령어 구성
      const args = this.buildArgs(options.url, outputPath, options);
      
      // CLI 실행
      const exitCode = await this.executeLighthouse(args);
      
      if (exitCode !== 0) {
        throw new Error(`Lighthouse exited with code ${exitCode}`);
      }

      // 결과 파일 읽기
      const rawJson = await fs.readFile(outputPath, 'utf-8');
      const data = JSON.parse(rawJson);

      // 메트릭 추출
      const metrics = this.extractMetrics(data);

      // 정리
      await fs.unlink(outputPath).catch(() => {});

      return {
        success: true,
        metrics,
        rawData: data
      };
    } catch (error) {
      // 정리
      await fs.unlink(outputPath).catch(() => {});

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Lighthouse CLI 인자 구성
   */
  private buildArgs(url: string, outputPath: string, options: LighthouseOptions): string[] {
    const args = [
      url,
      '--only-categories=performance',
      '--output=json',
      `--output-path=${outputPath}`,
      '--quiet',
      '--chrome-flags="--headless --no-sandbox --disable-gpu"'
    ];

    // 모바일 에뮬레이션
    if (options.device === 'mobile' || !options.device) {
      args.push('--screenEmulation.mobile=true');
      args.push('--screenEmulation.width=375');
      args.push('--screenEmulation.height=812');
    }

    // 네트워크 스로틀링
    if (options.throttling !== false) {
      args.push('--throttling-method=simulate');
    } else {
      args.push('--throttling-method=devtools');
    }

    return args;
  }

  /**
   * Lighthouse CLI 실행
   */
  private executeLighthouse(args: string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      const lighthouse = spawn('npx', ['lighthouse', ...args], {
        shell: true,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';
      
      // 타임아웃 설정
      const timer = setTimeout(() => {
        lighthouse.kill('SIGTERM');
        reject(new Error('Lighthouse timeout'));
      }, this.timeout);

      lighthouse.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      lighthouse.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      lighthouse.on('close', (code) => {
        clearTimeout(timer);
        
        if (code === null || code === 143) {
          // Killed by timeout
          reject(new Error('Lighthouse process was terminated'));
        } else if (code !== 0) {
          console.error('Lighthouse stderr:', stderr);
          resolve(code || 1);
        } else {
          resolve(0);
        }
      });

      lighthouse.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Lighthouse 결과에서 필요한 메트릭 추출
   */
  private extractMetrics(data: any): LighthouseMetrics {
    const audits = data.audits || {};
    const metrics: LighthouseMetrics = {
      LCP: 0,
      CLS: 0,
      TBT: 0
    };

    // LCP (Largest Contentful Paint) - 초 단위
    if (audits['largest-contentful-paint']) {
      metrics.LCP = audits['largest-contentful-paint'].numericValue / 1000;
    }

    // CLS (Cumulative Layout Shift)
    if (audits['cumulative-layout-shift']) {
      metrics.CLS = audits['cumulative-layout-shift'].numericValue;
    }

    // TBT (Total Blocking Time) - 밀리초 단위
    if (audits['total-blocking-time']) {
      metrics.TBT = audits['total-blocking-time'].numericValue;
    }

    // FCP (First Contentful Paint) - 초 단위
    if (audits['first-contentful-paint']) {
      metrics.FCP = audits['first-contentful-paint'].numericValue / 1000;
    }

    // SI (Speed Index) - 초 단위
    if (audits['speed-index']) {
      metrics.SI = audits['speed-index'].numericValue / 1000;
    }

    // TTI (Time to Interactive) - 초 단위
    if (audits['interactive']) {
      metrics.TTI = audits['interactive'].numericValue / 1000;
    }

    // 네트워크 요청 수
    if (audits['network-requests']) {
      const items = audits['network-requests'].details?.items || [];
      metrics.requests = items.length;
    }

    // 리다이렉트 수
    if (audits['redirects']) {
      const items = audits['redirects'].details?.items || [];
      metrics.redirects = items.length;
    }

    return metrics;
  }

  /**
   * 간단한 성능 점수 계산 (0-10)
   */
  static calculateSpeedScore(metrics: LighthouseMetrics): number {
    let score = 10;

    // LCP 기준 (2.5초 이하: 4점, 4초 이하: 3점, 그 이상: 1점)
    if (metrics.LCP <= 2.5) {
      score = score;
    } else if (metrics.LCP <= 4.0) {
      score -= 1;
    } else {
      score -= 3;
    }

    // CLS 기준 (0.1 이하: 2점, 그 이상: 0점)
    if (metrics.CLS > 0.1) {
      score -= 2;
    }

    // TBT 기준 (300ms 이하: 2점, 그 이상: 0점)
    if (metrics.TBT > 300) {
      score -= 2;
    }

    return Math.max(0, score);
  }

  /**
   * Lighthouse 메트릭을 읽기 쉬운 형태로 포맷
   */
  static formatMetrics(metrics: LighthouseMetrics): string {
    const lines = [
      `LCP: ${metrics.LCP.toFixed(2)}s`,
      `CLS: ${metrics.CLS.toFixed(3)}`,
      `TBT: ${metrics.TBT.toFixed(0)}ms`
    ];

    if (metrics.FCP !== undefined) {
      lines.push(`FCP: ${metrics.FCP.toFixed(2)}s`);
    }
    if (metrics.SI !== undefined) {
      lines.push(`SI: ${metrics.SI.toFixed(2)}s`);
    }
    if (metrics.TTI !== undefined) {
      lines.push(`TTI: ${metrics.TTI.toFixed(2)}s`);
    }
    if (metrics.requests !== undefined) {
      lines.push(`Requests: ${metrics.requests}`);
    }
    if (metrics.redirects !== undefined) {
      lines.push(`Redirects: ${metrics.redirects}`);
    }

    return lines.join('\n');
  }
}

// Docker 환경에서 실행하는 대체 구현
export class DockerLighthouseRunner extends LighthouseRunner {
  /**
   * Docker 컨테이너에서 Lighthouse 실행
   */
  private executeLighthouse(args: string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      const dockerArgs = [
        'run',
        '--rm',
        '-v', `${tmpdir()}:/tmp`,
        'femtopixel/google-lighthouse',
        ...args
      ];

      const docker = spawn('docker', dockerArgs, {
        stdio: 'pipe'
      });

      let stderr = '';
      const timer = setTimeout(() => {
        docker.kill('SIGTERM');
        reject(new Error('Lighthouse timeout'));
      }, this.timeout);

      docker.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      docker.on('close', (code) => {
        clearTimeout(timer);
        
        if (code === null || code === 143) {
          reject(new Error('Lighthouse process was terminated'));
        } else if (code !== 0) {
          console.error('Docker Lighthouse stderr:', stderr);
          resolve(code || 1);
        } else {
          resolve(0);
        }
      });

      docker.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
}

// 환경에 따라 적절한 Runner 선택
export function createLighthouseRunner(): LighthouseRunner {
  const isDocker = process.env.USE_DOCKER_LIGHTHOUSE === 'true';
  const timeout = parseInt(process.env.LIGHTHOUSE_TIMEOUT || '40000', 10);
  
  if (isDocker) {
    return new DockerLighthouseRunner(timeout);
  }
  
  return new LighthouseRunner(timeout);
}