export type DetectInput = {
  url: string;
  html?: string;
  headers?: Record<string, string>;
  cookies?: string[];
  resources?: string[];
};

export type DetectResult = {
  platform: 'cafe24' | 'imweb' | 'unknown';
  confidence: number;
  signals: string[];
};

const rx = {
  // Cafe24
  cafe24Host: /(cafe24(?:shop)?\.com)/i,
  cafe24Cdn: /(img\.echosting\.cafe24\.com|cafe24img\.com|ecimg\.cafe24img\.com)/i,
  cafe24Scripts: /(cafe24_common\.js|eclog\.js|\/ind-script\/optimizer\.php)/i,
  cafe24Classes: /\bec-(?:base|list|shop|product|order)[-\w]*\b/i,
  cafe24Cookies: /^(ECSESSID|EC_MOBILE_DEVICE|SHOP_NO)=/i,
  cafe24DataAttrs: /data-ez-sdk/i,

  // Imweb
  imwebHost: /(imweb\.me|imweb\.co\.kr)/i,
  imwebCdn: /(cdn\.imweb\.me|static\.imweb\.me)/i,
  imwebScripts: /\bimweb[-_.\w]*\.(?:js|css)\b/i,
  imwebClasses: /\bim[-_x][-\w]*\b/i,
  imwebCookies: /^(imweb|iw_session|iw_|imwebsession)/i,
  imwebDataAttrs: /data-imweb-/i,
};

function scoreCafe24(input: DetectInput, signals: string[]): number {
  let s = 0;

  // URL 체크
  if (rx.cafe24Host.test(input.url)) {
    s += 0.25;
    signals.push('url:cafe24-host');
  }

  // HTML 체크
  if (input.html) {
    if (rx.cafe24Classes.test(input.html)) {
      s += 0.25;
      signals.push('html:ec-* classes');
    }
    if (rx.cafe24Scripts.test(input.html)) {
      s += 0.2;
      signals.push('html:cafe24 scripts');
    }
    if (rx.cafe24DataAttrs.test(input.html)) {
      s += 0.15;
      signals.push('html:data-ez-sdk');
    }
    if (/echosting/i.test(input.html)) {
      s += 0.1;
      signals.push('html:echosting mention');
    }
  }

  // 헤더 체크
  if (input.headers) {
    const setCookie = input.headers['set-cookie'] || input.headers['Set-Cookie'];
    if (setCookie && rx.cafe24Cookies.test(setCookie)) {
      s += 0.25;
      signals.push('header:Set-Cookie EC*');
    }
    if (/cafe24/i.test(JSON.stringify(input.headers))) {
      s += 0.1;
      signals.push('header:contains cafe24');
    }
  }

  // 쿠키 체크
  if (input.cookies) {
    if (input.cookies.some(c => rx.cafe24Cookies.test(c))) {
      s += 0.25;
      signals.push('cookie:EC*');
    }
  }

  // 리소스 체크
  if (input.resources) {
    if (input.resources.some(u => rx.cafe24Cdn.test(u))) {
      s += 0.35;
      signals.push('res:cafe24 cdn');
    }
    if (input.resources.some(u => rx.cafe24Scripts.test(u))) {
      s += 0.25;
      signals.push('res:cafe24 scripts');
    }
  }

  return s;
}

function scoreImweb(input: DetectInput, signals: string[]): number {
  let s = 0;

  // URL 체크
  if (rx.imwebHost.test(input.url)) {
    s += 0.25;
    signals.push('url:imweb-host');
  }

  // HTML 체크
  if (input.html) {
    if (rx.imwebClasses.test(input.html)) {
      s += 0.25;
      signals.push('html:im*/imx* classes');
    }
    if (rx.imwebScripts.test(input.html)) {
      s += 0.25;
      signals.push('html:imweb*.js/css');
    }
    if (rx.imwebDataAttrs.test(input.html)) {
      s += 0.15;
      signals.push('html:data-imweb-*');
    }
    if (/imweb/i.test(input.html)) {
      s += 0.1;
      signals.push('html:imweb mention');
    }
  }

  // 헤더 체크
  if (input.headers) {
    const setCookie = input.headers['set-cookie'] || input.headers['Set-Cookie'];
    if (setCookie && rx.imwebCookies.test(setCookie)) {
      s += 0.25;
      signals.push('header:Set-Cookie imweb*');
    }
    const server = input.headers['server'] || input.headers['Server'];
    if (server && /imweb/i.test(server)) {
      s += 0.2;
      signals.push('header:Server imweb');
    }
    if (/imweb/i.test(JSON.stringify(input.headers))) {
      s += 0.1;
      signals.push('header:contains imweb');
    }
  }

  // 쿠키 체크
  if (input.cookies) {
    if (input.cookies.some(c => rx.imwebCookies.test(c))) {
      s += 0.25;
      signals.push('cookie:imweb*');
    }
  }

  // 리소스 체크
  if (input.resources) {
    if (input.resources.some(u => rx.imwebCdn.test(u))) {
      s += 0.35;
      signals.push('res:imweb cdn');
    }
    if (input.resources.some(u => rx.imwebScripts.test(u))) {
      s += 0.25;
      signals.push('res:imweb scripts');
    }
  }

  return s;
}

export function detectPlatform(input: DetectInput): DetectResult {
  const cafe24Signals: string[] = [];
  const imwebSignals: string[] = [];

  const cafe24Score = scoreCafe24(input, cafe24Signals);
  const imwebScore = scoreImweb(input, imwebSignals);

  // 정규화 (최대 1.0으로 클램프)
  const cScore = Math.min(1, cafe24Score);
  const iScore = Math.min(1, imwebScore);

  if (cScore === 0 && iScore === 0) {
    return { platform: 'unknown', confidence: 0, signals: [] };
  }

  if (cScore > iScore && cScore >= 0.5) {
    return { platform: 'cafe24', confidence: cScore, signals: cafe24Signals };
  }
  
  if (iScore > cScore && iScore >= 0.5) {
    return { platform: 'imweb', confidence: iScore, signals: imwebSignals };
  }

  // 점수가 비슷하거나 둘 다 0.5 미만이면 unknown
  return {
    platform: 'unknown',
    confidence: Math.max(cScore, iScore),
    signals: cScore >= iScore 
      ? [...cafe24Signals, ...imwebSignals]
      : [...imwebSignals, ...cafe24Signals],
  };
}

/**
 * Firecrawl 응답에서 플랫폼 감지용 입력 데이터 추출
 */
export function extractDetectInput(
  url: string,
  html?: string,
  links?: string[]
): DetectInput {
  const resources: string[] = [];
  
  // HTML에서 리소스 URL 추출
  if (html) {
    // script src 추출
    const scriptMatches = html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi);
    for (const match of scriptMatches) {
      resources.push(match[1]);
    }
    
    // link href 추출 (CSS)
    const linkMatches = html.matchAll(/<link[^>]+href=["']([^"']+)["']/gi);
    for (const match of linkMatches) {
      if (match[1].includes('.css') || match[0].includes('stylesheet')) {
        resources.push(match[1]);
      }
    }
    
    // img src 추출
    const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
    for (const match of imgMatches) {
      resources.push(match[1]);
    }
  }
  
  // links에서 추가 리소스 수집
  if (links) {
    const resourcePatterns = /\.(js|css|png|jpg|jpeg|webp|gif|svg)(\?|$)/i;
    links.forEach(link => {
      if (resourcePatterns.test(link)) {
        resources.push(link);
      }
    });
  }
  
  return {
    url,
    html,
    resources: [...new Set(resources)] // 중복 제거
  };
}