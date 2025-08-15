import { LLMGraderOutput } from '../types/index.js';

/**
 * 개선된 점수 계산 시스템
 * 규칙 기반과 AI 기반을 명확히 구분
 */
export class ScorerV2 {
  /**
   * 메인 점수 계산 - 규칙 기반과 AI 기반 구분
   */
  calculateScores(llmOutput: LLMGraderOutput, measuredData: any): {
    totalScore: number;
    categoryScores: Record<string, number>;
    scoreSources: Record<string, 'rule' | 'ai' | 'hybrid'>;
  } {
    const scores: Record<string, number> = {};
    const sources: Record<string, 'rule' | 'ai' | 'hybrid'> = {};

    // 1. 완전 규칙 기반 (30점)
    scores.speed = this.calculateSpeedScore(measuredData.lighthouse);
    sources.speed = 'rule';

    scores.mobile = this.calculateMobileScore(measuredData.cv);
    sources.mobile = 'rule';

    scores.seoAnalytics = this.calculateSeoScore(measuredData.html);
    sources.seoAnalytics = 'rule';

    // 2. AI 기반 (40점)
    scores.bi = llmOutput.scores.bi?.score || 0;
    sources.bi = 'ai';

    scores.uspPromo = llmOutput.scores.uspPromo?.score || 0;
    sources.uspPromo = 'ai';

    scores.trust = llmOutput.scores.trust?.score || 0;
    sources.trust = 'ai';

    scores.purchaseFlow = llmOutput.scores.purchaseFlow?.score || 0;
    sources.purchaseFlow = 'ai';

    // 3. 하이브리드 (30점)
    scores.firstView = this.calculateFirstViewHybrid(
      llmOutput.scores.firstView,
      measuredData.html
    );
    sources.firstView = 'hybrid';

    scores.navigation = this.calculateNavigationHybrid(
      llmOutput.scores.navigation,
      measuredData.html
    );
    sources.navigation = 'hybrid';

    scores.visuals = this.calculateVisualsHybrid(
      llmOutput.scores.visuals,
      measuredData.cv
    );
    sources.visuals = 'hybrid';

    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);

    return {
      totalScore: Math.round(totalScore),
      categoryScores: scores,
      scoreSources: sources
    };
  }

  /**
   * 속도 점수 - 100% 규칙 기반 (Lighthouse)
   */
  private calculateSpeedScore(lighthouse: any): number {
    if (!lighthouse) return 5; // 기본값

    let score = 10;
    
    // LCP
    if (lighthouse.LCP > 4.0) score -= 3;
    else if (lighthouse.LCP > 2.5) score -= 1;
    
    // CLS
    if (lighthouse.CLS > 0.1) score -= 2;
    
    // TBT
    if (lighthouse.TBT > 300) score -= 2;
    
    // FCP
    if (lighthouse.FCP > 3.0) score -= 1;
    
    // Network errors
    if (lighthouse.errors > 0) score -= 2;
    
    return Math.max(0, score);
  }

  /**
   * 모바일 점수 - 100% 규칙 기반 (CV 분석)
   */
  private calculateMobileScore(cvData: any): number {
    if (!cvData) return 5;

    let score = 0;
    
    // Viewport meta (2점)
    if (cvData.hasViewport) score += 2;
    
    // 최소 폰트 크기 (3점)
    if (cvData.minFontSize >= 14) score += 3;
    else if (cvData.minFontSize >= 12) score += 1;
    
    // 터치 타겟 크기 (3점)
    if (cvData.minTouchTarget >= 44) score += 3;
    else if (cvData.minTouchTarget >= 36) score += 1;
    
    // 가로 스크롤 (2점)
    if (!cvData.hasOverflow) score += 2;
    
    return score;
  }

  /**
   * SEO 점수 - 100% 규칙 기반 (HTML 파싱)
   */
  private calculateSeoScore(htmlData: any): number {
    if (!htmlData) return 5;

    let score = 0;
    
    // 메타 태그들 (5점)
    if (htmlData.title) score += 1;
    if (htmlData.metaDescription) score += 1;
    if (htmlData.ogTags >= 3) score += 2;
    if (htmlData.h1Count === 1) score += 1;
    
    // Alt 텍스트 (2점)
    const altRatio = htmlData.altRatio || 0;
    if (altRatio >= 0.8) score += 2;
    else if (altRatio >= 0.5) score += 1;
    
    // Analytics (3점)
    if (htmlData.hasAnalytics) score += 3;
    
    return score;
  }

  /**
   * 퍼스트뷰 - 하이브리드 (AI 70% + 규칙 30%)
   */
  private calculateFirstViewHybrid(aiScore: any, htmlData: any): number {
    const aiPart = (aiScore?.score || 5) * 0.7; // AI 판단 70%
    
    // 규칙 기반 30%
    let rulePart = 0;
    if (htmlData?.minFontSize >= 16) rulePart += 3;
    
    return Math.round(aiPart + rulePart);
  }

  /**
   * 내비게이션 - 하이브리드 (규칙 70% + AI 30%)
   */
  private calculateNavigationHybrid(aiScore: any, htmlData: any): number {
    // 규칙 기반 70%
    let ruleScore = 0;
    if (htmlData?.menuCount >= 3 && htmlData?.menuCount <= 8) ruleScore += 4;
    if (htmlData?.hasSearch) ruleScore += 3;
    
    // AI 판단 30% (카테고리 구성의 적절성)
    const aiPart = (aiScore?.score || 5) * 0.3;
    
    return Math.round(ruleScore + aiPart);
  }

  /**
   * 비주얼 - 하이브리드 (규칙 50% + AI 50%)
   */
  private calculateVisualsHybrid(aiScore: any, cvData: any): number {
    // 규칙 기반 50%
    let ruleScore = 0;
    if (cvData?.altRatio >= 0.8) ruleScore += 2;
    if (cvData?.popupCount <= 1) ruleScore += 3;
    
    // AI 판단 50% (시각적 품질과 계층)
    const aiPart = (aiScore?.score || 5) * 0.5;
    
    return Math.round(ruleScore + aiPart);
  }
}

export function createScorerV2(): ScorerV2 {
  return new ScorerV2();
}