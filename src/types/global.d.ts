/// <reference lib="dom" />

declare global {
  interface Window {
    // Puppeteer에서 사용하는 커스텀 속성들
    __INITIAL_STATE__?: any;
    __NEXT_DATA__?: any;
    __NUXT__?: any;
    Notification?: typeof Notification;
  }
  
  // Puppeteer evaluate 함수에서 사용하는 타입들
  interface HTMLElement {
    offsetWidth: number;
    offsetHeight: number;
    offsetTop: number;
    offsetLeft: number;
  }
  
  // Navigator permissions API
  interface Navigator {
    permissions?: {
      query(options: { name: string }): Promise<PermissionStatus>;
    };
  }
  
  interface PermissionStatus {
    state: 'granted' | 'denied' | 'prompt';
  }
}

// AuditResult 확장
declare module '../types/index.js' {
  interface AuditResult {
    evidenceScreenshots?: Record<string, any>;
  }
}

export {};