import { describe, it, expect, beforeEach } from 'vitest';
import { Scorer } from '../scorer.js';
import { LLMGraderOutput } from '../../types/index.js';

describe('Scorer', () => {
  let scorer: Scorer;
  const mockRules = {
    speed: {
      description: 'Page loading performance',
      weight: 10,
      rules: {
        lcp: { thresholds: [2.5, 4.0], points: [4, 3, 1] },
        cls: { max: 0.1, points: 2 },
        tbt: { max: 300, points: 2 },
        errors: { max: 0, points: 2 }
      }
    },
    firstView: {
      description: 'First view effectiveness',
      weight: 10,
      rules: {
        ctaVisible: { required: true, points: 5 },
        heroPromo: { required: true, points: 3 },
        fontMinPx: { min: 16, points: 2 }
      }
    },
    improvements: {
      speed: {
        lcp_slow: 'Optimize hero image',
        cls_high: 'Fix layout shift',
        tbt_high: 'Reduce main thread blocking'
      },
      firstView: {
        cta_missing: 'Add CTA in first view'
      }
    }
  };

  beforeEach(() => {
    scorer = new Scorer(mockRules);
  });

  describe('calculateScores', () => {
    it('should calculate total score correctly', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: {
            id: 'speed',
            score: 8,
            metrics: { LCP: 2.3, CLS: 0.05, TBT: 200 },
            insights: []
          },
          firstView: {
            id: 'firstView',
            score: 9,
            evidence: {
              cta: { bbox: [0, 0, 100, 50] },
              promoTexts: [{ text: 'Sale' }]
            },
            insights: []
          },
          bi: { id: 'bi', score: 7, insights: [] },
          navigation: { id: 'navigation', score: 8, insights: [] },
          uspPromo: { id: 'uspPromo', score: 6, insights: [] },
          visuals: { id: 'visuals', score: 7, insights: [] },
          trust: { id: 'trust', score: 8, insights: [] },
          mobile: { id: 'mobile', score: 9, insights: [] },
          purchaseFlow: { 
            id: 'purchaseFlow', 
            score: 7, 
            ok: true,
            steps: [],
            insights: [] 
          },
          seoAnalytics: { id: 'seoAnalytics', score: 8, insights: [] }
        }
      };

      const result = scorer.calculateScores(llmOutput);
      
      expect(result.totalScore).toBe(77);
      expect(result.categoryScores).toBeDefined();
      expect(result.improvements).toBeDefined();
    });

    it('should include improvements from LLM insights', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: {
            id: 'speed',
            score: 5,
            metrics: { LCP: 5.0, CLS: 0.2, TBT: 500 },
            insights: ['Improve LCP performance']
          },
          firstView: {
            id: 'firstView',
            score: 7,
            evidence: {},
            insights: ['Make CTA more prominent']
          },
          bi: { id: 'bi', score: 7, insights: [] },
          navigation: { id: 'navigation', score: 8, insights: [] },
          uspPromo: { id: 'uspPromo', score: 6, insights: [] },
          visuals: { id: 'visuals', score: 7, insights: [] },
          trust: { id: 'trust', score: 8, insights: [] },
          mobile: { id: 'mobile', score: 9, insights: [] },
          purchaseFlow: { 
            id: 'purchaseFlow', 
            score: 7, 
            ok: true,
            steps: [],
            insights: [] 
          },
          seoAnalytics: { id: 'seoAnalytics', score: 8, insights: [] }
        }
      };

      const result = scorer.calculateScores(llmOutput);
      
      expect(result.improvements).toContain('Improve LCP performance');
      expect(result.improvements).toContain('Make CTA more prominent');
    });
  });

  describe('Speed score calculation', () => {
    it('should calculate perfect speed score', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: {
            id: 'speed',
            score: 0, // Will be recalculated
            metrics: { LCP: 2.0, CLS: 0.05, TBT: 200, errors: 0 },
            insights: []
          },
          firstView: { id: 'firstView', score: 0, insights: [] },
          bi: { id: 'bi', score: 0, insights: [] },
          navigation: { id: 'navigation', score: 0, insights: [] },
          uspPromo: { id: 'uspPromo', score: 0, insights: [] },
          visuals: { id: 'visuals', score: 0, insights: [] },
          trust: { id: 'trust', score: 0, insights: [] },
          mobile: { id: 'mobile', score: 0, insights: [] },
          purchaseFlow: { 
            id: 'purchaseFlow', 
            score: 0, 
            ok: false,
            steps: [],
            insights: [] 
          },
          seoAnalytics: { id: 'seoAnalytics', score: 0, insights: [] }
        }
      };

      const result = scorer.calculateScores(llmOutput);
      expect(result.categoryScores.speed).toBe(10);
    });

    it('should deduct points for poor metrics', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: {
            id: 'speed',
            score: 0,
            metrics: { LCP: 5.0, CLS: 0.2, TBT: 500, errors: 1 },
            insights: []
          },
          firstView: { id: 'firstView', score: 0, insights: [] },
          bi: { id: 'bi', score: 0, insights: [] },
          navigation: { id: 'navigation', score: 0, insights: [] },
          uspPromo: { id: 'uspPromo', score: 0, insights: [] },
          visuals: { id: 'visuals', score: 0, insights: [] },
          trust: { id: 'trust', score: 0, insights: [] },
          mobile: { id: 'mobile', score: 0, insights: [] },
          purchaseFlow: { 
            id: 'purchaseFlow', 
            score: 0, 
            ok: false,
            steps: [],
            insights: [] 
          },
          seoAnalytics: { id: 'seoAnalytics', score: 0, insights: [] }
        }
      };

      const result = scorer.calculateScores(llmOutput);
      // 10 - 3(LCP) - 2(CLS) - 2(TBT) - 2(errors) = 1
      expect(result.categoryScores.speed).toBe(1);
    });
  });

  describe('FirstView score calculation', () => {
    it('should give full score with all evidence', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: { id: 'speed', score: 0, insights: [] },
          firstView: {
            id: 'firstView',
            score: 0,
            evidence: {
              cta: { bbox: [0, 0, 100, 50] },
              promoTexts: [{ text: 'Sale', bbox: [0, 100, 200, 50] }],
              fontMinPx: 18
            },
            insights: []
          },
          bi: { id: 'bi', score: 0, insights: [] },
          navigation: { id: 'navigation', score: 0, insights: [] },
          uspPromo: { id: 'uspPromo', score: 0, insights: [] },
          visuals: { id: 'visuals', score: 0, insights: [] },
          trust: { id: 'trust', score: 0, insights: [] },
          mobile: { id: 'mobile', score: 0, insights: [] },
          purchaseFlow: { 
            id: 'purchaseFlow', 
            score: 0, 
            ok: false,
            steps: [],
            insights: [] 
          },
          seoAnalytics: { id: 'seoAnalytics', score: 0, insights: [] }
        }
      };

      const result = scorer.calculateScores(llmOutput);
      expect(result.categoryScores.firstView).toBe(10);
    });

    it('should deduct points for missing elements', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: { id: 'speed', score: 0, insights: [] },
          firstView: {
            id: 'firstView',
            score: 0,
            evidence: {
              fontMinPx: 14
            },
            insights: []
          },
          bi: { id: 'bi', score: 0, insights: [] },
          navigation: { id: 'navigation', score: 0, insights: [] },
          uspPromo: { id: 'uspPromo', score: 0, insights: [] },
          visuals: { id: 'visuals', score: 0, insights: [] },
          trust: { id: 'trust', score: 0, insights: [] },
          mobile: { id: 'mobile', score: 0, insights: [] },
          purchaseFlow: { 
            id: 'purchaseFlow', 
            score: 0, 
            ok: false,
            steps: [],
            insights: [] 
          },
          seoAnalytics: { id: 'seoAnalytics', score: 0, insights: [] }
        }
      };

      const result = scorer.calculateScores(llmOutput);
      // No CTA (0), no promo (0), small font (0) = 0
      expect(result.categoryScores.firstView).toBe(0);
    });
  });

  describe('Improvements generation', () => {
    it('should generate rule-based improvements', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: {
            id: 'speed',
            score: 5,
            metrics: { LCP: 5.0 },
            insights: []
          },
          firstView: {
            id: 'firstView',
            score: 5,
            evidence: {},
            insights: []
          },
          bi: { id: 'bi', score: 0, insights: [] },
          navigation: { id: 'navigation', score: 0, insights: [] },
          uspPromo: { id: 'uspPromo', score: 0, insights: [] },
          visuals: { id: 'visuals', score: 0, insights: [] },
          trust: { id: 'trust', score: 0, insights: [] },
          mobile: { id: 'mobile', score: 0, insights: [] },
          purchaseFlow: { 
            id: 'purchaseFlow', 
            score: 0, 
            ok: false,
            steps: [],
            insights: [] 
          },
          seoAnalytics: { id: 'seoAnalytics', score: 0, insights: [] }
        }
      };

      const result = scorer.calculateScores(llmOutput);
      
      expect(result.improvements.some(i => i.includes('히어로 이미지'))).toBe(true);
      expect(result.improvements.some(i => i.includes('CTA'))).toBe(true);
    });

    it('should limit improvements to 3 per category', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: {
            id: 'speed',
            score: 0,
            metrics: { LCP: 5.0, CLS: 0.3, TBT: 600 },
            insights: ['Issue 1', 'Issue 2', 'Issue 3', 'Issue 4', 'Issue 5']
          },
          firstView: { id: 'firstView', score: 0, insights: [] },
          bi: { id: 'bi', score: 0, insights: [] },
          navigation: { id: 'navigation', score: 0, insights: [] },
          uspPromo: { id: 'uspPromo', score: 0, insights: [] },
          visuals: { id: 'visuals', score: 0, insights: [] },
          trust: { id: 'trust', score: 0, insights: [] },
          mobile: { id: 'mobile', score: 0, insights: [] },
          purchaseFlow: { 
            id: 'purchaseFlow', 
            score: 0, 
            ok: false,
            steps: [],
            insights: [] 
          },
          seoAnalytics: { id: 'seoAnalytics', score: 0, insights: [] }
        }
      };

      const result = scorer.calculateScores(llmOutput);
      
      // Count improvements for speed category
      const speedImprovements = result.improvements.filter(i => 
        i.includes('Issue') || i.includes('히어로') || i.includes('레이아웃') || i.includes('스레드')
      );
      
      expect(speedImprovements.length).toBeLessThanOrEqual(3);
    });
  });
});