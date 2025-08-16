import { AuditResult, LLMGraderInput } from '../types/index.js';
import { createFirecrawlClient, FirecrawlClient } from '../lib/firecrawl.js';
import { createLighthouseRunner } from '../lib/lighthouse.js';
import { createVisionLLMGrader } from '../lib/vision-llm.js';
import { createScorerV2 } from '../lib/scorer-v2.js';
import { Reporter } from '../lib/reporter.js';
import { getStorage } from '../utils/storage.js';
import * as cvUtils from '../lib/cv-utils.js';
import { getPuppeteerScreenshot } from '../lib/puppeteer-screenshot.js';

export async function runAudit(
  url: string,
  runId: string,
  updateProgress: (progress: number, message?: string) => Promise<void>
): Promise<AuditResult> {
  const startTime = Date.now();
  const storage = await getStorage();
  
  let firecrawlData: any = null;
  let screenshotData: any = null;
  let lighthouseData: any = null;
  let llmOutput: any = null;
  let finalResult: AuditResult;

  try {
    // 1. Screenshot with Puppeteer & HTML 데이터 수집 (30%)
    await updateProgress(10, 'Starting web scraping and screenshot capture...');
    
    // Platform detection
    const platform = FirecrawlClient.detectPlatform(url);
    await updateProgress(15, `Platform detected: ${platform}`);
    
    // Puppeteer screenshot capture with cleanup
    const puppeteer = getPuppeteerScreenshot('./screenshots');
    let screenshotResult;
    try {
      screenshotResult = await puppeteer.capture(url, {
        fullPage: true,
        waitFor: 3000,
        viewport: {
          width: 375,
          height: 812,
          isMobile: true,
          deviceScaleFactor: 2
        }
      });
    } finally {
      // Always cleanup browser instance
      await puppeteer.cleanup();
    }
    
    if (screenshotResult.success) {
      screenshotData = {
        screenshot: screenshotResult.screenshot,
        localPath: screenshotResult.localPath,
        metadata: screenshotResult.metadata,
        html: screenshotResult.html // Use Puppeteer's rendered HTML
      };
      console.log('Screenshot captured successfully:', screenshotResult.localPath);
      console.log('HTML captured length:', screenshotResult.html?.length || 0);
    } else {
      console.error('Screenshot capture failed:', screenshotResult.error);
    }
    
    // Use Puppeteer HTML as primary source
    firecrawlData = {
      html: screenshotData?.html || '',
      screenshot: screenshotData?.screenshot || '',
      links: [],
      actions: { screenshots: [], urls: [] }
    };
    
    // Firecrawl as optional enhancement (only if API key exists and explicitly enabled)
    if (process.env.FIRECRAWL_API_KEY && process.env.USE_FIRECRAWL === 'true') {
      console.log('Firecrawl enabled, attempting to enhance data...');
      try {
        const firecrawlClient = createFirecrawlClient();
        const response = await firecrawlClient.scrapeWithFallback(url, platform);
        
        if (response.success && response.data) {
          // Only use Firecrawl for additional data, not primary HTML
          firecrawlData.links = response.data.links || [];
          firecrawlData.actions = response.data.actions || { screenshots: [], urls: [] };
          console.log('Firecrawl enhancement successful');
        }
      } catch (error) {
        console.log('Firecrawl enhancement failed, continuing with Puppeteer data');
      }
    }
    
    // Fallback if Puppeteer HTML is empty
    if (!firecrawlData.html && !screenshotData?.html) {
      console.warn('No HTML from Puppeteer, using basic fetch as fallback');
      const basicData = await fetchBasicHTML(url);
      firecrawlData.html = basicData.html;
    }
    
    await updateProgress(30, 'Data collection completed');

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
        const minFontSize = cvUtils.analyzeMinFontSize(firecrawlData.html);
        const minTouchTarget = cvUtils.analyzeMinTouchTarget(firecrawlData.html);
        const seoData = cvUtils.analyzeSeoData(firecrawlData.html);
        const navigation = cvUtils.analyzeNavigation(firecrawlData.html);

        return {
          altRatio,
          popups,
          typography,
          hasViewport,
          hasOverflow,
          minFontSize,
          minTouchTarget,
          seoData,
          navigation,
          popupCount: popups.count
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
    
    // Use Puppeteer HTML if available, otherwise fall back to Firecrawl
    const htmlContent = screenshotData?.html || firecrawlData?.html || '';
    
    const graderInput: LLMGraderInput = {
      url,
      platform: FirecrawlClient.detectPlatform(url, htmlContent, firecrawlData?.links),
      html: htmlContent,
      screenshots: {
        firstView: screenshotData?.screenshot || firecrawlData?.screenshot || '',
        actions: firecrawlData?.actions?.screenshots || []
      }
    };

    // LLM 그레이딩 또는 Mock
    console.log('LLM_API_KEY exists:', !!process.env.LLM_API_KEY);
    console.log('LLM_API_KEY first 10 chars:', process.env.LLM_API_KEY?.substring(0, 10));
    console.log('LLM_MODEL:', process.env.LLM_MODEL);
    
    if (process.env.LLM_API_KEY) {
      try {
        console.log('Attempting to call OpenAI API...');
        console.log('Model being used:', process.env.LLM_MODEL || 'gpt-5');
        const startTime = Date.now();
        llmOutput = await grader.grade(graderInput);
        const endTime = Date.now();
        console.log('OpenAI API call successful');
        console.log('Processing time:', endTime - startTime, 'ms');
        if (llmOutput.metadata) {
          console.log('Model metadata:', JSON.stringify(llmOutput.metadata));
        }
        await updateProgress(70, 'AI analysis completed');
      } catch (error) {
        console.error('LLM grading failed, using mock:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        llmOutput = await grader.gradeMock(graderInput);
      }
    } else {
      console.log('No LLM_API_KEY, using mock');
      llmOutput = await grader.gradeMock(graderInput);
      await updateProgress(70, 'Mock analysis completed');
    }

    // 4-1. Evidence별 개별 스크린샷 캡처 (75%)
    await updateProgress(72, 'Capturing evidence screenshots...');
    const evidenceScreenshots: Record<string, any> = {};
    
    // LLM이 분석한 evidence에서 bbox 정보 추출하여 스크린샷 캡처
    if (llmOutput && llmOutput.scores) {
      const puppeteerInstance = getPuppeteerScreenshot('./screenshots');
      const elementsToCapture: any[] = [];
      
      // 각 카테고리별 evidence에서 bbox 정보 수집
      for (const [categoryId, categoryData] of Object.entries(llmOutput.scores)) {
        const evidence = (categoryData as any).evidence;
        if (evidence) {
          // 모든 evidence 항목을 순회하여 bbox 찾기
          const processEvidence = (obj: any, path: string = '') => {
            if (!obj) return;
            
            // 직접 bbox를 가진 경우
            if (obj.bbox && Array.isArray(obj.bbox) && obj.bbox.length === 4) {
              elementsToCapture.push({
                category: categoryId,
                type: path || 'element',
                bbox: obj.bbox,
                selector: obj.selector,
                text: obj.text
              });
            }
            
            // 배열인 경우
            if (Array.isArray(obj)) {
              obj.forEach((item, idx) => {
                processEvidence(item, `${path}_${idx}`);
              });
            }
            // 객체인 경우 재귀적으로 탐색
            else if (typeof obj === 'object') {
              Object.entries(obj).forEach(([key, value]) => {
                if (key !== 'bbox' && key !== 'selector' && key !== 'text') {
                  processEvidence(value, path ? `${path}_${key}` : key);
                }
              });
            }
          };
          
          processEvidence(evidence);
        }
      }
      
      // 수집된 요소들 캡처
      console.log('Total elements to capture:', elementsToCapture.length);
      if (elementsToCapture.length > 0) {
        try {
          console.log(`Capturing ${elementsToCapture.length} evidence screenshots...`);
          console.log('Elements to capture (first 3):', JSON.stringify(elementsToCapture.slice(0, 3), null, 2));
          const captureConfigs = elementsToCapture.map(elem => ({
            selector: elem.selector,
            bbox: elem.bbox ? {
              x: elem.bbox[0],
              y: elem.bbox[1],
              width: elem.bbox[2],
              height: elem.bbox[3]
            } : undefined,
            padding: 80  // 15px에서 80px로 증가 - 더 넓은 범위 캡처
          }));
          
          console.log('About to call captureMultipleElements with configs:', captureConfigs.length);
          const captureResults = await puppeteerInstance.captureMultipleElements(
            url,
            captureConfigs,
            {
              viewport: {
                width: 375,
                height: 812,
                isMobile: true,
                deviceScaleFactor: 2
              },
              waitFor: 2000
            }
          );
          
          console.log(`Capture results: ${captureResults ? captureResults.length : 0} screenshots, ${captureResults ? captureResults.filter(r => r.success).length : 0} successful`);
          if (!captureResults || captureResults.length === 0) {
            console.error('captureMultipleElements returned no results');
          }
          
          // 결과를 evidence에 매핑
          captureResults.forEach((result, idx) => {
            if (result.success) {
              const elem = elementsToCapture[idx];
              if (!evidenceScreenshots[elem.category]) {
                evidenceScreenshots[elem.category] = {
                  items: [],
                  byType: {}
                };
              }
              // bbox를 다시 배열 형식으로 변환
              const bboxArray = elem.bbox; // 원래 배열 형식 사용
              
              // 타입별로 저장
              evidenceScreenshots[elem.category].byType[elem.type] = {
                screenshot: result.screenshot,
                localPath: result.localPath,
                bbox: bboxArray,
                text: elem.text
              };
              // 배열로도 저장
              evidenceScreenshots[elem.category].items.push({
                type: elem.type,
                screenshot: result.screenshot,
                localPath: result.localPath,
                bbox: bboxArray,
                text: elem.text
              });
            }
          });
          
          console.log('Evidence screenshots captured successfully');
          console.log('evidenceScreenshots keys:', Object.keys(evidenceScreenshots));
          console.log('Total screenshot items:', Object.values(evidenceScreenshots).reduce((sum: number, cat: any) => 
            sum + (cat.items ? cat.items.length : 0), 0));
          console.log('Sample evidenceScreenshots:', JSON.stringify(Object.keys(evidenceScreenshots).slice(0, 2).reduce((obj, key) => ({...obj, [key]: evidenceScreenshots[key]}), {}), null, 2));
        } catch (error) {
          console.error('Failed to capture evidence screenshots:', error);
        } finally {
          await puppeteerInstance.cleanup();
        }
      }
    }

    // 5. 점수 계산 (80%) - ScorerV2 사용
    await updateProgress(75, 'Calculating scores...');
    
    // 측정 데이터 준비
    const measuredData = {
      lighthouse: lighthouseData || null,
      cv: cvAnalysis ? {
        hasViewport: cvAnalysis.hasViewport,
        minFontSize: cvAnalysis.minFontSize,
        minTouchTarget: cvAnalysis.minTouchTarget,
        hasOverflow: cvAnalysis.hasOverflow,
        altRatio: cvAnalysis.altRatio.ratio,
        popupCount: cvAnalysis.popupCount
      } : null,
      html: cvAnalysis ? {
        ...cvAnalysis.seoData,
        ...cvAnalysis.navigation
      } : null
    };

    // ScorerV2로 점수 계산
    const scorerV2 = createScorerV2();
    const scoreResult = scorerV2.calculateScores(llmOutput, measuredData);
    
    console.log('Score calculation complete:', {
      totalScore: scoreResult.totalScore,
      sources: scoreResult.scoreSources
    });
    
    await updateProgress(80, 'Scores calculated');

    // 6. 리포트 생성 (90%)
    await updateProgress(85, 'Generating report...');
    
    const reporter = new Reporter();
    
    // 최종 결과 구성 - evidence에 스크린샷 추가
    finalResult = {
      runId,
      url,
      status: 'completed',
      startedAt: new Date(startTime),
      elapsedMs: Date.now() - startTime,
      totalScore: scoreResult.totalScore,
      checks: Object.entries(scoreResult.categoryScores).map(([id, score]) => {
        const evidence = llmOutput.scores[id]?.evidence || {};
        
        // Evidence 스크린샷 병합
        if (evidenceScreenshots[id]) {
          const screenshotData = evidenceScreenshots[id];
          
          // 재귀적으로 evidence에 스크린샷 추가
          const addScreenshots = (obj: any, path: string = '') => {
            if (!obj) return;
            
            // bbox를 가진 객체에 스크린샷 추가
            if (obj.bbox && screenshotData.byType) {
              const typeKey = Object.keys(screenshotData.byType).find(key => 
                key === path || key.includes(path) || path.includes(key)
              );
              if (typeKey && screenshotData.byType[typeKey]) {
                obj.screenshot = screenshotData.byType[typeKey].screenshot;
              }
            }
            
            // 배열 처리
            if (Array.isArray(obj)) {
              obj.forEach((item, idx) => {
                addScreenshots(item, `${path}_${idx}`);
              });
            }
            // 객체 처리
            else if (typeof obj === 'object') {
              Object.entries(obj).forEach(([key, value]) => {
                if (key !== 'bbox' && key !== 'selector' && key !== 'text' && key !== 'screenshot') {
                  addScreenshots(value, path ? `${path}_${key}` : key);
                }
              });
            }
          };
          
          addScreenshots(evidence);
          
          // 모든 스크린샷을 별도 배열로도 저장
          if (screenshotData.items && screenshotData.items.length > 0) {
            evidence.screenshots = screenshotData.items.map((item: any) => ({
              screenshot: item.screenshot,
              text: item.text,
              bbox: item.bbox
            }));
          }
        }
        
        return {
          id,
          score,
          source: scoreResult.scoreSources[id], // 점수 출처 (rule/ai/hybrid)
          metrics: id === 'speed' ? lighthouseData : llmOutput.scores[id]?.metrics,
          evidence,
          insights: llmOutput.scores[id]?.insights || []
        };
      }),
      expertSummary: llmOutput.expertSummary || undefined,
      purchaseFlow: llmOutput.scores.purchaseFlow?.steps ? {
        ok: llmOutput.scores.purchaseFlow.ok,
        steps: llmOutput.scores.purchaseFlow.steps
      } : undefined,
      screenshots: {
        main: screenshotData?.screenshot || firecrawlData?.screenshot || undefined,
        actions: firecrawlData?.actions?.screenshots || []
      }
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