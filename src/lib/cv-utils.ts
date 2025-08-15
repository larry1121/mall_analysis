import Vibrant from 'node-vibrant';
import sharp from 'sharp';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  background: string;
  dominantColors: Array<{ color: string; population: number }>;
}

export interface ContrastResult {
  ratio: number;
  level: 'AAA' | 'AA' | 'AA Large' | 'Fail';
  passes: {
    normalAAA: boolean;
    normalAA: boolean;
    largeAAA: boolean;
    largeAA: boolean;
  };
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 이미지에서 색상 팔레트 추출
 */
export async function extractColorPalette(imageBuffer: Buffer | string): Promise<ColorPalette> {
  try {
    const vibrant = await Vibrant.from(imageBuffer).getPalette();
    
    const palette: ColorPalette = {
      primary: vibrant.Vibrant?.hex || '#000000',
      secondary: vibrant.DarkVibrant?.hex || '#000000',
      accent: vibrant.LightVibrant?.hex || '#ffffff',
      text: vibrant.DarkMuted?.hex || '#333333',
      background: vibrant.LightMuted?.hex || '#f5f5f5',
      dominantColors: []
    };

    // 모든 색상을 population 기준으로 정렬
    const allColors = [
      { name: 'Vibrant', swatch: vibrant.Vibrant },
      { name: 'DarkVibrant', swatch: vibrant.DarkVibrant },
      { name: 'LightVibrant', swatch: vibrant.LightVibrant },
      { name: 'Muted', swatch: vibrant.Muted },
      { name: 'DarkMuted', swatch: vibrant.DarkMuted },
      { name: 'LightMuted', swatch: vibrant.LightMuted }
    ];

    palette.dominantColors = allColors
      .filter(c => c.swatch)
      .map(c => ({
        color: c.swatch!.hex,
        population: c.swatch!.population
      }))
      .sort((a, b) => b.population - a.population);

    return palette;
  } catch (error) {
    console.error('Error extracting color palette:', error);
    return {
      primary: '#000000',
      secondary: '#333333',
      accent: '#666666',
      text: '#333333',
      background: '#ffffff',
      dominantColors: []
    };
  }
}

/**
 * sRGB to Linear RGB 변환
 */
function sRGBtoLinear(value: number): number {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * 상대 휘도 계산 (WCAG 2.1)
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rLinear, gLinear, bLinear] = [r, g, b].map(sRGBtoLinear);
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * HEX 색상을 RGB로 변환
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  return [
    (bigint >> 16) & 255,
    (bigint >> 8) & 255,
    bigint & 255
  ];
}

/**
 * WCAG 대비 비율 계산
 */
export function calculateContrast(foreground: string, background: string): ContrastResult {
  const [fR, fG, fB] = hexToRgb(foreground);
  const [bR, bG, bB] = hexToRgb(background);

  const lForeground = getLuminance(fR, fG, fB);
  const lBackground = getLuminance(bR, bG, bB);

  const lighter = Math.max(lForeground, lBackground);
  const darker = Math.min(lForeground, lBackground);

  const ratio = (lighter + 0.05) / (darker + 0.05);

  // WCAG 기준 평가
  const passes = {
    normalAAA: ratio >= 7,      // 일반 텍스트 AAA
    normalAA: ratio >= 4.5,     // 일반 텍스트 AA
    largeAAA: ratio >= 4.5,     // 큰 텍스트 AAA
    largeAA: ratio >= 3         // 큰 텍스트 AA
  };

  let level: ContrastResult['level'] = 'Fail';
  if (passes.normalAAA) {
    level = 'AAA';
  } else if (passes.normalAA) {
    level = 'AA';
  } else if (passes.largeAA) {
    level = 'AA Large';
  }

  return { ratio, level, passes };
}

/**
 * HTML에서 alt 텍스트 비율 계산
 */
export function calculateAltRatio(html: string): {
  ratio: number;
  totalImages: number;
  imagesWithAlt: number;
  missingAltImages: string[];
} {
  const $ = cheerio.load(html);
  const images = $('img');
  const totalImages = images.length;
  
  let imagesWithAlt = 0;
  const missingAltImages: string[] = [];

  images.each((_, el) => {
    const $img = $(el);
    const alt = $img.attr('alt');
    const src = $img.attr('src') || $img.attr('data-src') || '';
    
    if (alt && alt.trim() !== '') {
      imagesWithAlt++;
    } else {
      missingAltImages.push(src);
    }
  });

  const ratio = totalImages > 0 ? imagesWithAlt / totalImages : 1;

  return {
    ratio,
    totalImages,
    imagesWithAlt,
    missingAltImages: missingAltImages.slice(0, 10) // 최대 10개만
  };
}

/**
 * Above-the-fold 판단
 */
