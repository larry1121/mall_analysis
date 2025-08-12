import { AuditResult, CheckResult, LLMGraderInput } from '../types/index.js';
import { createFirecrawlClient, FirecrawlClient } from '../lib/firecrawl.js';
import { createLighthouseRunner, LighthouseRunner } from '../lib/lighthouse.js';
import { createVisionLLMGrader, VisionLLMGrader } from '../lib/vision-llm.js';
import { createScorer, Scorer } from '../lib/scorer.js';
import { Reporter } from '../lib/reporter.js';
import { getStorage } from '../utils/storage.js';
import * as cvUtils from '../lib/cv-utils.js';

export async function runAudit(
  url: string,
  runId: string,
  updateProgress: (progress: number, message?: string) => Promise<void>
): Promise<AuditResult> {
  const startTime = Date.now();
  const storage = await getStorage();
  
  let firecrawlData: any = null;
  let lighthouseData: any = null;
  let llmOutput: any = null;
  let finalResult: AuditResult;

  try {
    // 1. Firecrawl 데이터 수집 (30%)
    await updateProgress(10, 'Starting web scraping...');
    
    let firecrawlClient: FirecrawlClient | null = null;
    
    console.log('FIRECRAWL_API_KEY exists:', !!process.env.FIRECRAWL_API_KEY);
    console.log('FIRECRAWL_API_KEY first 10 chars:', process.env.FIRECRAWL_API_KEY?.substring(0, 10));
    
    if (process.env.FIRECRAWL_API_KEY) {
      firecrawlClient = createFirecrawlClient();
      const platform = FirecrawlClient.detectPlatform(url);
      
      await updateProgress(15, `Platform detected: ${platform}`);
      
      const response = await firecrawlClient.scrapeWithFallback(url, platform);
      
      if (response.success && response.data) {
        firecrawlData = response.data;
        await updateProgress(30, 'Web scraping completed');
      } else {
        console.warn('Firecrawl failed, using basic HTML fetch');
        firecrawlData = await fetchBasicHTML(url);
      }
    } else {
      console.warn('Firecrawl API key not configured, using basic fetch');
      firecrawlData = await fetchBasicHTML(url);
      await updateProgress(30, 'Basic HTML fetch completed');
    }

    // 2. Lighthouse 성능 측정 (병렬, 50%)
    const lighthousePromise = (async () => {
      if (process.env.NODE_ENV !== 'test') {
        try {
          await updateProgress(35, 'Running Lighthouse performance test...');
          const runner = createLighthouseRunner();
          const result = await runner.run({ url, device: 'mobile' });
          
          if (result.success && result.metrics) {
            lighthouseData = result.metrics;
            await updateProgress(50, 'Performance test completed');
          }
        } catch (error) {
          console.error('Lighthouse failed:', error);
        }
      }
    })();

    // 3. CV 분석 (병렬)
    const cvAnalysisPromise = (async () => {
      if (firecrawlData?.html) {
        const altRatio = cvUtils.calculateAltRatio(firecrawlData.html);
        const popups = cvUtils.detectPopups(firecrawlData.html);
        const typography = cvUtils.analyzeTypographyHierarchy(firecrawlData.html);
        const hasViewport = cvUtils.hasViewportMeta(firecrawlData.html);
        const hasOverflow = cvUtils.detectHorizontalOverflow(firecrawlData.html);

        return {
          altRatio,
          popups,
          typography,
          hasViewport,
          hasOverflow
        };
      }
      return null;
    })();

    // 병렬 작업 대기
    await Promise.all([lighthousePromise, cvAnalysisPromise]);
    const cvAnalysis = await cvAnalysisPromise;

    // 4. LLM 그레이딩 (70%)
    await updateProgress(55, 'Starting AI analysis...');
    
    const grader = createVisionLLMGrader();
    
    const graderInput: LLMGraderInput = {
      url,
      platform: firecrawlData ? FirecrawlClient.detectPlatform(url, firecrawlData.html, firecrawlData.links) : 'unknown',
      html: firecrawlData?.html || '',
      screenshots: {
        firstView: firecrawlData?.screenshot || '',
        actions: firecrawlData?.actions?.screenshots || []
      }
    };

    // LLM 그레이딩 또는 Mock
    if (process.env.LLM_API_KEY) {
      try {
        llmOutput = await grader.grade(graderInput);
        await updateProgress(70, 'AI analysis completed');
      } catch (error) {
        console.error('LLM grading failed, using mock:', error);
        llmOutput = await grader.gradeMock(graderInput);
      }
    } else {
      llmOutput = await grader.gradeMock(graderInput);
      await updateProgress(70, 'Mock analysis completed');
    }

    // 5. 점수 계산 (80%)
    await updateProgress(75, 'Calculating scores...');
    
    const scorer = await createScorer();
    
    // Lighthouse 데이터 주입
    if (lighthouseData && llmOutput.scores.speed) {
      llmOutput.scores.speed.metrics = lighthouseData;
    }

    // CV 분석 데이터 주입
    if (cvAnalysis) {
      if (llmOutput.scores.visuals) {
        llmOutput.scores.visuals.evidence = {
          ...llmOutput.scores.visuals.evidence,
          altRatio: cvAnalysis.altRatio.ratio,
          popups: cvAnalysis.popups.count
        };
      }
      if (llmOutput.scores.mobile) {
        llmOutput.scores.mobile.evidence = {
          ...llmOutput.scores.mobile.evidence,
          viewportMeta: cvAnalysis.hasViewport,
          overflow: cvAnalysis.hasOverflow
        };
      }
      if (llmOutput.scores.bi) {
        llmOutput.scores.bi.evidence = {
          ...llmOutput.scores.bi.evidence,
          typographyRatio: cvAnalysis.typography.ratio
        };
      }
    }

    const scoreResult = scorer.calculateScores(llmOutput);
    
    await updateProgress(80, 'Scores calculated');

    // 6. 리포트 생성 (90%)
    await updateProgress(85, 'Generating report...');
    
    const reporter = new Reporter();
    
    // 최종 결과 구성
    finalResult = {
      runId,
      url,
      status: 'completed',
      startedAt: new Date(startTime),
      elapsedMs: Date.now() - startTime,
      totalScore: scoreResult.totalScore,
      checks: Object.entries(llmOutput.scores).map(([id, score]: [string, any]) => ({
        id,
        score: score.score,
        metrics: score.metrics,
        evidence: score.evidence,
        insights: score.insights || []
      })),
      purchaseFlow: llmOutput.scores.purchaseFlow?.steps ? {
        ok: llmOutput.scores.purchaseFlow.ok,
        steps: llmOutput.scores.purchaseFlow.steps
      } : undefined
    };

    // 리포트 생성
    const reports = await reporter.generateReport(finalResult, {
      format: 'pdf',
      includeScreenshots: true
    });

    // 스토리지에 저장
    if (reports.pdf) {
      const pdfPath = `reports/${runId}/report.pdf`;
      await storage.upload(pdfPath, reports.pdf, 'application/pdf');
      finalResult.export = { ...finalResult.export, pdf: pdfPath };
    }

    if (reports.zip) {
      const zipPath = `reports/${runId}/artifacts.zip`;
      await storage.upload(zipPath, reports.zip, 'application/zip');
      finalResult.export = { ...finalResult.export, zip: zipPath };
    }

    await updateProgress(100, 'Audit completed');

    return finalResult;

  } catch (error) {
    console.error('Audit job failed:', error);
    throw error;
  }
}

/**
 * 기본 HTML 페치 (Firecrawl 없을 때)
 */
async function fetchBasicHTML(url: string): Promise<any> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    
    return {
      html,
      screenshot: '', // 스크린샷 없음
      links: extractLinks(html, url),
      actions: { screenshots: [], urls: [] }
    };
  } catch (error) {
    console.error('Failed to fetch HTML:', error);
    return {
      html: '',
      screenshot: '',
      links: [],
      actions: { screenshots: [], urls: [] }
    };
  }
}

/**
 * HTML에서 링크 추출
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], baseUrl);
      links.push(url.href);
    } catch {
      // 잘못된 URL 무시
    }
  }

  return [...new Set(links)];
}