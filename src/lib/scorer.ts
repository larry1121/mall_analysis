import { promises as fs } from 'fs';
import yaml from 'yaml';
import { CheckResult, LLMGraderOutput } from '../types/index.js';

interface RuleConfig {
  description?: string;
  weight?: number;
  rules: Record<string, any>;
}

interface RulesConfig {
  [key: string]: RuleConfig;
  improvements?: Record<string, Record<string, string>>;
}

export class Scorer {
  private rules: RulesConfig;
  private improvements: Record<string, Record<string, string>>;

  constructor(rules: RulesConfig) {
    this.rules = rules;
    this.improvements = rules.improvements || {};
  }

  /**
   * rules.yaml 파일에서 규칙 로드
   */
  static async fromYamlFile(filePath: string): Promise<Scorer> {
    const content = await fs.readFile(filePath, 'utf-8');
    const rules = yaml.parse(content) as RulesConfig;
    return new Scorer(rules);
  }

  /**
   * LLM 출력을 기반으로 최종 점수 계산
   */
  calculateScores(llmOutput: LLMGraderOutput): {
    totalScore: number;
    categoryScores: Record<string, number>;
    improvements: string[];
  } {
    let totalScore = 0;
    const categoryScores: Record<string, number> = {};
    const allImprovements: string[] = [];

    // 각 카테고리별 점수 계산
    for (const [category, checkResult] of Object.entries(llmOutput.scores)) {
      const score = this.calculateCategoryScore(category, checkResult);
      categoryScores[category] = score;
      totalScore += score;

      // 개선 제안 수집
      const improvements = this.getImprovements(category, checkResult);
      allImprovements.push(...improvements);
    }

    return {
      totalScore: Math.round(totalScore),
      categoryScores,
      improvements: allImprovements
    };
  }

  /**
   * 개별 카테고리 점수 계산
   */
  private calculateCategoryScore(category: string, result: CheckResult): number {
    const ruleConfig = this.rules[category];
    
    if (!ruleConfig) {
      // 규칙이 없으면 LLM 점수 그대로 사용
      return result.score;
    }

    // 규칙 기반 보정이 필요한 경우
    let score = result.score;

    // 특정 카테고리별 보정 로직
    switch (category) {
      case 'speed':
        score = this.calculateSpeedScore(result);
        break;
      case 'firstView':
        score = this.calculateFirstViewScore(result);
        break;
      case 'navigation':
        score = this.calculateNavigationScore(result);
        break;
      case 'uspPromo':
        score = this.calculateUspScore(result);
        break;
      case 'visuals':
        score = this.calculateVisualsScore(result);
        break;
      case 'trust':
        score = this.calculateTrustScore(result);
        break;
      case 'mobile':
        score = this.calculateMobileScore(result);
        break;
      case 'purchaseFlow':
        score = this.calculatePurchaseFlowScore(result);
        break;
      case 'seoAnalytics':
        score = this.calculateSeoScore(result);
        break;
    }

    return Math.max(0, Math.min(10, score));
  }

  /**
   * 속도 점수 계산 (Lighthouse 메트릭 기반)
   */
  private calculateSpeedScore(result: CheckResult): number {
    const metrics = result.metrics || {};
    let score = 10;

    // LCP 채점
    if (metrics.LCP !== undefined) {
      if (metrics.LCP <= 2.5) {
        // Good
      } else if (metrics.LCP <= 4.0) {
        score -= 1;
      } else {
        score -= 3;
      }
    }

    // CLS 채점
    if (metrics.CLS !== undefined && metrics.CLS > 0.1) {
      score -= 2;
    }

    // TBT 채점
    if (metrics.TBT !== undefined && metrics.TBT > 300) {
      score -= 2;
    }

    // 에러가 있으면 감점
    if (metrics.errors && metrics.errors > 0) {
      score -= 2;
    }

    return score;
  }

  /**
   * 퍼스트뷰 점수 계산
   */
  private calculateFirstViewScore(result: CheckResult): number {
    const evidence = result.evidence || {};
    let score = 0;

    // CTA 가시성 (5점)
    if (evidence.cta && evidence.cta.bbox) {
      score += 5;
    }

    // 히어로 프로모션 (3점)
    if (evidence.promoTexts && evidence.promoTexts.length > 0) {
      score += 3;
    }

    // 폰트 크기 (2점)
    if (evidence.fontMinPx >= 16 || !evidence.fontMinPx) {
      score += 2;
    }

    return score;
  }