export function isAboveTheFold(
  bbox: BoundingBox,
  viewportHeight: number = 812 // iPhone X 기준
): boolean {
  return bbox.y + bbox.height <= viewportHeight;
}

/**
 * 요소 간 거리 계산
 */
export function calculateDistance(bbox1: BoundingBox, bbox2: BoundingBox): number {
  const centerX1 = bbox1.x + bbox1.width / 2;
  const centerY1 = bbox1.y + bbox1.height / 2;
  const centerX2 = bbox2.x + bbox2.width / 2;
  const centerY2 = bbox2.y + bbox2.height / 2;

  return Math.sqrt(
    Math.pow(centerX2 - centerX1, 2) + 
    Math.pow(centerY2 - centerY1, 2)
  );
}

/**
 * 브랜드 색상 재사용률 계산
 */
export async function calculateColorReuse(
  imageBuffer: Buffer,
  primaryColor: string,
  threshold: number = 30 // Delta E 임계값
): Promise<number> {
  try {
    // 이미지를 리사이즈하여 성능 최적화
    const resized = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = resized;
    const pixelCount = info.width * info.height;
    const [pR, pG, pB] = hexToRgb(primaryColor);

    let matchingPixels = 0;

    // 각 픽셀을 순회하며 Primary 색상과 유사한 픽셀 카운트
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 간단한 RGB 거리 계산 (정확한 Delta E 대신 성능 우선)
      const distance = Math.sqrt(
        Math.pow(r - pR, 2) +
        Math.pow(g - pG, 2) +
        Math.pow(b - pB, 2)
      );

      if (distance <= threshold) {
        matchingPixels++;
      }
    }

    return matchingPixels / pixelCount;
  } catch (error) {
    console.error('Error calculating color reuse:', error);
    return 0;
  }
}

/**
 * 스크린샷에서 특정 영역 추출
 */
export async function extractRegion(
  imageBuffer: Buffer,
  bbox: BoundingBox
): Promise<Buffer> {
  try {
    return await sharp(imageBuffer)
      .extract({
        left: Math.round(bbox.x),
        top: Math.round(bbox.y),
        width: Math.round(bbox.width),
        height: Math.round(bbox.height)
      })
      .toBuffer();
  } catch (error) {
    console.error('Error extracting region:', error);
    throw error;
  }
}

/**
 * 팝업/모달 감지 휴리스틱
 */
export function detectPopups(html: string): {
  count: number;
  selectors: string[];
} {
  const $ = cheerio.load(html);
  const popupSelectors = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '.modal:visible',
    '.popup:visible',
    '.overlay:visible',
    '[class*="popup"]:visible',
    '[class*="modal"]:visible',
    '[id*="popup"]:visible',
    '[id*="modal"]:visible'
  ];

  const foundSelectors: string[] = [];
  let count = 0;

  popupSelectors.forEach(selector => {
    try {
      const elements = $(selector);
      if (elements.length > 0) {
        count += elements.length;
        foundSelectors.push(selector);
      }
    } catch (e) {
      // 잘못된 셀렉터 무시
    }
  });

  // position: fixed인 요소 중 큰 크기의 요소 찾기
  $('*').each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style') || '';
    
    if (style.includes('position: fixed') || style.includes('position:fixed')) {
      const zIndex = style.match(/z-index:\s*(\d+)/i);
      if (zIndex && parseInt(zIndex[1]) > 100) {
        count++;
        foundSelectors.push('position:fixed with high z-index');
      }
    }
  });

  return { count, selectors: foundSelectors };
}

/**
 * 타이포그래피 계층 분석
 */
export function analyzeTypographyHierarchy(html: string): {
  ratio: number;
  headingSizes: number[];
  bodySizes: number[];
} {
  const $ = cheerio.load(html);
  const headingSizes: number[] = [];
  const bodySizes: number[] = [];

  // 제목 요소 폰트 크기 수집
  $('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="heading"]').each((_, el) => {
    const $el = $(el);
    const fontSize = extractFontSize($el.attr('style') || '');
    if (fontSize > 0) {
      headingSizes.push(fontSize);
    }
  });

  // 본문 요소 폰트 크기 수집
  $('p, span, div:not([class*="title"]):not([class*="heading"])').slice(0, 20).each((_, el) => {
    const $el = $(el);
    const fontSize = extractFontSize($el.attr('style') || '');
    if (fontSize > 0) {
      bodySizes.push(fontSize);
    }
  });

  const avgHeading = headingSizes.length > 0 
    ? headingSizes.reduce((a, b) => a + b, 0) / headingSizes.length 
    : 24;
  
  const avgBody = bodySizes.length > 0 
    ? bodySizes.reduce((a, b) => a + b, 0) / bodySizes.length 
    : 16;

  const ratio = avgBody > 0 ? avgHeading / avgBody : 1.5;

  return { ratio, headingSizes, bodySizes };
}

