import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirecrawlClient } from '../firecrawl.js';

describe('FirecrawlClient', () => {
  let client: FirecrawlClient;

  beforeEach(() => {
    client = new FirecrawlClient('test-api-key');
  });

  describe('detectPlatform', () => {
    it('should detect cafe24 from URL', () => {
      expect(FirecrawlClient.detectPlatform('https://shop.cafe24shop.com')).toBe('cafe24');
      expect(FirecrawlClient.detectPlatform('https://example.cafe24.com')).toBe('cafe24');
    });

    it('should detect imweb from URL', () => {
      expect(FirecrawlClient.detectPlatform('https://shop.imweb.me')).toBe('imweb');
      expect(FirecrawlClient.detectPlatform('https://imweb-shop.com')).toBe('imweb');
    });

    it('should detect cafe24 from HTML', () => {
      const html = '<div class="ec-base-product">카페24 쇼핑몰</div>';
      expect(FirecrawlClient.detectPlatform('https://example.com', html)).toBe('cafe24');
    });

    it('should detect imweb from HTML', () => {
      const html = '<div class="im-cart-item">아임웹 쇼핑몰</div>';
      expect(FirecrawlClient.detectPlatform('https://example.com', html)).toBe('imweb');
    });

    it('should return unknown for unrecognized platforms', () => {
      expect(FirecrawlClient.detectPlatform('https://example.com')).toBe('unknown');
    });
  });

  describe('scrape', () => {
    it('should handle successful response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          html: '<html>test</html>',
          screenshot: 'base64-image',
          links: ['https://example.com/product'],
          actions: {
            screenshots: ['screenshot1', 'screenshot2'],
            urls: ['url1', 'url2']
          }
        })
      });

      const result = await client.scrape('https://example.com');
      
      expect(result.success).toBe(true);
      expect(result.data?.html).toBe('<html>test</html>');
      expect(result.data?.screenshot).toBe('base64-image');
      expect(result.data?.actions?.screenshots).toHaveLength(2);
    });

    it('should handle API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      });

      const result = await client.scrape('https://example.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Firecrawl API error: 400');
    });

    it('should handle timeout', async () => {
      const client = new FirecrawlClient('test-key', 'https://api.test.com', 100);
      
      global.fetch = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const result = await client.scrape('https://example.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should use platform-specific selectors', async () => {
      let capturedBody: any;
      
      global.fetch = vi.fn().mockImplementation((_url, options) => {
        capturedBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ html: '', screenshot: '' })
        });
      });

      await client.scrape('https://example.com', 'cafe24');
      
      expect(capturedBody.actions).toBeDefined();
      const clickActions = capturedBody.actions.filter((a: any) => a.type === 'click');
      expect(clickActions[0].selector).toContain('/product/');
    });
  });

  describe('scrapeWithFallback', () => {
    it('should use fallback when primary scrape fails', async () => {
      let callCount = 0;
      
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call fails
          return Promise.resolve({
            ok: false,
            status: 500,
            text: async () => 'Server Error'
          });
        } else {
          // Fallback succeeds
          return Promise.resolve({
            ok: true,
            json: async () => ({
              html: '<html>fallback</html>',
              screenshot: 'fallback-image'
            })
          });
        }
      });

      const result = await client.scrapeWithFallback('https://example.com');
      
      expect(callCount).toBe(2);
      expect(result.success).toBe(true);
      expect(result.data?.html).toBe('<html>fallback</html>');
    });

    it('should use fallback when no action screenshots', async () => {
      let callCount = 0;
      
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call returns no action screenshots
          return Promise.resolve({
            ok: true,
            json: async () => ({
              html: '<html>test</html>',
              screenshot: 'base64-image',
              actions: { screenshots: [], urls: [] }
            })
          });
        } else {
          // Fallback returns screenshots
          return Promise.resolve({
            ok: true,
            json: async () => ({
              html: '<html>test</html>',
              screenshot: 'base64-image',
              actions: { 
                screenshots: ['screenshot1'], 
                urls: ['url1'] 
              }
            })
          });
        }
      });

      const result = await client.scrapeWithFallback('https://example.com');
      
      expect(callCount).toBe(2);
      expect(result.success).toBe(true);
      expect(result.data?.actions?.screenshots).toHaveLength(1);
    });
  });
});