  /**
   * 내비게이션 점수 계산
   */
  private calculateNavigationScore(result: CheckResult): number {
    const evidence = result.evidence || {};
    let score = 0;

    // 메뉴 개수 (4점)
    const menuCount = evidence.menuCount || evidence.menu?.length || 0;
    if (menuCount >= 3 && menuCount <= 8) {
      score += 4;
    } else if (menuCount > 0) {
      score += 2;
    }

    // 검색창 (3점)
    if (evidence.searchPresent || evidence.searchSelector) {
      score += 3;
    }

    // 베스트/신상품 섹션 (3점)
    const hasCategory = evidence.menu?.some((item: string) => 
      /베스트|신상품|추천|BEST|NEW/i.test(item)
    );
    if (hasCategory) {
      score += 3;
    }

    return score;
  }

  /**
   * USP/프로모션 점수 계산
   */
  private calculateUspScore(result: CheckResult): number {
    const evidence = result.evidence || {};
    let score = 0;

    // Above the fold (3점)
    if (evidence.aboveFold !== false) {
      score += 3;
    }

    // 대비 (3점)
    if (evidence.contrast) {
      const ratio = typeof evidence.contrast === 'number' 
        ? evidence.contrast 
        : evidence.contrast.ratio;
      
      if (ratio >= 4.5) {
        score += 3;
      } else if (ratio >= 3.0) {
        score += 2;
      } else {
        score += 1;
      }
    }

    // 폰트 크기 (1점)
    if (evidence.fontSize >= 18 || !evidence.fontSize) {
      score += 1;
    }

    // CTA 근접성 (2점)
    if (evidence.ctaNearby) {
      const distance = evidence.ctaNearby.distancePx || 1000;
      if (distance <= 300) {
        score += 2;
      } else if (distance <= 500) {
        score += 1;
      }
    }

    // 구체적 혜택 (1점)
    if (evidence.concreteBenefit || evidence.usp?.length > 0) {
      score += 1;
    }

    return score;
  }

  /**
   * 비주얼 점수 계산
   */
  private calculateVisualsScore(result: CheckResult): number {
    const evidence = result.evidence || {};
    let score = 0;

    // Alt 비율 (2점)
    const altRatio = evidence.altRatio || 0;
    if (altRatio >= 0.8) {
      score += 2;
    } else if (altRatio >= 0.6) {
      score += 1;
    }

    // 팝업 수 (3점)
    const popups = evidence.popups || 0;
    if (popups <= 1) {
      score += 3;
    } else if (popups <= 2) {
      score += 1;
    }

    // 플로우 순서 (3점)
    if (evidence.flowOrderOK !== false) {
      score += 3;
    }

    // 이미지 품질 (2점)
    if (evidence.imageQuality !== false) {
      score += 2;
    }

    return score;
  }

  /**
   * 신뢰 점수 계산
   */
  private calculateTrustScore(result: CheckResult): number {
    const evidence = result.evidence || {};
    let score = 0;

    // 리뷰/평점 (3점)
    if (evidence.reviewsOrRatings || evidence.reviews) {
      score += 3;
    }

    // 정책 (3점)
    const policies = Array.isArray(evidence.policies) ? evidence.policies : [];
    const hasPolicies = policies.length > 0 && policies.some((p: string) => 
      /교환|반품|AS|환불/i.test(p)
    );
    if (hasPolicies || policies.length >= 2) {
      score += 3;
    }

    // 결제 수단 (4점)
    const payments = Array.isArray(evidence.payments) ? evidence.payments : [];
    const hasPayments = payments.length > 0 && payments.some((p: string) => 
      /inicis|toss|naver|kakao/i.test(p)
    );
    if (hasPayments || payments.length >= 2) {
      score += 4;
    } else if (payments.length > 0) {
      score += 2;
    }

    return score;
  }

