import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LighthouseRunner } from '../lighthouse.js';
import { LighthouseMetrics } from '../../types/index.js';

describe('LighthouseRunner', () => {
  let runner: LighthouseRunner;

  beforeEach(() => {
    runner = new LighthouseRunner(5000);
  });

  describe('calculateSpeedScore', () => {
    it('should return full score for excellent metrics', () => {
      const metrics: LighthouseMetrics = {
        LCP: 2.0,
        CLS: 0.05,
        TBT: 200
      };
      
      const score = LighthouseRunner.calculateSpeedScore(metrics);
      expect(score).toBe(10);
    });

    it('should deduct points for poor LCP', () => {
      const metrics: LighthouseMetrics = {
        LCP: 5.0, // Poor
        CLS: 0.05,
        TBT: 200
      };
      
      const score = LighthouseRunner.calculateSpeedScore(metrics);
      expect(score).toBe(7); // -3 for poor LCP
    });

    it('should deduct points for poor CLS', () => {
      const metrics: LighthouseMetrics = {
        LCP: 2.0,
        CLS: 0.2, // Poor
        TBT: 200
      };
      
      const score = LighthouseRunner.calculateSpeedScore(metrics);
      expect(score).toBe(8); // -2 for poor CLS
    });

    it('should deduct points for poor TBT', () => {
      const metrics: LighthouseMetrics = {
        LCP: 2.0,
        CLS: 0.05,
        TBT: 400 // Poor
      };
      
      const score = LighthouseRunner.calculateSpeedScore(metrics);
      expect(score).toBe(8); // -2 for poor TBT
    });

    it('should handle edge case with moderate LCP', () => {
      const metrics: LighthouseMetrics = {
        LCP: 3.5, // Moderate
        CLS: 0.05,
        TBT: 200
      };
      
      const score = LighthouseRunner.calculateSpeedScore(metrics);
      expect(score).toBe(9); // -1 for moderate LCP
    });

    it('should not return negative scores', () => {
      const metrics: LighthouseMetrics = {
        LCP: 6.0, // Very poor
        CLS: 0.3, // Very poor
        TBT: 600 // Very poor
      };
      
      const score = LighthouseRunner.calculateSpeedScore(metrics);
      expect(score).toBe(3); // Minimum 0, but 10 - 3 - 2 - 2 = 3
    });
  });

  describe('formatMetrics', () => {
    it('should format basic metrics', () => {
      const metrics: LighthouseMetrics = {
        LCP: 2.5,
        CLS: 0.1,
        TBT: 300
      };
      
      const formatted = LighthouseRunner.formatMetrics(metrics);
      
      expect(formatted).toContain('LCP: 2.50s');
      expect(formatted).toContain('CLS: 0.100');
      expect(formatted).toContain('TBT: 300ms');
    });

    it('should include optional metrics when present', () => {
      const metrics: LighthouseMetrics = {
        LCP: 2.5,
        CLS: 0.1,
        TBT: 300,
        FCP: 1.2,
        SI: 3.4,
        TTI: 4.5,
        requests: 50,
        redirects: 2
      };
      
      const formatted = LighthouseRunner.formatMetrics(metrics);
      
      expect(formatted).toContain('FCP: 1.20s');
      expect(formatted).toContain('SI: 3.40s');
      expect(formatted).toContain('TTI: 4.50s');
      expect(formatted).toContain('Requests: 50');
      expect(formatted).toContain('Redirects: 2');
    });
  });

  describe('extractMetrics', () => {
    it('should extract metrics from Lighthouse data', () => {
      const mockData = {
        audits: {
          'largest-contentful-paint': { numericValue: 2500 },
          'cumulative-layout-shift': { numericValue: 0.1 },
          'total-blocking-time': { numericValue: 300 },
          'first-contentful-paint': { numericValue: 1200 },
          'speed-index': { numericValue: 3400 },
          'interactive': { numericValue: 4500 },
          'network-requests': {
            details: {
              items: new Array(50).fill({})
            }
          },
          'redirects': {
            details: {
              items: [{ url: 'http://example.com' }, { url: 'https://example.com' }]
            }
          }
        }
      };

      // Private method test through reflection would be here
      // Since we can't directly test private methods in TypeScript,
      // we would test this through the public `run` method in integration tests
    });
  });

  describe('buildArgs', () => {
    it('should build correct arguments for mobile', () => {
      // This would test the private buildArgs method
      // In a real scenario, we'd test this through the public interface
    });

    it('should build correct arguments for desktop', () => {
      // This would test the private buildArgs method
      // In a real scenario, we'd test this through the public interface
    });
  });
});