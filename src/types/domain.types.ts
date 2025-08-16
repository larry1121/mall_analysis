/**
 * 도메인 모델 타입 정의
 */

/**
 * 감사 상태
 */
export enum AuditStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * 플랫폼 타입
 */
export enum PlatformType {
  CAFE24 = 'cafe24',
  IMWEB = 'imweb',
  SHOPIFY = 'shopify',
  WOOCOMMERCE = 'woocommerce',
  MAGENTO = 'magento',
  CUSTOM = 'custom',
  UNKNOWN = 'unknown'
}

/**
 * 체크 카테고리
 */
export enum CheckCategory {
  SPEED = 'speed',
  FIRST_VIEW = 'firstView',
  BRAND_IDENTITY = 'bi',
  NAVIGATION = 'navigation',
  USP_PROMO = 'uspPromo',
  VISUALS = 'visuals',
  TRUST = 'trust',
  MOBILE = 'mobile',
  PURCHASE_FLOW = 'purchaseFlow',
  SEO_ANALYTICS = 'seoAnalytics'
}

/**
 * 등급
 */
export enum Grade {
  S = 'S',
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  F = 'F'
}

/**
 * 체크 결과 상세
 */
export interface CheckDetail {
  id: string;
  category: CheckCategory;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  message?: string;
  details?: Record<string, any>;
}

/**
 * 성능 메트릭
 */
export interface PerformanceMetrics {
  lcp: number; // Largest Contentful Paint
  fcp: number; // First Contentful Paint
  cls: number; // Cumulative Layout Shift
  tbt: number; // Total Blocking Time
  tti: number; // Time to Interactive
  si: number;  // Speed Index
  fid?: number; // First Input Delay
}

/**
 * SEO 메트릭
 */
export interface SEOMetrics {
  title?: string;
  titleLength?: number;
  description?: string;
  descriptionLength?: number;
  h1Count?: number;
  canonicalUrl?: string;
  ogTags?: Record<string, string>;
  structuredData?: any[];
  robots?: string;
  sitemap?: boolean;
}

/**
 * 접근성 메트릭
 */
export interface AccessibilityMetrics {
  score: number;
  violations: Array<{
    id: string;
    impact: 'minor' | 'moderate' | 'serious' | 'critical';
    description: string;
    nodes: number;
  }>;
}

/**
 * 스크린샷 정보
 */
export interface ScreenshotInfo {
  id: string;
  url: string;
  type: 'full' | 'viewport' | 'element';
  element?: string;
  timestamp: number;
  width: number;
  height: number;
  size?: number;
}

/**
 * 구매 플로우 단계
 */
export interface PurchaseFlowStep {
  name: string;
  url: string;
  exists: boolean;
  accessible: boolean;
  screenshot?: ScreenshotInfo;
  duration?: number;
  errors?: string[];
}

/**
 * 전문가 요약
 */
export interface ExpertSummary {
  grade: Grade;
  headline: string;
  strengths: string[];
  weaknesses: string[];
  priorities: string[];
  improvements: Array<{
    category: CheckCategory;
    priority: 'high' | 'medium' | 'low';
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
  }>;
}

/**
 * 감사 메타데이터
 */
export interface AuditMetadata {
  version: string;
  engine: string;
  timestamp: number;
  duration: number;
  platform?: PlatformType;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * 에러 상세
 */
export interface ErrorDetail {
  code: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

/**
 * 작업 진행 상태
 */
export interface JobProgress {
  current: number;
  total: number;
  percentage: number;
  message: string;
  step?: string;
  estimatedTime?: number;
}

/**
 * 리포트 옵션
 */
export interface ReportOptions {
  format: 'pdf' | 'html' | 'json' | 'csv';
  includeScreenshots: boolean;
  includeDetails: boolean;
  includeRecommendations: boolean;
  language: 'ko' | 'en';
  template?: string;
}