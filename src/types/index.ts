export interface AuditRequest {
  url: string;
}

export interface AuditRun {
  runId: string;
  url: string;
  startedAt: Date;
  elapsedMs?: number;
  totalScore?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface Evidence {
  bbox?: [number, number, number, number];
  selector?: string;
  text?: string;
  screenshot?: string;
  lighthousePath?: string;
  type?: string;
}

export interface CheckResult {
  id: string;
  score: number;
  metrics?: Record<string, any>;
  evidence?: Record<string, any>;
  insights: string[];
}

export interface PurchaseFlowStep {
  name: 'home' | 'pdp' | 'cart' | 'checkout';
  url: string;
  screenshot: string;
}

export interface AuditResult extends AuditRun {
  checks: CheckResult[];
  purchaseFlow?: {
    ok: boolean;
    steps: PurchaseFlowStep[];
  };
  export?: {
    pdf?: string;
    zip?: string;
  };
}

export interface FirecrawlAction {
  type: 'wait' | 'click' | 'screenshot';
  ms?: number;
  selector?: string;
}

export interface FirecrawlRequest {
  url: string;
  formats: string[];
  device: 'mobile' | 'desktop';
  waitFor: number;
  timeout: number;
  location?: {
    country: string;
    languages: string[];
  };
  actions?: FirecrawlAction[];
}

export interface FirecrawlResponse {
  success: boolean;
  data?: {
    html?: string;
    screenshot?: string;
    links?: string[];
    markdown?: string;
    actions?: {
      screenshots?: string[];
      urls?: string[];
    };
  };
  error?: string;
}

export interface LighthouseMetrics {
  LCP: number;
  CLS: number;
  TBT: number;
  FCP?: number;
  SI?: number;
  TTI?: number;
  requests?: number;
  redirects?: number;
}

export interface LLMGraderInput {
  url: string;
  platform?: 'cafe24' | 'imweb' | 'unknown';
  html: string;
  screenshots: {
    firstView: string;
    actions?: string[];
  };
}

export interface LLMGraderOutput {
  url: string;
  scores: {
    speed: CheckResult;
    firstView: CheckResult;
    bi: CheckResult;
    navigation: CheckResult;
    uspPromo: CheckResult;
    visuals: CheckResult;
    trust: CheckResult;
    mobile: CheckResult;
    purchaseFlow: CheckResult & { ok: boolean; steps: PurchaseFlowStep[] };
    seoAnalytics: CheckResult;
  };
}