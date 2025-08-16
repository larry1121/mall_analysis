import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import archiver from 'archiver';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import { AuditResult, CheckResult } from '../types/index.js';
import { createPuppeteerPDFGenerator } from './puppeteer-pdf.js';

export interface ReportOptions {
  includeScreenshots?: boolean;
  includeRawData?: boolean;
  format?: 'pdf' | 'html' | 'json';
}

export interface BoundingBoxOverlay {
  bbox: [number, number, number, number];
  label: string;
  color?: string;
  strokeWidth?: number;
}

export class Reporter {
  private tempDir: string;

  constructor() {
    this.tempDir = join(tmpdir(), `report-${uuidv4()}`);
  }

  /**
   * 전체 리포트 생성
   */
  async generateReport(
    result: AuditResult,
    options: ReportOptions = {}
  ): Promise<{
    pdf?: Buffer;
    html?: string;
    json?: string;
    zip?: Buffer;
  }> {
    await this.ensureTempDir();

    const report: any = {};

    // JSON 리포트
    if (options.format === 'json' || !options.format) {
      report.json = JSON.stringify(result, null, 2);
    }

    // PDF 리포트
    if (options.format === 'pdf' || !options.format) {
      try {
        const pdfBuffer = await this.generatePDF(result);
        if (pdfBuffer && pdfBuffer.length > 0) {
          report.pdf = pdfBuffer;
        } else {
          console.warn('PDF generation returned empty buffer');
        }
      } catch (error) {
        console.error('PDF generation failed in generateReport:', error);
        // Continue without PDF
      }
    }

    // HTML 리포트
    if (options.format === 'html') {
      report.html = await this.generateHTML(result);
    }

    // ZIP 아카이브 (스크린샷 포함)
    if (options.includeScreenshots) {
      report.zip = await this.generateZip(result, options);
    }

    await this.cleanup();

    return report;
  }

  /**
   * PDF 리포트 생성 - Puppeteer 또는 PDFKit 사용
   */
  private async generatePDF(result: AuditResult): Promise<Buffer> {
    // 환경변수로 PDF 생성 방식 결정
    const usePuppeteerPDF = process.env.USE_PUPPETEER_PDF !== 'false';
    
    if (usePuppeteerPDF) {
      try {
        // Puppeteer를 사용한 새로운 PDF 생성 방식
        console.log('Generating PDF with Puppeteer from data...');
        const pdfGenerator = createPuppeteerPDFGenerator();
        
        // HTML 템플릿 방식을 기본으로 사용
        // React UI 방식은 현재 데이터 로딩 이슈로 비활성화
        console.log('Generating PDF with HTML template (default method)');
        return await pdfGenerator.generatePDFFromData(result);
      } catch (error) {
        console.error('Puppeteer PDF generation failed, falling back to PDFKit:', error);
        // 실패 시 PDFKit으로 폴백
        return this.generatePDFKitReport(result);
      }
    } else {
      // 기존 PDFKit 방식 사용
      return this.generatePDFKitReport(result);
    }
  }

