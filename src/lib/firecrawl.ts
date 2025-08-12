import { FirecrawlRequest, FirecrawlResponse, FirecrawlAction } from '../types/index.js';

export class FirecrawlClient {
  private apiKey: string;
  private apiBase: string;
  private timeout: number;

  constructor(apiKey: string, apiBase: string = 'https://api.firecrawl.dev/v1', timeout: number = 30000) {
    this.apiKey = apiKey;
    this.apiBase = apiBase;
    this.timeout = timeout;
  }

  /**
   * 메인 scrape 메서드 - 모바일 뷰포트와 액션 포함
   */
  async scrape(url: string, platform?: 'cafe24' | 'imweb' | 'unknown'): Promise<FirecrawlResponse> {
    const actions = this.buildActions(platform);
    
    const request: FirecrawlRequest = {
      url,
      formats: ['html', 'screenshot', 'links', 'markdown'],
      device: 'mobile',
      waitFor: 1500,
      timeout: this.timeout,
      location: {
        country: 'KR',
        languages: ['ko-KR']
      },
      actions
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

      const data = await response.json();
      
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
    const baseActions: FirecrawlAction[] = [
      { type: 'wait', ms: 2000 }
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

    const selectors = platformSelectors[platform || 'unknown'];

    // 구매 플로우 액션 추가
    const flowActions: FirecrawlAction[] = [
      // Step 1: 상품 페이지로 이동
      { type: 'click', selector: selectors.product },
      { type: 'wait', ms: 1200 },
      { type: 'screenshot' },
      
      // Step 2: 장바구니로 이동
      { type: 'click', selector: selectors.cart },
      { type: 'wait', ms: 1200 },
      { type: 'screenshot' },
      
      // Step 3: 결제 페이지 진입 (진입까지만)
      { type: 'click', selector: selectors.checkout },
      { type: 'wait', ms: 1200 },
      { type: 'screenshot' }
    ];

    return [...baseActions, ...flowActions];
  }

  /**
   * Firecrawl 응답 정규화
   */
  private normalizeResponse(rawData: any): FirecrawlResponse['data'] {
    return {
      html: rawData.html || '',
      screenshot: rawData.screenshot || '',
      links: rawData.links || [],
      markdown: rawData.markdown || '',
      actions: {
        screenshots: rawData.actions?.screenshots || [],
        urls: rawData.actions?.urls || []
      }
    };
  }

  /**
   * 폴백 전략 - 액션 실패 시 최소 액션만 수행
   */
  async scrapeWithFallback(url: string, platform?: 'cafe24' | 'imweb' | 'unknown'): Promise<FirecrawlResponse> {
    // 먼저 전체 액션으로 시도
    let result = await this.scrape(url, platform);
    
    // 액션이 실패했거나 스크린샷이 부족한 경우 폴백
    if (!result.success || !result.data?.actions?.screenshots?.length) {
      console.log('Primary scrape failed or incomplete, trying fallback...');
      
      // 최소 액션으로 재시도
      const fallbackRequest: FirecrawlRequest = {
        url,
        formats: ['html', 'screenshot', 'links'],
        device: 'mobile',
        waitFor: 2000,
        timeout: this.timeout,
        location: {
          country: 'KR',
          languages: ['ko-KR']
        },
        actions: [
          { type: 'wait', ms: 2000 },
          { type: 'screenshot' },
          // 첫 번째 상품 링크만 클릭 시도
          { type: 'click', selector: "a[href*='/product']:first, a[href*='/store']:first" },
          { type: 'wait', ms: 1000 },
          { type: 'screenshot' }
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
   * 플랫폼 감지 헬퍼
   */
  static detectPlatform(url: string, html?: string): 'cafe24' | 'imweb' | 'unknown' {
    const urlLower = url.toLowerCase();
    const htmlLower = html?.toLowerCase() || '';

    // URL 패턴으로 감지
    if (urlLower.includes('cafe24') || urlLower.includes('.cafe24shop.com')) {
      return 'cafe24';
    }
    if (urlLower.includes('imweb') || urlLower.includes('.imweb.me')) {
      return 'imweb';
    }

    // HTML 내용으로 감지
    if (htmlLower.includes('cafe24') || htmlLower.includes('ec-base-') || htmlLower.includes('shop1.makeshop')) {
      return 'cafe24';
    }
    if (htmlLower.includes('imweb') || htmlLower.includes('im-') || htmlLower.includes('_im_')) {
      return 'imweb';
    }

    return 'unknown';
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