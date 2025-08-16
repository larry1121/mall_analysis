import { FirecrawlRequest, FirecrawlResponse, FirecrawlAction } from '../types/index.js';
import { detectPlatform, extractDetectInput } from './platform-detector.js';

export class FirecrawlClient {
  private apiKey: string;
  private apiBase: string;
  private timeout: number;

  constructor(apiKey: string, apiBase: string = 'https://api.firecrawl.dev/v1', timeout: number = 60000) {
    this.apiKey = apiKey;
    this.apiBase = apiBase;
    this.timeout = timeout; // 기본 60초로 증가 (충분한 여유)
  }

  /**
   * 메인 scrape 메서드 - 모바일 뷰포트와 액션 포함
   */
  async scrape(url: string, platform?: 'cafe24' | 'imweb' | 'unknown'): Promise<FirecrawlResponse> {
    const actions = this.buildActions(platform);
    
    const request: FirecrawlRequest = {
      url,
      formats: ['html', 'screenshot'], // 필수 format만 요청 (부담 경감)
      waitFor: 2000, // 적절한 대기 시간
      timeout: this.timeout,
      onlyMainContent: false, // 전체 컨텐츠
      actions // 스크린샷만
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.apiBase}/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Firecrawl API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      
      // Firecrawl v1 API 응답 로깅
      console.log('Firecrawl raw response has data?:', !!data.data);
      console.log('Firecrawl raw response has screenshot?:', !!data.screenshot);
      
      // 스크린샷 확인 - data 또는 루트에 있을 수 있음
      const screenshot = data.data?.screenshot || data.screenshot;
      console.log('Screenshot found:', !!screenshot);
      if (screenshot) {
        console.log('Screenshot URL (first 100 chars):', screenshot.substring(0, 100) + '...');
      }
      
      return {
        success: true,
        data: this.normalizeResponse(data)
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Firecrawl request timeout'
          };
        }
        return {
          success: false,
          error: error.message
        };
      }
      return {
        success: false,
        error: 'Unknown error occurred'
      };
    }
  }

  /**
   * 플랫폼별 액션 시퀀스 구성
   */
  private buildActions(platform?: 'cafe24' | 'imweb' | 'unknown'): FirecrawlAction[] {
    // 스크린샷 수집 (최소한의 액션만 - 타임아웃 방지)
    const baseActions: FirecrawlAction[] = [
      { type: 'screenshot' } // 스크린샷만 - waitFor에서 충분히 대기
    ];

    // 플랫폼별 셀렉터 우선순위
    const platformSelectors = {
      cafe24: {
        product: "a[href*='/product/'], .product-link, .item-link",
        cart: "a[href*='/order/basket.html'], a[href*='/cart'], a:has-text('장바구니')",
        checkout: "a[href*='/order/order.html'], a[href*='/checkout'], a:has-text('결제')"
      },
      imweb: {
        product: "a[href*='/store'], a[href*='/product'], .shop-item a",
        cart: "a[href*='/cart'], .cart-link, a:has-text('장바구니')",
        checkout: "a[href*='/checkout'], .checkout-btn, a:has-text('결제')"
      },
      unknown: {
        product: "button:has-text('바로구매'), a:has-text('바로구매'), a[href*='/product'], .product-link",
        cart: "a[href*='/cart'], a:has-text('장바구니'), .cart-btn",
        checkout: "a[href*='checkout'], a:has-text('결제'), .checkout-btn"
      }
    };

    // const selectors = platformSelectors[platform || 'unknown'];

    // 구매 플로우 액션 추가 (간소화 - 너무 복잡하면 실패)
    // const flowActions: FirecrawlAction[] = [];
    
    // 액션을 너무 많이 추가하면 타임아웃 발생
    // 기본 스크린샷만으로도 충분한 정보 수집 가능
    
    return [...baseActions];
  }

  /**
   * Firecrawl 응답 정규화
   */
  private normalizeResponse(rawData: any): FirecrawlResponse['data'] {
    // Firecrawl v1 API response - 다양한 구조 처리
    const screenshot = rawData.data?.screenshot || rawData.screenshot || rawData.data || '';
    const html = rawData.data?.html || rawData.html || rawData.content || '';
    
    const result = {
      html: html,
      screenshot: screenshot,
      links: rawData.data?.links || rawData.links || [],
      markdown: rawData.data?.markdown || rawData.markdown || '',
      actions: {
        screenshots: rawData.data?.actions?.screenshots || rawData.actions?.screenshots || [],
        urls: rawData.data?.actions?.urls || rawData.actions?.urls || []
      }
    };
    
    console.log('Normalized response - screenshot:', result.screenshot ? 'present' : 'missing');
    if (result.screenshot && typeof result.screenshot === 'string') {
      console.log('Screenshot URL preview:', result.screenshot.substring(0, 100));
    }
    
    return result;
  }

  /**
   * 폴백 전략 - 액션 실패 시 최소 액션만 수행
   */
  async scrapeWithFallback(url: string, platform?: 'cafe24' | 'imweb' | 'unknown'): Promise<FirecrawlResponse> {
    // 먼저 전체 액션으로 시도
    let result = await this.scrape(url, platform);
    
    // 실패했거나 스크린샷이 없는 경우 폴백
    if (!result.success || !result.data?.screenshot) {
      console.log('Primary scrape failed or incomplete, trying fallback...');
      if (!result.success) {
        console.log('Firecrawl error:', result.error);
      } else if (!result.data?.screenshot) {
        console.log('No screenshot captured');
      }
      
      // 최소 요청으로 재시도 (스크린샷 포커스)
      const fallbackRequest: FirecrawlRequest = {
        url,
        formats: ['screenshot'], // 스크린샷만 요청
        waitFor: 3000, // 충분한 대기
        timeout: this.timeout,
        actions: [
          { type: 'screenshot' } // 스크린샷만
        ]
      };

      try {
        const response = await fetch(`${this.apiBase}/scrape`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fallbackRequest)
        });

        if (response.ok) {
          const data = await response.json();
          result = {
            success: true,
            data: this.normalizeResponse(data)
          };
        }
      } catch (error) {
        console.error('Fallback scrape also failed:', error);
      }
    }

    return result;
  }

  /**
   * 플랫폼 감지 헬퍼 (향상된 버전)
   */
  static detectPlatform(url: string, html?: string, links?: string[]): 'cafe24' | 'imweb' | 'unknown' {
    const input = extractDetectInput(url, html, links);
    const result = detectPlatform(input);
    
    console.log(`Platform detected: ${result.platform} (confidence: ${result.confidence.toFixed(2)})`);
    if (result.signals.length > 0) {
      console.log('Detection signals:', result.signals.join(', '));
    }
    
    return result.platform;
  }
}

// 환경변수에서 초기화하는 팩토리 함수
export function createFirecrawlClient(): FirecrawlClient {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const apiBase = process.env.FIRECRAWL_API_BASE || 'https://api.firecrawl.dev/v1';
  
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY environment variable is required');
  }

  return new FirecrawlClient(apiKey, apiBase);
}