  /**
   * 기존 PDFKit 기반 PDF 생성 (폴백용)
   */
  private async generatePDFKitReport(result: AuditResult): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `자사몰 분석 리포트 - ${result.url}`,
          Author: 'Mall Analysis POC',
          Subject: 'E-commerce Site Analysis',
          CreationDate: new Date()
        }
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // 헤더
      this.addPDFHeader(doc, result);

      // 총점 섹션
      this.addPDFScoreSection(doc, result);

      // 각 항목별 상세
      doc.addPage();
      this.addPDFDetailedScores(doc, result);

      // 구매 플로우
      if (result.purchaseFlow) {
        doc.addPage();
        this.addPDFPurchaseFlow(doc, result);
      }

      // 개선 제안
      doc.addPage();
      this.addPDFImprovements(doc, result);

      // 푸터
      this.addPDFFooter(doc);

      doc.end();
    });
  }

  /**
   * PDF 헤더 추가
   */
  private addPDFHeader(doc: PDFKit.PDFDocument, result: AuditResult): void {
    // 타이틀
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('자사몰 첫 페이지 분석 리포트', { align: 'center' });

    doc.moveDown();

    // 기본 정보
    doc.fontSize(12)
       .font('Helvetica')
       .text(`URL: ${result.url}`, { link: result.url })
       .text(`분석 일시: ${new Date(result.startedAt).toLocaleString('ko-KR')}`)
       .text(`소요 시간: ${(result.elapsedMs || 0) / 1000}초`);

    doc.moveDown(2);
  }

  /**
   * PDF 총점 섹션
   */
  private addPDFScoreSection(doc: PDFKit.PDFDocument, result: AuditResult): void {
    const totalScore = result.totalScore || 0;
    const scoreColor = this.getScoreColor(totalScore);

    // 총점 표시
    doc.fontSize(36)
       .fillColor(scoreColor)
       .text(`총점: ${totalScore}/100`, { align: 'center' });

    doc.fontSize(14)
       .fillColor('black')
       .text(this.getScoreGrade(totalScore), { align: 'center' });

    doc.moveDown(2);

    // 카테고리별 점수 차트
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('카테고리별 점수');

    doc.moveDown();

    result.checks.forEach(check => {
      const barWidth = (check.score / 10) * 400;
      const y = doc.y;

      // 카테고리 이름
      doc.fontSize(12)
         .font('Helvetica')
         .text(this.getCategoryName(check.id), 50, y);

      // 점수 바
      doc.rect(200, y, barWidth, 15)
         .fillColor(this.getScoreColor(check.score * 10))
         .fill();

      // 점수 텍스트
      doc.fillColor('black')
         .text(`${check.score}/10`, 450, y);

      doc.moveDown(0.5);
    });
  }

  /**
   * PDF 상세 점수
   */
  private addPDFDetailedScores(doc: PDFKit.PDFDocument, result: AuditResult): void {
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('상세 평가 결과');

    doc.moveDown();

    result.checks.forEach(check => {
      // 카테고리 헤더
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor(this.getScoreColor(check.score * 10))
         .text(`${this.getCategoryName(check.id)}: ${check.score}/10`);

      doc.fillColor('black')
         .fontSize(12)
         .font('Helvetica');

      // 메트릭스
      if (check.metrics && Object.keys(check.metrics).length > 0) {
        doc.text('측정값:', { underline: true });
        Object.entries(check.metrics).forEach(([key, value]) => {
          doc.text(`  • ${key}: ${value}`);
        });
        doc.moveDown(0.5);
      }

      // 인사이트
      if (check.insights && check.insights.length > 0) {
        doc.text('개선점:', { underline: true });
        check.insights.forEach(insight => {
          doc.text(`  • ${insight}`);
        });
      }

      doc.moveDown(1.5);

      // 페이지 넘침 방지
      if (doc.y > 700) {
        doc.addPage();
      }
    });
  }

  /**
   * PDF 구매 플로우
   */
  private addPDFPurchaseFlow(doc: PDFKit.PDFDocument, result: AuditResult): void {
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('구매 플로우 분석');

    doc.moveDown();

    if (!result.purchaseFlow || !result.purchaseFlow.ok) {
      doc.fontSize(14)
         .fillColor('red')
         .text('구매 플로우를 완전히 완료하지 못했습니다.');
      return;
    }

    doc.fontSize(14)
       .fillColor('green')
       .text(`✓ 구매 플로우 성공 (${result.purchaseFlow.steps.length}단계)`);

    doc.moveDown();
    doc.fillColor('black');

    result.purchaseFlow.steps.forEach((step, index) => {
      doc.fontSize(12)
         .text(`${index + 1}. ${this.getStepName(step.name)}`)
         .fontSize(10)
         .fillColor('gray')
         .text(`   URL: ${step.url}`)
         .fillColor('black');
      
      doc.moveDown(0.5);
    });
  }

  /**
   * PDF 개선 제안
   */
  private addPDFImprovements(doc: PDFKit.PDFDocument, result: AuditResult): void {
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('주요 개선 제안');

    doc.moveDown();

    const allImprovements: string[] = [];
    
    result.checks.forEach(check => {
      if (check.insights && check.insights.length > 0) {
        check.insights.forEach(insight => {
          allImprovements.push(`[${this.getCategoryName(check.id)}] ${insight}`);
        });
      }
    });

    if (allImprovements.length === 0) {
      doc.fontSize(12)
         .text('모든 항목이 우수한 수준입니다.');
      return;
    }

    // 우선순위별 정렬 (점수가 낮은 카테고리 우선)
    const sortedChecks = [...result.checks].sort((a, b) => a.score - b.score);
    
    doc.fontSize(12)
       .font('Helvetica');

    let count = 0;
    sortedChecks.forEach(check => {
      if (check.insights && check.insights.length > 0 && count < 10) {
        check.insights.slice(0, 2).forEach(insight => {
          if (count < 10) {
            doc.text(`${count + 1}. ${insight}`);
            doc.moveDown(0.5);
            count++;
          }
        });
      }
    });
  }

  /**
   * PDF 푸터
   */
  private addPDFFooter(doc: PDFKit.PDFDocument): void {
    // 푸터는 각 페이지가 추가될 때마다 추가하는 방식으로 변경
    // PDFKit의 bufferedPageRange와 switchToPage가 불안정하여 제거
    // 대신 마지막 페이지에만 간단한 푸터 추가
    doc.fontSize(10)
       .fillColor('gray')
       .text(
         '🤖 Generated with Mall Analysis POC',
         50,
         doc.page.height - 35,
         { align: 'center' }
       );
  }

  /**
   * HTML 리포트 생성
   */
  private async generateHTML(result: AuditResult): Promise<string> {
    const totalScore = result.totalScore || 0;
    const scoreGrade = this.getScoreGrade(totalScore);
    const scoreColor = this.getScoreColor(totalScore);

    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>자사몰 분석 리포트 - ${result.url}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 0; text-align: center; }
        h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .meta { opacity: 0.9; font-size: 0.9rem; }
        .score-hero { background: white; border-radius: 10px; padding: 40px; margin: 30px 0; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; }
        .total-score { font-size: 4rem; font-weight: bold; color: ${scoreColor}; }
        .score-grade { font-size: 1.5rem; color: #666; margin-top: 10px; }
        .categories { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0; }
        .category-card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.08); }
        .category-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .category-name { font-size: 1.2rem; font-weight: 600; }
        .category-score { font-size: 1.5rem; font-weight: bold; }
        .score-bar { height: 10px; background: #f0f0f0; border-radius: 5px; overflow: hidden; margin: 10px 0; }
        .score-fill { height: 100%; transition: width 0.3s; }
        .insights { margin-top: 15px; }
        .insight { background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 5px 0; font-size: 0.9rem; }
        .metrics { margin-top: 10px; font-size: 0.85rem; color: #666; }
        .metric { display: inline-block; margin-right: 15px; }
        .purchase-flow { background: white; border-radius: 10px; padding: 30px; margin: 30px 0; box-shadow: 0 5px 15px rgba(0,0,0,0.08); }
        .flow-steps { display: flex; justify-content: space-around; margin-top: 20px; }
        .flow-step { text-align: center; padding: 15px; }
        .flow-step.completed { color: #10b981; }
        .flow-step.failed { color: #ef4444; }
        footer { text-align: center; padding: 30px 0; color: #666; font-size: 0.9rem; }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <h1>자사몰 첫 페이지 분석 리포트</h1>
            <div class="meta">
                <p>${result.url}</p>
                <p>${new Date(result.startedAt).toLocaleString('ko-KR')} | ${((result.elapsedMs || 0) / 1000).toFixed(1)}초 소요</p>
            </div>
        </div>
    </header>

    <div class="container">
        <div class="score-hero">
            <div class="total-score">${totalScore}/100</div>
            <div class="score-grade">${scoreGrade}</div>
        </div>

        <div class="categories">
            ${result.checks.map(check => this.generateCategoryCard(check)).join('')}
        </div>

        ${result.purchaseFlow ? this.generatePurchaseFlowSection(result.purchaseFlow) : ''}

        <footer>
            <p>🤖 Generated with Mall Analysis POC</p>
        </footer>
    </div>
</body>
</html>`;
  }

  /**
   * HTML 카테고리 카드 생성
   */
  private generateCategoryCard(check: CheckResult): string {
    const scoreColor = this.getScoreColor(check.score * 10);
    const fillWidth = check.score * 10;

    return `
<div class="category-card">
    <div class="category-header">
        <span class="category-name">${this.getCategoryName(check.id)}</span>
        <span class="category-score" style="color: ${scoreColor}">${check.score}/10</span>
    </div>
    <div class="score-bar">
        <div class="score-fill" style="width: ${fillWidth}%; background: ${scoreColor}"></div>
    </div>
    ${check.metrics ? `
    <div class="metrics">
        ${Object.entries(check.metrics).map(([k, v]) => 
          `<span class="metric">${k}: ${v}</span>`
        ).join('')}
    </div>` : ''}
    ${check.insights && check.insights.length > 0 ? `
    <div class="insights">
        ${check.insights.map(insight => 
          `<div class="insight">💡 ${insight}</div>`
        ).join('')}
    </div>` : ''}
</div>`;
  }

  /**
   * HTML 구매 플로우 섹션
   */
  private generatePurchaseFlowSection(flow: any): string {
    return `
<div class="purchase-flow">
    <h2>구매 플로우 분석</h2>
    <div class="flow-steps">
        ${['home', 'pdp', 'cart', 'checkout'].map(stepName => {
          const step = flow.steps.find((s: any) => s.name === stepName);
          const status = step ? 'completed' : 'failed';
          return `
        <div class="flow-step ${status}">
            <div>${this.getStepName(stepName)}</div>
            <div>${status === 'completed' ? '✓' : '✗'}</div>
        </div>`;
        }).join('')}
    </div>
</div>`;
  }

  /**
   * ZIP 아카이브 생성
   */
  private async generateZip(
    result: AuditResult,
    options: ReportOptions
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('data', (chunk: any) => {
        // chunk가 Buffer가 아닐 수 있으므로 Buffer로 변환
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else if (chunk instanceof Uint8Array) {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(Buffer.from(String(chunk)));
        }
      });
      archive.on('end', () => {
        if (chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error('No data in archive'));
        }
      });
      archive.on('error', reject);

      // JSON 데이터
      archive.append(JSON.stringify(result, null, 2), { name: 'report.json' });

      // PDF 리포트 - 실패해도 ZIP 생성 계속
      try {
        if (options.format === 'pdf' || !options.format) {
          const pdf = await this.generatePDF(result);
          if (pdf && Buffer.isBuffer(pdf) && pdf.length > 0) {
            archive.append(pdf, { name: 'report.pdf' });
          } else {
            console.warn('PDF generation returned invalid or empty buffer, creating placeholder');
            // PDF 생성 실패 시 간단한 텍스트 파일로 대체
            const placeholder = Buffer.from(`PDF generation failed for ${result.url}\n\nTotal Score: ${result.totalScore}\nStatus: ${result.status}`, 'utf-8');
            archive.append(placeholder, { name: 'report_error.txt' });
          }
        }
      } catch (error) {
        console.error('Failed to generate PDF for ZIP:', error);
        // PDF 실패 시에도 에러 정보 포함
        const errorInfo = Buffer.from(`PDF generation error: ${error}\n\nURL: ${result.url}`, 'utf-8');
        archive.append(errorInfo, { name: 'pdf_error.txt' });
      }

      // HTML 리포트
      const html = await this.generateHTML(result);
      archive.append(html, { name: 'report.html' });

      // 스크린샷 (있으면)
      if (result.purchaseFlow?.steps) {
        for (const step of result.purchaseFlow.steps) {
          if (step.screenshot) {
            // 스크린샷 파일 추가 (실제 구현에서는 S3나 로컬 파일 시스템에서 가져옴)
            archive.append(`Screenshot placeholder for ${step.name}`, {
              name: `screenshots/${step.name}.png`
            });
          }
        }
      }

      archive.finalize();
    });
  }

  /**
   * 스크린샷에 bbox 오버레이 추가
   */
  async addOverlayToScreenshot(
    screenshotBuffer: Buffer,
    overlays: BoundingBoxOverlay[]
  ): Promise<Buffer> {
    const image = sharp(screenshotBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Cannot read image dimensions');
    }

    // SVG 오버레이 생성
    const svgOverlays = overlays.map(overlay => {
      const [x, y, width, height] = overlay.bbox;
      const color = overlay.color || '#FF0000';
      const strokeWidth = overlay.strokeWidth || 2;

      return `
        <rect x="${x}" y="${y}" width="${width}" height="${height}"
              fill="none" stroke="${color}" stroke-width="${strokeWidth}" />
        <text x="${x + 5}" y="${y - 5}" fill="${color}" font-size="14" font-weight="bold">
          ${overlay.label}
        </text>
      `;
    }).join('');

    const svg = `
      <svg width="${metadata.width}" height="${metadata.height}">
        ${svgOverlays}
      </svg>
    `;

    // 오버레이 합성
    return await image
      .composite([{
        input: Buffer.from(svg),
        top: 0,
        left: 0
      }])
      .toBuffer();
  }

  /**
   * 헬퍼: 점수에 따른 색상
   */
  private getScoreColor(score: number): string {
    if (score >= 85) return '#10b981'; // green
    if (score >= 70) return '#3b82f6'; // blue
    if (score >= 50) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  }

  /**
   * 헬퍼: 점수 등급
   */
  private getScoreGrade(score: number): string {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Needs Work';
    return 'Critical';
  }

  /**
   * 헬퍼: 카테고리 한글 이름
   */
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

  /**
   * 헬퍼: 스텝 한글 이름
   */
  private getStepName(name: string): string {
    const names: Record<string, string> = {
      home: '홈페이지',
      pdp: '상품 상세',
      cart: '장바구니',
      checkout: '결제'
    };
    return names[name] || name;
  }

  /**
   * 임시 디렉토리 생성
   */
  private async ensureTempDir(): Promise<void> {
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * 임시 파일 정리
   */
  private async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup temp dir:', error);
    }
  }
}