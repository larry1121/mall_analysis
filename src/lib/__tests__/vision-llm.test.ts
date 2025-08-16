import { describe, it, expect, beforeEach } from 'vitest';
import { VisionLLMGrader } from '../vision-llm.js';
import { LLMGraderInput } from '../../types/index.js';

describe('VisionLLMGrader', () => {
  let grader: VisionLLMGrader;

  beforeEach(() => {
    grader = new VisionLLMGrader();
  });

  describe('gradeMock', () => {
    it('should return valid mock output', async () => {
      const input: LLMGraderInput = {
        url: 'https://example.com',
        platform: 'cafe24',
        html: '<html><body>Test</body></html>',
        screenshots: {
          firstView: 'first.png',
          actions: ['action1.png', 'action2.png']
        }
      };

      const result = await grader.gradeMock(input);

      expect(result.url).toBe(input.url);
      expect(result.scores).toBeDefined();
      expect(result.scores.speed.score).toBeGreaterThanOrEqual(0);
      expect(result.scores.speed.score).toBeLessThanOrEqual(10);
    });

    it('should include all required scoring categories', async () => {
      const input: LLMGraderInput = {
        url: 'https://example.com',
        html: '<html></html>',
        screenshots: { firstView: 'test.png' }
      };

      const result = await grader.gradeMock(input);

      expect(result.scores.speed).toBeDefined();
      expect(result.scores.firstView).toBeDefined();
      expect(result.scores.bi).toBeDefined();
      expect(result.scores.navigation).toBeDefined();
      expect(result.scores.uspPromo).toBeDefined();
      expect(result.scores.visuals).toBeDefined();
      expect(result.scores.trust).toBeDefined();
      expect(result.scores.mobile).toBeDefined();
      expect(result.scores.purchaseFlow).toBeDefined();
      expect(result.scores.seoAnalytics).toBeDefined();
    });

    it('should include evidence for each category', async () => {
      const input: LLMGraderInput = {
        url: 'https://example.com',
        html: '<html></html>',
        screenshots: { firstView: 'test.png' }
      };

      const result = await grader.gradeMock(input);

      expect(result.scores.firstView.evidence).toBeDefined();
      expect(result.scores.firstView.evidence?.cta).toBeDefined();
      expect(result.scores.firstView.evidence?.cta?.bbox).toHaveLength(4);
      
      expect(result.scores.navigation.evidence).toBeDefined();
      expect(result.scores.navigation.evidence?.searchPresent).toBe(true);
      
      expect(result.scores.mobile.evidence).toBeDefined();
      expect(result.scores.mobile.evidence?.viewportMeta).toBe(true);
    });

    it('should include insights', async () => {
      const input: LLMGraderInput = {
        url: 'https://example.com',
        html: '<html></html>',
        screenshots: { firstView: 'test.png' }
      };

      const result = await grader.gradeMock(input);

      expect(result.scores.speed.insights).toBeDefined();
      expect(Array.isArray(result.scores.speed.insights)).toBe(true);
      expect(result.scores.speed.insights.length).toBeGreaterThan(0);
    });

    it('should include purchase flow steps', async () => {
      const input: LLMGraderInput = {
        url: 'https://example.com',
        html: '<html></html>',
        screenshots: { firstView: 'test.png' }
      };

      const result = await grader.gradeMock(input);

      expect(result.scores.purchaseFlow.ok).toBeDefined();
      expect(result.scores.purchaseFlow.steps).toBeDefined();
      expect(result.scores.purchaseFlow.steps.length).toBeGreaterThan(0);
      
      const firstStep = result.scores.purchaseFlow.steps[0];
      expect(firstStep.name).toBe('home');
      expect(firstStep.url).toBeDefined();
      expect(firstStep.screenshot).toBeDefined();
    });
  });

  describe('buildSystemPrompt', () => {
    it('should include evaluation principles', () => {
      // Access private method through reflection for testing
      const prompt = (grader as any).buildSystemPrompt();
      
      expect(prompt).toContain('전자상거래');
      expect(prompt).toContain('10개 항목');
      expect(prompt).toContain('증거');
      expect(prompt).toContain('bbox');
      expect(prompt).toContain('JSON');
    });
  });

  describe('buildUserPrompt', () => {
    it('should include Korean keywords', () => {
      const input: LLMGraderInput = {
        url: 'https://example.com',
        platform: 'cafe24',
        html: '<html>Test</html>',
        screenshots: { firstView: 'test.png' }
      };

      const prompt = (grader as any).buildUserPrompt(input);
      
      expect(prompt).toContain('구매');
      expect(prompt).toContain('무료배송');
      expect(prompt).toContain('베스트');
      expect(prompt).toContain('cafe24');
    });

    it('should include scoring criteria', () => {
      const input: LLMGraderInput = {
        url: 'https://example.com',
        html: '<html>Test</html>',
        screenshots: { firstView: 'test.png' }
      };

      const prompt = (grader as any).buildUserPrompt(input);
      
      expect(prompt).toContain('LCP');
      expect(prompt).toContain('CLS');
      expect(prompt).toContain('TBT');
      expect(prompt).toContain('viewport');
      expect(prompt).toContain('alt');
    });

    it('should truncate long HTML', () => {
      const longHtml = '<html>' + 'x'.repeat(100000) + '</html>';
      const input: LLMGraderInput = {
        url: 'https://example.com',
        html: longHtml,
        screenshots: { firstView: 'test.png' }
      };

      const prompt = (grader as any).buildUserPrompt(input);
      
      expect(prompt.length).toBeLessThan(longHtml.length);
      expect(prompt).toContain('html');
    });
  });

  describe('validateEvidence', () => {
    it('should set score to 0 if no evidence', () => {
      const output = {
        scores: {
          firstView: {
            score: 8,
            evidence: {},
            insights: []
          },
          navigation: {
            score: 7,
            evidence: null,
            insights: []
          }
        }
      };

      (grader as any).validateEvidence(output);
      
      // Evidence가 비어있으면 0점 처리
      expect(output.scores.firstView.score).toBe(0);
      expect(output.scores.firstView.insights).toContain('증거 부족으로 0점 처리');
    });

    it('should not modify speed score', () => {
      const output = {
        scores: {
          speed: {
            score: 8,
            evidence: {},
            insights: []
          }
        }
      };

      const originalScore = output.scores.speed.score;
      (grader as any).validateEvidence(output);
      
      // speed는 Lighthouse 데이터 사용하므로 변경 안 함
      expect(output.scores.speed.score).toBe(originalScore);
    });
  });

  describe('normalizeScores', () => {
    it('should clamp scores to 0-10 range', () => {
      const output = {
        scores: {
          speed: { score: 15 },
          firstView: { score: -3 },
          navigation: { score: 7 }
        }
      };

      (grader as any).normalizeScores(output);
      
      expect(output.scores.speed.score).toBe(10);
      expect(output.scores.firstView.score).toBe(0);
      expect(output.scores.navigation.score).toBe(7);
    });
  });
});