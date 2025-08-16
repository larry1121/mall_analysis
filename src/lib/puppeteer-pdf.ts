import puppeteer, { Browser } from 'puppeteer';
import { AuditResult } from '../types/index.js';

export class PuppeteerPDFGenerator {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        console.log('Failed to close existing browser:', e);
      }
    }
    
    this.browser = await puppeteer.launch({
      headless: 'new' as const,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  }

  /**
   * React UI를 사용하여 PDF 생성 (Result 페이지 그대로 사용)
   */
  async generatePDFFromReactUI(result: AuditResult): Promise<Buffer> {
    try {
      await this.initialize();
      
      if (!this.browser) {
        throw new Error('Failed to initialize browser');
      }

      const page = await this.browser.newPage();
      
      // 실제 Result 페이지를 PDF 모드로 열기
      const printUrl = `http://localhost:5173/print-result/${result.runId}?pdf=true`;
      
      // A4 크기에 맞는 뷰포트 설정
      await page.setViewport({
        width: 1200,
        height: 1600,
        deviceScaleFactor: 2
      });
      
      // 페이지 방문 및 렌더링 대기
      console.log(`Opening print page: ${printUrl}`);
      await page.goto(printUrl, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      });

      // 페이지가 완전히 로드될 때까지 추가 대기
      await new Promise(resolve => setTimeout(resolve, 2000));

      // React 컴포넌트가 완전히 렌더링될 때까지 대기
      try {
        console.log('Waiting for .print-result-page selector...');
        await page.waitForSelector('.print-result-page', { 
          timeout: 20000,
          visible: true 
        });
        console.log('Found .print-result-page selector');
      } catch (e) {
        console.log('Failed to find .print-result-page, trying main selector...');
        // 폴백: 일반 선택자로 시도
        try {
          await page.waitForSelector('main', { 
            timeout: 20000,
            visible: true 
          });
          console.log('Found main selector');
        } catch (e2) {
          console.log('Failed to find main selector, trying #root...');
          // 추가 폴백: React root 엘리먼트
          await page.waitForSelector('#root', { 
            timeout: 10000,
            visible: true 
          });
          // root가 있으면 잠시 더 기다려서 React가 렌더링되도록
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      // 차트와 이미지가 로드될 시간 확보
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 모든 이미지가 로드될 때까지 대기
      await page.evaluate(() => {
        return Promise.all(
          Array.from((globalThis as any).document.images)
            .filter((img: any) => !img.complete)
            .map((img: any) => new Promise((resolve) => {
              img.addEventListener('load', resolve);
              img.addEventListener('error', resolve);
              setTimeout(resolve, 5000);
            }))
        );
      });

      // 인쇄용 CSS 주입
      await page.addStyleTag({
        content: `
          @media print {
            .no-print, .no-print-on-pdf {
              display: none !important;
            }
            
            body {
              background: white !important;
            }
            
            .card {
              box-shadow: none !important;
              border: 1px solid #e5e7eb !important;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            
            .page-break-after {
              page-break-after: always;
            }
            
            /* 차트 크기 조정 */
            .recharts-wrapper {
              font-size: 12px !important;
            }
            
            /* 스크린샷 크기 제한 */
            img {
              max-width: 100% !important;
              height: auto !important;
            }
          }
        `
      });

      // PDF 생성
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="width: 100%; font-size: 9px; text-align: center; color: #999; padding-top: 5mm;">
            <span>Mall Analysis Report - ${new Date().toLocaleDateString('ko-KR')} - Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>
        `,
        preferCSSPageSize: false,
        scale: 0.9 // 약간 축소하여 여백 확보
      });

      await page.close();
      
      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 프로덕션 환경용: HTML 문자열에서 PDF 생성
   */
  async generatePDFFromHTML(htmlContent: string): Promise<Buffer> {
    try {
      await this.initialize();
      
      if (!this.browser) {
        throw new Error('Failed to initialize browser');
      }

      const page = await this.browser.newPage();
      
      // HTML 컨텐츠 직접 설정
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0'
      });

      // 스타일 주입
      await page.addStyleTag({
        content: `
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
          }
          
          .print-page {
            width: 100%;
            background: white;
          }
          
          @page {
            size: A4;
            margin: 20mm;
          }
          
          .page {
            page-break-after: always;
            min-height: 100vh;
            padding: 0;
          }
          
          .page:last-child {
            page-break-after: auto;
          }
        `
      });

      // 추가 렌더링 시간
      await new Promise(resolve => setTimeout(resolve, 1000));

      // PDF 생성
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="width: 100%; font-size: 9px; text-align: center; color: #666;">
            <span>Mall Analysis POC - Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `
      });

      await page.close();
      
      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('PDF generation from HTML failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 서버 사이드 렌더링용: 데이터를 HTML로 변환 후 PDF 생성
   */
  async generatePDFFromData(result: AuditResult): Promise<Buffer> {
    const html = this.generateHTMLFromData(result);
    return this.generatePDFFromHTML(html);
  }

  /**
   * 데이터를 HTML로 변환 (웹 UI와 동일한 스타일 적용)
   */
  private generateHTMLFromData(result: AuditResult): string {
    const totalScore = result.totalScore || 0;
    const scoreColor = this.getScoreColor(totalScore);
    const scoreGrade = this.getScoreGrade(totalScore);
    
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>자사몰 분석 리포트 - ${result.url}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          line-height: 1.6; 
          color: #1f2937; 
          background: #f9fafb;
        }
        
        .print-page { width: 100%; }
        
        .page { 
          page-break-after: always; 
          min-height: 100vh; 
          padding: 40px;
          position: relative;
        }
        
        .cover-page {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          padding: 60px;
        }
        
        .cover-title {
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 40px;
          color: #1f2937;
        }
        
        .cover-url {
          font-size: 18px;
          color: #4b5563;
          margin-bottom: 20px;
        }
        
        .cover-date {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 60px;
        }
        
        .score-circle {
          width: 200px;
          height: 200px;
          border-radius: 50%;
          border: 8px solid ${scoreColor};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 40px auto;
        }
        
        .score-value {
          font-size: 64px;
          font-weight: bold;
          color: ${scoreColor};
        }
        
        .score-label {
          font-size: 18px;
          color: #6b7280;
        }
        
        .score-grade {
          font-size: 28px;
          font-weight: bold;
          color: ${scoreColor};
          margin-top: 20px;
        }
        
        .page-title {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 30px;
          color: #1f2937;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 10px;
        }
        
        .summary-section {
          margin-bottom: 30px;
        }
        
        .summary-section h4 {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #1f2937;
        }
        
        .summary-section ul {
          margin-left: 20px;
          line-height: 1.8;
        }
        
        .summary-section li {
          font-size: 14px;
          color: #374151;
          margin-bottom: 5px;
        }
        
        .score-item {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          transition: all 0.2s;
        }
        
        .score-bar {
          height: 8px;
          background: #f3f4f6;
          border-radius: 4px;
          overflow: hidden;
          margin: 12px 0;
        }
        
        .score-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s;
        }
        
        .score-item-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        
        .score-item-name {
          font-size: 16px;
          font-weight: 600;
        }
        
        .score-item-value {
          font-size: 18px;
          font-weight: bold;
        }
        
        .score-item-insights {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.5;
        }
        
        .screenshot-section {
          margin-top: 40px;
          page-break-before: always;
        }
        
        .screenshot-container {
          margin: 20px 0;
          text-align: center;
        }
        
        .screenshot-image {
          max-width: 100%;
          max-height: 400px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .screenshot-caption {
          font-size: 12px;
          color: #6b7280;
          margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="print-page">
        <!-- 표지 페이지 -->
        <div class="page cover-page">
            <h1 class="cover-title">자사몰 첫 페이지 분석 리포트</h1>
            <div class="cover-url">${result.url}</div>
            <div class="cover-date">${new Date(result.startedAt).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</div>
            
            <div class="score-circle">
                <div class="score-value">${totalScore}</div>
                <div class="score-label">종합 점수</div>
            </div>
            <div class="score-grade">${scoreGrade}</div>
            
            ${result.expertSummary ? `
            <div style="margin-top: 40px;">
                <span style="font-size: 20px; font-weight: bold; padding: 10px 20px; border: 2px solid #3b82f6; border-radius: 8px; color: #3b82f6;">
                    ${result.expertSummary.grade}등급
                </span>
            </div>
            ` : ''}
        </div>
        
        ${result.expertSummary ? `
        <!-- 종합 요약 페이지 -->
        <div class="page">
            <h2 class="page-title">종합 분석 요약</h2>
            
            <div style="font-size: 18px; margin-bottom: 30px; line-height: 1.5;">
                <strong>${result.expertSummary.headline}</strong>
            </div>
            
            <div class="summary-section">
                <h4>✅ 강점 (${result.expertSummary.strengths.length})</h4>
                <ul>
                    ${result.expertSummary.strengths.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
            
            <div class="summary-section">
                <h4>⚠️ 개선 필요 (${result.expertSummary.weaknesses.length})</h4>
                <ul>
                    ${result.expertSummary.weaknesses.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
            
            <div class="summary-section">
                <h4>🎯 우선순위 (${result.expertSummary.priorities.length})</h4>
                <ol>
                    ${result.expertSummary.priorities.map(item => `<li>${item}</li>`).join('')}
                </ol>
            </div>
        </div>
        ` : ''}
        
        <!-- 상세 점수 페이지 -->
        <div class="page">
            <h2 class="page-title">체크리스트 상세 점수</h2>
            
            ${result.checks.map(check => `
            <div class="score-item">
                <div class="score-item-header">
                    <span class="score-item-name">${this.getCategoryName(check.id)}</span>
                    <span class="score-item-value" style="color: ${this.getScoreColor(check.score * 10)}">
                        ${check.score}/10
                    </span>
                </div>
                
                <div class="score-bar">
                    <div class="score-bar-fill" style="width: ${check.score * 10}%; background: ${this.getScoreColor(check.score * 10)}"></div>
                </div>
                
                ${check.metrics && Object.keys(check.metrics).length > 0 ? `
                <div style="margin: 10px 0; padding: 10px; background: #f9fafb; border-radius: 6px;">
                    <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px;">측정값</div>
                    ${Object.entries(check.metrics).map(([key, value]) => `
                        <div style="font-size: 11px; color: #4b5563;">• ${key}: ${value}</div>
                    `).join('')}
                </div>
                ` : ''}
                
                ${check.evidence && check.evidence.screenshots && check.evidence.screenshots.length > 0 ? `
                <div style="margin: 10px 0;">
                    <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px;">근거 스크린샷</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px;">
                        ${check.evidence.screenshots.slice(0, 3).map((screenshot: any) => `
                            ${screenshot.screenshot ? `
                            <div style="border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden;">
                                <img src="${screenshot.screenshot}" style="width: 100%; height: 80px; object-fit: cover;" alt="Evidence">
                                ${screenshot.text ? `<div style="font-size: 10px; padding: 2px 4px; background: #f9fafb; color: #6b7280;">${screenshot.text}</div>` : ''}
                            </div>
                            ` : ''}
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                ${check.insights && check.insights.length > 0 ? `
                <div class="score-item-insights" style="margin-top: 10px; padding: 10px; background: #fef3c7; border-radius: 6px;">
                    <div style="font-size: 12px; font-weight: 600; color: #92400e; margin-bottom: 5px;">💡 개선점</div>
                    ${check.insights.slice(0, 3).map(insight => `
                        <div style="font-size: 11px; color: #78350f; margin: 3px 0;">• ${insight}</div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
            `).join('')}
        </div>
        
        ${result.purchaseFlow ? `
        <!-- 구매 플로우 페이지 -->
        <div class="page">
            <h2 class="page-title">구매 플로우 분석</h2>
            
            <div style="margin-top: 30px;">
                ${['home', 'category', 'product', 'cart', 'checkout'].map(step => {
                  const stepData = result.purchaseFlow && result.purchaseFlow[step as keyof typeof result.purchaseFlow];
                  if (!stepData) return '';
                  
                  return `
                  <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
                      <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
                          ${step.charAt(0).toUpperCase() + step.slice(1)}
                      </h3>
                      <div style="font-size: 14px; font-weight: 600; color: ${stepData.exists ? '#10b981' : '#ef4444'}">
                          ${stepData.exists ? '✓ 확인됨' : '✗ 미확인'}
                      </div>
                      ${stepData.url ? `
                      <div style="font-size: 12px; color: #6b7280; margin-top: 5px; word-break: break-all;">
                          ${stepData.url}
                      </div>
                      ` : ''}
                  </div>
                  `;
                }).join('')}
            </div>
        </div>
        ` : ''}
        
        ${result.screenshots?.main ? `
        <!-- 스크린샷 페이지 -->
        <div class="page">
            <h2 class="page-title">홈페이지 스크린샷</h2>
            
            <div class="screenshot-section">
                <div class="screenshot-container">
                    <img src="${this.getScreenshotDataUrl(result.screenshots.main)}" 
                         alt="홈페이지 메인 스크린샷" 
                         class="screenshot-image" />
                    <div class="screenshot-caption">메인 페이지 전체 화면</div>
                </div>
            </div>
            
            ${result.evidenceScreenshots ? `
                <h3 style="font-size: 20px; margin-top: 40px; margin-bottom: 20px;">주요 요소 스크린샷</h3>
                ${this.generateEvidenceScreenshots(result.evidenceScreenshots)}
            ` : ''}
        </div>
        ` : ''}
    </div>
</body>
</html>`;
  }

  private getScoreColor(score: number): string {
    if (score >= 85) return '#10b981';
    if (score >= 70) return '#3b82f6';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  private getScoreGrade(score: number): string {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Needs Work';
    return 'Critical';
  }

  private getCategoryName(id: string): string {
    const names: Record<string, string> = {
      speed: '페이지 속도',
      firstView: '퍼스트뷰',
      bi: '브랜드 아이덴티티',
      navigation: '내비게이션',
      uspPromo: 'USP/프로모션',
      visuals: '비주얼',
      trust: '신뢰 요소',
      mobile: '모바일 최적화',
      purchaseFlow: '구매 플로우',
      seoAnalytics: 'SEO/분석'
    };
    return names[id] || id;
  }

  private getScreenshotDataUrl(screenshotPath: string): string {
    // 실제 구현에서는 스크린샷 파일을 읽어서 base64로 변환해야 함
    // 여기서는 임시로 외부 URL 반환 (실제로는 로컬 파일 경로를 base64로 변환)
    if (screenshotPath.startsWith('http')) {
      return screenshotPath;
    }
    // 로컬 파일 경로인 경우 file:// 프로토콜 사용
    if (screenshotPath.startsWith('/')) {
      return `file://${screenshotPath}`;
    }
    return screenshotPath;
  }

  private generateEvidenceScreenshots(evidenceScreenshots: any): string {
    if (!evidenceScreenshots) return '';
    
    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">';
    
    // 주요 카테고리의 스크린샷만 선택적으로 표시
    const priorityCategories = ['firstView', 'bi', 'navigation', 'uspPromo'];
    let screenshotCount = 0;
    const maxScreenshots = 6;
    
    for (const category of priorityCategories) {
      if (evidenceScreenshots[category] && screenshotCount < maxScreenshots) {
        const screenshots = Array.isArray(evidenceScreenshots[category]) 
          ? evidenceScreenshots[category] 
          : [evidenceScreenshots[category]];
          
        for (const screenshot of screenshots.slice(0, 2)) {
          if (screenshotCount >= maxScreenshots) break;
          
          if (screenshot && screenshot.path) {
            html += `
              <div class="screenshot-container" style="break-inside: avoid;">
                <img src="${this.getScreenshotDataUrl(screenshot.path)}" 
                     alt="${this.getCategoryName(category)}" 
                     style="width: 100%; max-height: 200px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px;" />
                <div style="font-size: 11px; color: #6b7280; margin-top: 5px; text-align: center;">
                  ${this.getCategoryName(category)}${screenshot.label ? ` - ${screenshot.label}` : ''}
                </div>
              </div>
            `;
            screenshotCount++;
          }
        }
      }
    }
    
    html += '</div>';
    return html;
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export function createPuppeteerPDFGenerator(): PuppeteerPDFGenerator {
  return new PuppeteerPDFGenerator();
}