  /**
   * 모바일 점수 계산
   */
  private calculateMobileScore(result: CheckResult): number {
    const evidence = result.evidence || {};
    let score = 0;

    // Viewport 메타 (2점)
    if (evidence.viewportMeta !== false) {
      score += 2;
    }

    // 가독성 (3점)
    if (evidence.readability === 'ok' || evidence.readability !== 'poor') {
      score += 3;
    }

    // 탭 타겟 (3점)
    if (evidence.tapTargetsOK !== false) {
      score += 3;
    }

    // 오버플로우 (2점)
    if (!evidence.overflow) {
      score += 2;
    }

    return score;
  }

  /**
   * 구매 플로우 점수 계산
   */
  private calculatePurchaseFlowScore(result: any): number {
    let score = 0;
    const steps = result.steps || [];

    // PDP 도달 (3점)
    if (steps.some((s: any) => s.name === 'pdp')) {
      score += 3;
    }

    // 장바구니 도달 (3점)
    if (steps.some((s: any) => s.name === 'cart')) {
      score += 3;
    }

    // 체크아웃 진입 (3점)
    if (steps.some((s: any) => s.name === 'checkout')) {
      score += 3;
    }

    // 3단계 이내 (1점)
    if (steps.length > 0 && steps.length <= 3) {
      score += 1;
    }

    return score;
  }

  /**
   * SEO/분석 점수 계산
   */
  private calculateSeoScore(result: CheckResult): number {
    const evidence = result.evidence || {};
    let score = 0;

    // 메타 태그 (7점)
    const tags = evidence.tags || {};
    if (tags.title) score += 1;
    if (tags.description) score += 1;
    if (tags.og) score += 1;
    if (tags.h1) score += 1;
    if (tags.canonical) score += 1;
    
    // Alt 비율 (2점)
    const altRatio = tags.altRatio || evidence.altRatio || 0;
    if (altRatio >= 0.8) {
      score += 2;
    } else if (altRatio >= 0.5) {
      score += 1;
    }

    // 분석 코드 (3점)
    const analytics = evidence.analytics || [];
    if (analytics.length > 0) {
      score += 3;
    }

    return score;
  }

  /**
   * 개선 제안 생성
   */
  private getImprovements(category: string, result: CheckResult): string[] {
    const improvements: string[] = [];
    const categoryImprovements = this.improvements[category] || {};

    // LLM이 제공한 insights 추가
    if (result.insights && result.insights.length > 0) {
      improvements.push(...result.insights);
    }

    // 규칙 기반 개선 제안 추가
    const evidence = result.evidence || {};
    const metrics = result.metrics || {};

    switch (category) {
      case 'speed':
        if (metrics.LCP > 4.0) {
          improvements.push(categoryImprovements.lcp_slow || 
            '히어로 이미지 최적화 필요 (WebP/AVIF 변환, preload 추가)');
        }
        if (metrics.CLS > 0.1) {
          improvements.push(categoryImprovements.cls_high || 
            '레이아웃 시프트 개선 필요 (이미지 크기 명시)');
        }
        if (metrics.TBT > 300) {
          improvements.push(categoryImprovements.tbt_high || 
            '메인 스레드 블로킹 감소 필요 (스크립트 지연 로드)');
        }
        break;

      case 'firstView':
        if (!evidence.cta) {
          improvements.push(categoryImprovements.cta_missing || 
            'CTA 버튼을 퍼스트뷰에 배치하세요');
        }
        break;

      case 'navigation':
        if (!evidence.searchPresent) {
          improvements.push(categoryImprovements.search_missing || 
            '검색 기능을 헤더에 추가하세요');
        }
        break;

      case 'trust':
        if (!evidence.payments || evidence.payments.length === 0) {
          improvements.push(categoryImprovements.payment_missing || 
            '신뢰할 수 있는 결제 수단 로고를 표시하세요');
        }
        break;

      case 'mobile':
        if (evidence.overflow) {
          improvements.push(categoryImprovements.overflow_exists || 
            '가로 스크롤 제거 필요');
        }
        break;
    }

    // 중복 제거
    return [...new Set(improvements)].slice(0, 3);
  }
}

/**
 * 팩토리 함수
 */
export async function createScorer(rulesPath?: string): Promise<Scorer> {
  const path = rulesPath || './config/rules.yaml';
  return await Scorer.fromYamlFile(path);
}