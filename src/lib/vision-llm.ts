import OpenAI from 'openai';
import { z } from 'zod';
import { LLMGraderInput, LLMGraderOutput, CheckResult, PurchaseFlowStep } from '../types/index.js';

// Zod 스키마 정의 - LLM 출력 검증용
const BBoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const EvidenceItemSchema = z.object({
  text: z.string().optional(),
  bbox: BBoxSchema.optional(),
  selector: z.string().optional()
});

const CheckResultSchema = z.object({
  score: z.number().min(0).max(10),
  evidence: z.record(z.any()).optional(),
  metrics: z.record(z.any()).optional(),
  insights: z.array(z.string())
});

const PurchaseFlowStepSchema = z.object({
  name: z.enum(['home', 'pdp', 'cart', 'checkout']),
  url: z.string(),
  screenshot: z.string()
});

const LLMOutputSchema = z.object({
  url: z.string(),
  scores: z.object({
    speed: CheckResultSchema,
    firstView: CheckResultSchema,
    bi: CheckResultSchema,
    navigation: CheckResultSchema,
    uspPromo: CheckResultSchema,
    visuals: CheckResultSchema,
    trust: CheckResultSchema,
    mobile: CheckResultSchema,
    purchaseFlow: CheckResultSchema.extend({
      ok: z.boolean(),
      steps: z.array(PurchaseFlowStepSchema)
    }),
    seoAnalytics: CheckResultSchema
  })
});

export class VisionLLMGrader {
  private client: OpenAI | null = null;
  private model: string;
  private maxRetries: number;

  constructor(
    apiKey?: string,
    model: string = 'gpt-4o',
    maxRetries: number = 2
  ) {
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
    this.model = model;
    this.maxRetries = maxRetries;
  }

