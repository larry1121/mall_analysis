import { describe, it, expect, beforeEach } from 'vitest';
import { ScorerV2 } from '../scorer-v2.js';
import { LLMGraderOutput } from '../../types/index.js';

describe('ScorerV2', () => {
  let scorer: ScorerV2;

  beforeEach(() => {
    scorer = new ScorerV2();
  });

  describe('calculateScores', () => {
    it('should calculate total score correctly with different score sources', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: { id: 'speed', score: 8, insights: [] },
          firstView: { id: 'firstView', score: 9, insights: [] },
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

      const measuredData = {
        lighthouse: { LCP: 2.3, CLS: 0.05, TBT: 200, FCP: 1.5, errors: 0 },
        cv: { hasViewport: true, minFontSize: 16, minTouchTarget: 48, hasOverflow: false, altRatio: 0.8, popupCount: 1 },
        html: { 
          title: true, 
          metaDescription: true, 
          ogTags: 4, 
          h1Count: 1, 
          altRatio: 0.8, 
          hasAnalytics: true,
          menuCount: 5,
          hasSearch: true,
          minFontSize: 18
        }
      };

      const result = scorer.calculateScores(llmOutput, measuredData);
      
      expect(result.totalScore).toBeGreaterThan(60);
      expect(result.categoryScores).toBeDefined();
      expect(result.scoreSources).toBeDefined();
      expect(result.scoreSources.speed).toBe('rule');
      expect(result.scoreSources.bi).toBe('ai');
      expect(result.scoreSources.firstView).toBe('hybrid');
    });

    it('should handle missing data gracefully', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: { id: 'speed', score: 5, insights: [] },
          firstView: { id: 'firstView', score: 5, insights: [] },
          bi: { id: 'bi', score: 5, insights: [] },
          navigation: { id: 'navigation', score: 5, insights: [] },
          uspPromo: { id: 'uspPromo', score: 5, insights: [] },
          visuals: { id: 'visuals', score: 5, insights: [] },
          trust: { id: 'trust', score: 5, insights: [] },
          mobile: { id: 'mobile', score: 5, insights: [] },
          purchaseFlow: { 
            id: 'purchaseFlow', 
            score: 5, 
            ok: false,
            steps: [],
            insights: [] 
          },
          seoAnalytics: { id: 'seoAnalytics', score: 5, insights: [] }
        }
      };

      const measuredData = {}; // Empty data

      const result = scorer.calculateScores(llmOutput, measuredData);
      
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.categoryScores.speed).toBe(5); // Default for missing lighthouse data
    });
  });

  describe('Speed score calculation (rule-based)', () => {
    it('should calculate perfect speed score', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: { id: 'speed', score: 0, insights: [] },
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

      const measuredData = {
        lighthouse: { LCP: 2.0, CLS: 0.05, TBT: 200, FCP: 1.2, errors: 0 }
      };

      const result = scorer.calculateScores(llmOutput, measuredData);
      expect(result.categoryScores.speed).toBe(10);
      expect(result.scoreSources.speed).toBe('rule');
    });

    it('should deduct points for poor lighthouse metrics', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: { id: 'speed', score: 0, insights: [] },
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

      const measuredData = {
        lighthouse: { LCP: 5.0, CLS: 0.2, TBT: 500, FCP: 4.0, errors: 1 }
      };

      const result = scorer.calculateScores(llmOutput, measuredData);
      // 10 - 3(LCP>4) - 2(CLS>0.1) - 2(TBT>300) - 1(FCP>3) - 2(errors>0) = 0
      expect(result.categoryScores.speed).toBe(0);
    });
  });

  describe('Mobile score calculation (rule-based)', () => {
    it('should calculate perfect mobile score', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: { id: 'speed', score: 0, insights: [] },
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

      const measuredData = {
        cv: { 
          hasViewport: true, 
          minFontSize: 16, 
          minTouchTarget: 48, 
          hasOverflow: false 
        }
      };

      const result = scorer.calculateScores(llmOutput, measuredData);
      expect(result.categoryScores.mobile).toBe(10); // 2+3+3+2 = 10
      expect(result.scoreSources.mobile).toBe('rule');
    });
  });

  describe('Hybrid scoring', () => {
    it('should combine rule and AI scores for firstView', () => {
      const llmOutput: LLMGraderOutput = {
        url: 'https://example.com',
        scores: {
          speed: { id: 'speed', score: 0, insights: [] },
          firstView: { id: 'firstView', score: 8, insights: [] }, // AI says 8
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

      const measuredData = {
        html: { minFontSize: 18 } // Rule gives +3 points
      };

      const result = scorer.calculateScores(llmOutput, measuredData);
      // AI part: 8 * 0.7 = 5.6, Rule part: 3, Total: 8.6 rounded = 9
      expect(result.categoryScores.firstView).toBe(9);
      expect(result.scoreSources.firstView).toBe('hybrid');
    });
  });
});