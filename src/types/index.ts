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
  screenshots?: {
    main?: string;
    actions?: string[];
  };
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
  expertSummary?: ExpertSummary;
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
  type: 'wait' | 'click' | 'screenshot' | 'scrape' | 'scroll' | 'write' | 'press';
  milliseconds?: number;
  selector?: string;
  value?: string; // for write action
  direction?: 'up' | 'down'; // for scroll action
}

export interface FirecrawlRequest {
  url: string;
  formats?: string[];
  mobile?: boolean;
  waitFor?: number;
  timeout?: number;
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  headers?: Record<string, string>;
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

export interface ExpertSummary {
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  headline: string;
  strengths: string[];
  weaknesses: string[];
  priorities: string[];
}

export interface LLMGraderOutput {
  url: string;
  expertSummary?: ExpertSummary;
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