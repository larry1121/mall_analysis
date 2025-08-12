import { describe, it, expect } from 'vitest';
import {
  calculateContrast,
  calculateAltRatio,
  isAboveTheFold,
  calculateDistance,
  detectPopups,
  analyzeTypographyHierarchy,
  hasViewportMeta,
  detectHorizontalOverflow
} from '../cv-utils.js';

describe('CV Utils', () => {
  describe('calculateContrast', () => {
    it('should calculate perfect contrast (black on white)', () => {
      const result = calculateContrast('#000000', '#ffffff');
      expect(result.ratio).toBeCloseTo(21, 0);
      expect(result.level).toBe('AAA');
      expect(result.passes.normalAAA).toBe(true);
    });

    it('should calculate poor contrast (light gray on white)', () => {
      const result = calculateContrast('#cccccc', '#ffffff');
      expect(result.ratio).toBeLessThan(3);
      expect(result.level).toBe('Fail');
      expect(result.passes.normalAA).toBe(false);
    });

    it('should calculate medium contrast', () => {
      const result = calculateContrast('#666666', '#ffffff');
      expect(result.ratio).toBeGreaterThan(4.5);
      expect(result.level).toBe('AA');
      expect(result.passes.normalAA).toBe(true);
      expect(result.passes.normalAAA).toBe(false);
    });

    it('should handle large text AA', () => {
      const result = calculateContrast('#888888', '#ffffff');
      expect(result.ratio).toBeGreaterThan(3);
      expect(result.ratio).toBeLessThan(4.5);
      expect(result.level).toBe('AA Large');
      expect(result.passes.largeAA).toBe(true);
      expect(result.passes.normalAA).toBe(false);
    });
  });

  describe('calculateAltRatio', () => {
    it('should calculate alt text ratio correctly', () => {
      const html = `
        <img src="1.jpg" alt="Image 1">
        <img src="2.jpg" alt="Image 2">
        <img src="3.jpg">
        <img src="4.jpg" alt="">
      `;
      
      const result = calculateAltRatio(html);
      expect(result.totalImages).toBe(4);
      expect(result.imagesWithAlt).toBe(2);
      expect(result.ratio).toBe(0.5);
      expect(result.missingAltImages).toContain('3.jpg');
      expect(result.missingAltImages).toContain('4.jpg');
    });

    it('should handle no images', () => {
      const html = '<div>No images here</div>';
      const result = calculateAltRatio(html);
      expect(result.totalImages).toBe(0);
      expect(result.ratio).toBe(1);
    });

    it('should handle lazy-loaded images', () => {
      const html = `
        <img data-src="lazy.jpg" alt="Lazy loaded">
        <img src="regular.jpg">
      `;
      
      const result = calculateAltRatio(html);
      expect(result.totalImages).toBe(2);
      expect(result.imagesWithAlt).toBe(1);
      expect(result.missingAltImages).toContain('regular.jpg');
    });
  });

  describe('isAboveTheFold', () => {
    it('should detect above the fold elements', () => {
      const bbox = { x: 0, y: 100, width: 200, height: 100 };
      expect(isAboveTheFold(bbox, 812)).toBe(true);
    });

    it('should detect below the fold elements', () => {
      const bbox = { x: 0, y: 800, width: 200, height: 100 };
      expect(isAboveTheFold(bbox, 812)).toBe(false);
    });

    it('should handle partially visible elements', () => {
      const bbox = { x: 0, y: 750, width: 200, height: 100 };
      expect(isAboveTheFold(bbox, 812)).toBe(false);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between elements', () => {
      const bbox1 = { x: 0, y: 0, width: 100, height: 100 };
      const bbox2 = { x: 100, y: 100, width: 100, height: 100 };
      
      const distance = calculateDistance(bbox1, bbox2);
      expect(distance).toBeCloseTo(141.42, 1); // sqrt(100^2 + 100^2)
    });

    it('should return 0 for overlapping elements', () => {
      const bbox1 = { x: 50, y: 50, width: 100, height: 100 };
      const bbox2 = { x: 50, y: 50, width: 100, height: 100 };
      
      const distance = calculateDistance(bbox1, bbox2);
      expect(distance).toBe(0);
    });
  });

  describe('detectPopups', () => {
    it('should detect modal elements', () => {
      const html = `
        <div role="dialog">Modal 1</div>
        <div class="modal">Modal 2</div>
        <div id="popup-banner">Popup</div>
      `;
      
      const result = detectPopups(html);
      expect(result.count).toBeGreaterThan(0);
      expect(result.selectors).toContain('[role="dialog"]');
    });

    it('should detect fixed position with high z-index', () => {
      const html = `
        <div style="position: fixed; z-index: 9999">Overlay</div>
      `;
      
      const result = detectPopups(html);
      expect(result.count).toBeGreaterThan(0);
      expect(result.selectors.some(s => s.includes('z-index'))).toBe(true);
    });

    it('should return 0 for no popups', () => {
      const html = '<div>Regular content</div>';
      const result = detectPopups(html);
      expect(result.count).toBe(0);
    });
  });

  describe('analyzeTypographyHierarchy', () => {
    it('should analyze heading to body ratio', () => {
      const html = `
        <h1 style="font-size: 32px">Title</h1>
        <h2 style="font-size: 24px">Subtitle</h2>
        <p style="font-size: 16px">Body text</p>
        <span style="font-size: 14px">Small text</span>
      `;
      
      const result = analyzeTypographyHierarchy(html);
      expect(result.ratio).toBeGreaterThan(1.5);
      expect(result.headingSizes).toContain(32);
      expect(result.headingSizes).toContain(24);
      expect(result.bodySizes).toContain(16);
      expect(result.bodySizes).toContain(14);
    });

    it('should handle missing font sizes', () => {
      const html = '<h1>Title</h1><p>Body</p>';
      const result = analyzeTypographyHierarchy(html);
      expect(result.ratio).toBeCloseTo(1.5, 1);
    });
  });

  describe('hasViewportMeta', () => {
    it('should detect viewport meta tag', () => {
      const html = `
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
      `;
      
      expect(hasViewportMeta(html)).toBe(true);
    });

    it('should return false for missing viewport', () => {
      const html = '<head><title>No viewport</title></head>';
      expect(hasViewportMeta(html)).toBe(false);
    });

    it('should return false for incorrect viewport', () => {
      const html = '<head><meta name="viewport" content="width=1024"></head>';
      expect(hasViewportMeta(html)).toBe(false);
    });
  });

  describe('detectHorizontalOverflow', () => {
    it('should detect elements wider than viewport', () => {
      const html = '<div style="width: 500px">Wide content</div>';
      expect(detectHorizontalOverflow(html, 375)).toBe(true);
    });

    it('should not detect normal width elements', () => {
      const html = '<div style="width: 300px">Normal content</div>';
      expect(detectHorizontalOverflow(html, 375)).toBe(false);
    });

    it('should handle percentage widths', () => {
      const html = '<div style="width: 100%">Responsive content</div>';
      expect(detectHorizontalOverflow(html, 375)).toBe(false);
    });
  });
});