  /**
   * 메인 그레이딩 메서드
   */
  async grade(input: LLMGraderInput): Promise<LLMGraderOutput> {
    if (!this.client) {
      throw new Error('LLM client not initialized. Provide API key.');
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 4000
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from LLM');
        }

        const parsed = JSON.parse(content);
        
        // Zod 검증
        const validated = LLMOutputSchema.parse(parsed);
        
        return validated as LLMGraderOutput;
      } catch (error) {
        lastError = error as Error;
        console.error(`LLM grading attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.maxRetries - 1) {
          await this.sleep(1000 * (attempt + 1)); // 재시도 지연
        }
      }
    }

    throw lastError || new Error('LLM grading failed after all retries');
  }

  /**
   * 시스템 프롬프트 구성
   */
  private buildSystemPrompt(): string {
    return `당신은 한국 전자상거래 첫 페이지를 평가하는 전문 그레이더입니다.

역할:
- 모바일 스크린샷과 HTML을 분석하여 10개 항목을 평가
- 각 항목 10점 만점으로 채점
- 모든 판단은 증거 기반 (bbox 좌표 또는 HTML 셀렉터/텍스트 인용)
- 증거 없는 주장은 0점 처리

평가 원칙:
1. 객관적이고 일관된 기준 적용
2. 시각적 요소는 bbox [x, y, width, height] 형식으로 위치 표시
3. HTML 요소는 셀렉터와 텍스트 인용
4. 한국어 키워드 우선 인식
5. 모바일 사용성 중심 평가

출력:
- 정확한 JSON 형식만 반환
- 추가 설명이나 주석 없음
- 모든 필드 필수 포함`;
  }

  /**
   * 유저 프롬프트 구성
   */
  private buildUserPrompt(input: LLMGraderInput): string {
    const koreanKeywords = {
      cta: ['구매', '바로구매', '장바구니', '이벤트', '쿠폰', '할인', '%', '원'],
      category: ['베스트', '신상품', '추천', '인기', 'BEST', 'NEW'],
      usp: ['무료배송', '당일배송', '정품보증', '첫구매', '회원가입', '적립', '혜택'],
      trust: ['inicis', 'tosspayments', 'naverpay', 'kakaopay', 'https', '개인정보', '교환', '반품', 'AS', '고객센터'],
      navigation: ['검색', '카테고리', '메뉴', '로그인', '마이페이지']
    };

    return `평가 대상:
- URL: ${input.url}
- 플랫폼: ${input.platform || 'unknown'}
- 스크린샷: ${input.screenshots.actions?.length || 0}개 액션 후 캡처 포함

한국어 키워드:
${JSON.stringify(koreanKeywords, null, 2)}

입력 데이터:
- HTML 길이: ${input.html.length} 글자
- 퍼스트뷰 스크린샷: 제공됨
- 액션 스크린샷: ${input.screenshots.actions?.join(', ') || '없음'}

평가 항목별 채점 기준:

1. speed (성능): Lighthouse 메트릭 기반
   - LCP ≤2.5s: 4점, ≤4.0s: 3점, >4.0s: 1점
   - CLS ≤0.1: 2점
   - TBT ≤300ms: 2점
   - 네트워크 에러 없음: 2점

2. firstView (퍼스트뷰):
   - CTA 버튼 스크롤 없이 노출 + bbox: 5점
   - 히어로 프로모션 문구 + bbox: 3점
   - 폰트 크기 ≥16px: 2점

3. bi (브랜드 아이덴티티):
   - 로고 상단 15% 내 + bbox: 3점
   - Primary 색상 재사용률 ≥60%: 4점
   - 타이포그래피 계층 명확: 3점

4. navigation (내비게이션):
   - 메뉴 3-8개: 4점
   - 검색창 존재 + selector: 3점
   - 베스트/신상품 섹션: 3점

5. uspPromo (USP/프로모션):
   - Above-the-fold 위치 + bbox: 3점
   - 텍스트 대비 ≥4.5: 3점
   - 폰트 크기 ≥18px: 1점
   - CTA 근접 ≤300px: 2점
   - 구체적 혜택 (숫자/기한): 1점

6. visuals (비주얼):
   - alt 텍스트 비율 ≥80%: 2점
   - 팝업 ≤1개: 3점
   - 콘텐츠 플로우 순서 적절: 3점
   - 이미지 품질: 2점

7. trust (신뢰):
   - 리뷰/평점 표시: 3점
   - 정책 표시 (교환/반품/AS): 3점
   - 결제 수단 로고: 4점

8. mobile (모바일):
   - viewport 메타 태그: 2점
   - 가독성: 3점
   - 탭 타겟 크기 적절: 3점
   - 가로 스크롤 없음: 2점

9. purchaseFlow (구매 플로우):
   - 홈→PDP 도달: 3점
   - PDP→장바구니 도달: 3점
   - 장바구니→결제 진입: 3점
   - 3단계 이내: 1점

10. seoAnalytics (SEO/분석):
    - 메타 태그 (title/description/og/h1/canonical): 각 1점, alt: 2점
    - 분석 코드 존재: 3점

HTML:
\`\`\`html
${input.html.substring(0, 50000)}
\`\`\`

지시사항:
1. 각 항목을 신중히 평가
2. 모든 점수에 대한 evidence 제공 (bbox, selector, text 중 하나 이상)
3. insights는 구체적 개선점 1-3개
4. 정확한 JSON 형식으로만 응답

응답 형식:
{
  "url": "평가한 URL",
  "scores": {
    "speed": {
      "score": 0-10,
      "metrics": {"LCP": 0, "CLS": 0, "TBT": 0},
      "evidence": {"lighthousePath": "경로"},
      "insights": ["개선점"]
    },
    "firstView": {
      "score": 0-10,
      "evidence": {
        "cta": {"selector": "button.buy", "bbox": [x, y, w, h], "text": "구매하기"},
        "promoTexts": [{"text": "50% 할인", "bbox": [x, y, w, h]}]
      },
      "insights": ["개선점"]
    },
    // ... 나머지 8개 항목
  }
}`;
  }

  /**
   * Anthropic Claude 사용 시 대체 구현
   */
  async gradeWithClaude(input: LLMGraderInput, apiKey: string): Promise<LLMGraderOutput> {
    // Anthropic SDK를 사용한 구현
    // 비슷한 로직이지만 Claude의 API 형식에 맞춤
    throw new Error('Claude implementation not yet available');
  }

  /**
   * 로컬 모델 사용 시 대체 구현 (Ollama 등)
   */
  async gradeWithLocalModel(input: LLMGraderInput): Promise<LLMGraderOutput> {
    // 로컬 모델 API 호출
    throw new Error('Local model implementation not yet available');
  }

  /**
   * 증거 강제 검증
   */
  private validateEvidence(output: any): boolean {
    // 각 항목이 최소한 하나의 증거를 가지고 있는지 확인
    for (const [key, value] of Object.entries(output.scores)) {
      if (key === 'speed') continue; // speed는 Lighthouse 데이터 사용
      
      const check = value as any;
      if (!check.evidence || Object.keys(check.evidence).length === 0) {
        console.warn(`No evidence for ${key}, setting score to 0`);
        check.score = 0;
        check.insights.push('증거 부족으로 0점 처리');
      }
    }
    return true;
  }

  /**
   * 점수 정규화 (0-10 범위 강제)
   */
  private normalizeScores(output: any): void {
    for (const [key, value] of Object.entries(output.scores)) {
      const check = value as any;
      check.score = Math.max(0, Math.min(10, check.score));
    }
  }

  /**
   * 헬퍼: sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Mock 그레이더 (테스트용)
   */
  async gradeMock(input: LLMGraderInput): Promise<LLMGraderOutput> {
    return {
      url: input.url,
      scores: {
        speed: {
          id: 'speed',
          score: 7,
          metrics: { LCP: 2.8, CLS: 0.05, TBT: 250 },
          evidence: { lighthousePath: 'mock/lighthouse.json' },
          insights: ['LCP를 2.5초 이하로 개선 필요']
        },
        firstView: {
          id: 'firstView',
          score: 8,
          evidence: {
            cta: { selector: 'button.buy-now', bbox: [20, 400, 335, 50], text: '바로구매' },
            promoTexts: [{ text: '신규가입 10% 할인', bbox: [20, 200, 335, 40] }]
          },
          insights: ['CTA 버튼 대비 개선 필요']
        },
        bi: {
          id: 'bi',
          score: 7,
          evidence: {
            logo: { bbox: [10, 10, 100, 40], type: 'image' },
            primaryColor: '#FF6B6B',
            reuseRatio: 0.45
          },
          insights: ['브랜드 컬러 일관성 향상 필요']
        },
        navigation: {
          id: 'navigation',
          score: 9,
          evidence: {
            menu: ['홈', '베스트', '신상품', '이벤트', '마이페이지'],
            menuCount: 5,
            searchPresent: true,
            searchSelector: 'input.search'
          },
          insights: []
        },
        uspPromo: {
          id: 'uspPromo',
          score: 8,
          evidence: {
            usp: [{ text: '무료배송', bbox: [20, 300, 100, 30] }],
            ctaNearby: { distancePx: 100, ctaText: '구매하기' }
          },
          insights: ['USP 텍스트 크기 증가 권장']
        },
        visuals: {
          id: 'visuals',
          score: 6,
          evidence: {
            altRatio: 0.7,
            popups: 2,
            flowOrderOK: true
          },
          insights: ['팝업 수 줄이기', 'alt 텍스트 보완']
        },
        trust: {
          id: 'trust',
          score: 8,
          evidence: {
            policies: ['교환', '반품'],
            payments: ['naverpay', 'kakaopay']
          },
          insights: ['AS 정책 추가 명시']
        },
        mobile: {
          id: 'mobile',
          score: 9,
          evidence: {
            viewportMeta: true,
            readability: 'ok',
            tapTargetsOK: true,
            overflow: false
          },
          insights: []
        },
        purchaseFlow: {
          id: 'purchaseFlow',
          score: 7,
          ok: true,
          steps: [
            { name: 'home', url: input.url, screenshot: 'home.png' },
            { name: 'pdp', url: `${input.url}/product/123`, screenshot: 'pdp.png' },
            { name: 'cart', url: `${input.url}/cart`, screenshot: 'cart.png' }
          ],
          evidence: {},
          insights: ['체크아웃 단계 간소화 필요']
        },
        seoAnalytics: {
          id: 'seoAnalytics',
          score: 8,
          evidence: {
            tags: { title: true, description: true, og: true, h1: true, canonical: false },
            analytics: ['googletagmanager.com', 'wcs.naver.net']
          },
          insights: ['canonical 태그 추가 필요']
        }
      }
    };
  }
}

/**
 * 팩토리 함수
 */
export function createVisionLLMGrader(): VisionLLMGrader {
  const provider = process.env.LLM_PROVIDER || 'openai';
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gpt-4o';

  if (!apiKey && process.env.NODE_ENV !== 'test') {
    console.warn('LLM_API_KEY not provided, using mock grader');
    return new VisionLLMGrader();
  }

  return new VisionLLMGrader(apiKey, model);
}