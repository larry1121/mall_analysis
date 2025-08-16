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
  protected timeout: number;

  constructor(timeout: number = 600000) { // Increase default timeout to 600s (10 minutes)
    this.timeout = timeout;
  }

  /**
   * Lighthouse CLI 실행 및 결과 파싱 (with retry logic)
   */
  async run(options: LighthouseOptions): Promise<LighthouseResult> {
    const maxRetries = 1; // Reduce retries since each attempt takes very long
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const outputPath = join(tmpdir(), `lighthouse-${uuidv4()}.json`);
      
      try {
        console.log(`Lighthouse attempt ${attempt + 1}/${maxRetries + 1} for ${options.url}`);
        
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

        console.log(`Lighthouse succeeded for ${options.url}`);
        return {
          success: true,
          metrics,
          rawData: data
        };
      } catch (error) {
        // 정리
        await fs.unlink(outputPath).catch(() => {});
        
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Lighthouse attempt ${attempt + 1} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        }
      }
    }

    // All attempts failed, return partial data if possible
    console.error(`Lighthouse failed after ${maxRetries + 1} attempts for ${options.url}`);
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      metrics: {
        LCP: 0,
        CLS: 0,
        TBT: 0
      }
    };
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
      '--chrome-flags="--headless --no-sandbox --disable-gpu --disable-dev-shm-usage"',
      '--max-wait-for-load=60000'  // 60초까지 페이지 로드 대기
    ];

    // 디바이스 에뮬레이션
    if (options.device === 'desktop') {
      // 데스크톱 모드 (명시적으로 desktop 지정 시)
      args.push('--screenEmulation.disabled=true');
      args.push('--formFactor=desktop');
      args.push('--chrome-flags="--headless --no-sandbox --disable-gpu --disable-dev-shm-usage --window-size=1920,1080"');
    } else {
      // 기본값: 모바일 (현재 대부분의 트래픽이 모바일)
      args.push('--screenEmulation.mobile=true');
      args.push('--screenEmulation.width=375');
      args.push('--screenEmulation.height=812');
      args.push('--emulatedUserAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15"');
    }

    // 보편적인 사용자 환경: 스로틀링 없이 실제 네트워크/CPU 성능 사용
    // 대부분의 사용자는 4G/5G 또는 WiFi를 사용하며 최신 디바이스를 보유
    args.push('--throttling-method=provided'); // 스로틀링 없음
    args.push('--throttling.cpuSlowdownMultiplier=1'); // CPU 슬로우다운 없음
    
    // 옵션으로 스로틀링을 명시적으로 켠 경우에만 적용
    if (options.throttling === true) {
      // 명시적으로 스로틀링을 원하는 경우 (저사양 테스트용)
      args.push('--throttling-method=simulate');
      args.push('--throttling.cpuSlowdownMultiplier=2');
      args.push('--throttling.rttMs=40');
      args.push('--throttling.throughputKbps=10240');
    }

    return args;
  }

  /**
   * Lighthouse CLI 실행
   */
  protected executeLighthouse(args: string[]): Promise<number> {
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
    console.log('=== Extracting metrics from Lighthouse data ===');
    
    const audits = data.audits || {};
    const metrics: LighthouseMetrics = {
      LCP: 0,
      CLS: 0,
      TBT: 0
    };

    // Debug logging
    const auditKeys = Object.keys(audits);
    console.log(`Total audits found: ${auditKeys.length}`);
    console.log('Looking for metrics: largest-contentful-paint, cumulative-layout-shift, total-blocking-time');

    // LCP (Largest Contentful Paint) - 초 단위
    if (audits['largest-contentful-paint']) {
      const lcpValue = audits['largest-contentful-paint'].numericValue;
      if (lcpValue !== undefined && lcpValue !== null) {
        metrics.LCP = lcpValue / 1000;
        console.log(`✅ LCP extracted: ${metrics.LCP}s (raw: ${lcpValue}ms)`);
      } else {
        console.log('❌ LCP value is null/undefined');
      }
    } else {
      console.log('❌ LCP audit not found in results');
    }

    // CLS (Cumulative Layout Shift)
    if (audits['cumulative-layout-shift']) {
      const clsValue = audits['cumulative-layout-shift'].numericValue;
      if (clsValue !== undefined && clsValue !== null) {
        metrics.CLS = clsValue;
        console.log(`✅ CLS extracted: ${metrics.CLS} (raw: ${clsValue})`);
      } else {
        console.log('❌ CLS value is null/undefined');
      }
    } else {
      console.log('❌ CLS audit not found in results');
    }

    // TBT (Total Blocking Time) - 밀리초 단위
    if (audits['total-blocking-time']) {
      const tbtValue = audits['total-blocking-time'].numericValue;
      if (tbtValue !== undefined && tbtValue !== null) {
        metrics.TBT = tbtValue;
        console.log(`✅ TBT extracted: ${metrics.TBT}ms (raw: ${tbtValue}ms)`);
      } else {
        console.log('❌ TBT value is null/undefined');
      }
    } else {
      console.log('❌ TBT audit not found in results');
    }

    // FCP (First Contentful Paint) - 초 단위
    if (audits['first-contentful-paint']) {
      const fcpValue = audits['first-contentful-paint'].numericValue;
      if (fcpValue !== undefined && fcpValue !== null) {
        metrics.FCP = fcpValue / 1000;
        console.log('FCP extracted:', metrics.FCP);
      }
    }

    // SI (Speed Index) - 초 단위
    if (audits['speed-index']) {
      const siValue = audits['speed-index'].numericValue;
      if (siValue !== undefined && siValue !== null) {
        metrics.SI = siValue / 1000;
        console.log('SI extracted:', metrics.SI);
      }
    }

    // TTI (Time to Interactive) - 초 단위
    if (audits['interactive']) {
      const ttiValue = audits['interactive'].numericValue;
      if (ttiValue !== undefined && ttiValue !== null) {
        metrics.TTI = ttiValue / 1000;
        console.log('TTI extracted:', metrics.TTI);
      }
    }

    // 네트워크 요청 수
    if (audits['network-requests']) {
      const items = audits['network-requests'].details?.items || [];
      metrics.requests = items.length;
      console.log('Network requests:', metrics.requests);
    }

    // 리다이렉트 수
    if (audits['redirects']) {
      const items = audits['redirects'].details?.items || [];
      metrics.redirects = items.length;
      console.log('Redirects:', metrics.redirects);
    }

    // Log final metrics
    console.log('=== Final Lighthouse Metrics ===');
    console.log(`LCP: ${metrics.LCP}s`);
    console.log(`CLS: ${metrics.CLS}`);
    console.log(`TBT: ${metrics.TBT}ms`);
    console.log(`FCP: ${metrics.FCP || 'N/A'}s`);
    console.log(`SI: ${metrics.SI || 'N/A'}s`);
    console.log(`TTI: ${metrics.TTI || 'N/A'}s`);
    console.log('================================');

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
  protected executeLighthouse(args: string[]): Promise<number> {
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
  const timeout = parseInt(process.env.LIGHTHOUSE_TIMEOUT || '600000', 10); // Increase to 600s (10 minutes)
  
  if (isDocker) {
    return new DockerLighthouseRunner(timeout);
  }
  
  return new LighthouseRunner(timeout);
}