/**
 * 스타일 문자열에서 폰트 크기 추출
 */
function extractFontSize(style: string): number {
  const match = style.match(/font-size:\s*(\d+)(?:px)?/i);
  return match ? parseInt(match[1]) : 0;
}

/**
 * 뷰포트 메타 태그 확인
 */
export function hasViewportMeta(html: string): boolean {
  const $ = cheerio.load(html);
  const viewport = $('meta[name="viewport"]');
  return viewport.length > 0 && viewport.attr('content')?.includes('width=device-width') === true;
}

/**
 * 가로 스크롤 감지 (추정)
 */
export function detectHorizontalOverflow(html: string, viewportWidth: number = 375): boolean {
  const $ = cheerio.load(html);
  let hasOverflow = false;

  // width가 뷰포트보다 큰 요소 찾기
  $('*').each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style') || '';
    const widthMatch = style.match(/width:\s*(\d+)px/i);
    
    if (widthMatch && parseInt(widthMatch[1]) > viewportWidth) {
      hasOverflow = true;
      return false; // break
    }
  });

  return hasOverflow;
}

/**
 * 최소 폰트 크기 분석
 */
export function analyzeMinFontSize(html: string): number {
  const $ = cheerio.load(html);
  let minSize = 16; // 기본값
  
  // 본문 텍스트 요소들 분석
  $('p, span, div, li, a').each((_, element) => {
    const style = $(element).attr('style');
    if (style) {
      const fontSizeMatch = style.match(/font-size:\s*(\d+(?:\.\d+)?)(px|rem|em)/i);
      if (fontSizeMatch) {
        const size = parseFloat(fontSizeMatch[1]);
        const unit = fontSizeMatch[2];
        
        let pxSize = size;
        if (unit === 'rem' || unit === 'em') {
          pxSize = size * 16; // 기본 16px 가정
        }
        
        if (pxSize < minSize && pxSize > 8) { // 8px 미만은 무시
          minSize = pxSize;
        }
      }
    }
  });
  
  return minSize;
}

/**
 * 터치 타겟 크기 분석
 */
export function analyzeMinTouchTarget(html: string): number {
  const $ = cheerio.load(html);
  let minTarget = 44; // iOS 권장 기본값
  
  // 버튼과 링크 분석
  $('button, a, input[type="button"], input[type="submit"]').each((_, element) => {
    const style = $(element).attr('style');
    if (style) {
      const heightMatch = style.match(/height:\s*(\d+)px/i);
      const widthMatch = style.match(/width:\s*(\d+)px/i);
      
      if (heightMatch) {
        const height = parseInt(heightMatch[1]);
        if (height < minTarget && height > 20) {
          minTarget = height;
        }
      }
      
      if (widthMatch) {
        const width = parseInt(widthMatch[1]);
        if (width < minTarget && width > 20) {
          minTarget = width;
        }
      }
    }
  });
  
  return minTarget;
}

/**
 * SEO 메타 데이터 분석
 */
export function analyzeSeoData(html: string): {
  title: boolean;
  metaDescription: boolean;
  ogTags: number;
  h1Count: number;
  hasAnalytics: boolean;
  canonical: boolean;
  altRatio: number;
} {
  const $ = cheerio.load(html);
  
  // 이미지 alt 비율
  const images = $('img').length;
  const imagesWithAlt = $('img[alt]').length;
  const altRatio = images > 0 ? imagesWithAlt / images : 0;
  
  return {
    title: !!$('title').text(),
    metaDescription: !!$('meta[name="description"]').attr('content'),
    ogTags: $('meta[property^="og:"]').length,
    h1Count: $('h1').length,
    hasAnalytics: html.includes('googletagmanager') || html.includes('gtag') || html.includes('fbevents'),
    canonical: !!$('link[rel="canonical"]').attr('href'),
    altRatio
  };
}

/**
 * 메뉴 및 검색 분석
 */
export function analyzeNavigation(html: string): {
  menuCount: number;
  hasSearch: boolean;
  hasBestNew: boolean;
} {
  const $ = cheerio.load(html);
  
  // 네비게이션 메뉴 찾기
  const navItems = $('nav a, .nav a, .menu a, header a');
  
  // 검색 요소 찾기
  const hasSearch = $('input[type="search"], input[type="text"][placeholder*="검색"], .search, #search').length > 0;
  
  // 베스트/신상품 카테고리 찾기
  const menuText = navItems.map((_, el) => $(el).text()).get().join(' ');
  const hasBestNew = /베스트|신상품|추천|인기|BEST|NEW/i.test(menuText);
  
  return {
    menuCount: navItems.length,
    hasSearch,
    hasBestNew
  };
}