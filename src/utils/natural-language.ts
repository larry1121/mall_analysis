/**
 * 기술적 용어를 사용자 친화적인 자연어로 변환하는 유틸리티
 */

// 속도 메트릭을 사용자 친화적으로 변환
export function describeSpeed(value: number, metric: string): string {
  switch (metric) {
    case 'LCP':
      if (value <= 2.5) return `${value.toFixed(1)}초 (빠름 ✅)`;
      if (value <= 4.0) return `${value.toFixed(1)}초 (보통 ⚠️)`;
      return `${value.toFixed(1)}초 (느림 ❌)`;
    
    case 'CLS':
      if (value <= 0.1) return `${value.toFixed(3)} (안정적 ✅)`;
      if (value <= 0.25) return `${value.toFixed(3)} (보통 ⚠️)`;
      return `${value.toFixed(3)} (불안정 ❌)`;
    
    case 'TBT':
      if (value <= 300) return `${value}ms (반응 빠름 ✅)`;
      if (value <= 600) return `${value}ms (보통 ⚠️)`;
      return `${value}ms (반응 느림 ❌)`;
    
    default:
      return String(value);
  }
}

// bbox 좌표를 자연어로 변환
export function describeBBox(bbox: number[]): string {
  if (!bbox || bbox.length < 4) return '위치 정보 없음';
  
  const [x, y, width, height] = bbox;
  let position = '';
  
  // 수직 위치
  if (y < 200) position += '화면 상단';
  else if (y < 600) position += '화면 중간';
  else position += '화면 하단';
  
  // 수평 위치
  if (x < 100) position += ' 왼쪽';
  else if (x > 250) position += ' 오른쪽';
  else position += ' 중앙';
  
  // 크기
  const size = width * height;
  if (size > 10000) position += ' (큰 영역)';
  else if (size > 5000) position += ' (중간 영역)';
  else position += ' (작은 영역)';
  
  return position;
}

// selector를 자연어로 변환
export function describeSelector(selector: string): string {
  if (!selector) return '위치 정보 없음';
  
  const descriptions: Record<string, string> = {
    'button': '버튼',
    'input': '입력 필드',
    'nav': '네비게이션',
    'header': '헤더',
    'footer': '푸터',
    '.search': '검색 영역',
    '#logo': '로고',
    '.cart': '장바구니',
    '.buy': '구매 버튼',
    '.price': '가격 표시'
  };
  
  for (const [key, value] of Object.entries(descriptions)) {
    if (selector.includes(key)) {
      return `${value} 위치`;
    }
  }
  
  return '웹페이지 내 위치';
}

// boolean 값을 자연어로 변환
export function describeBoolean(value: boolean | undefined, trueText: string, falseText: string): string {
  if (value === undefined) return '확인 불가';
  return value ? `${trueText} ✅` : `${falseText} ❌`;
}

// 비율을 퍼센트로 변환
export function describeRatio(ratio: number | undefined, description: string): string {
  if (ratio === undefined) return `${description} 확인 불가`;
  const percent = Math.round(ratio * 100);
  
  if (percent >= 80) return `${description} ${percent}% (우수 ✅)`;
  if (percent >= 60) return `${description} ${percent}% (양호 ⚠️)`;
  return `${description} ${percent}% (개선 필요 ❌)`;
}

// 리스트를 자연어로 변환
export function describeList(items: string[] | undefined, itemType: string): string {
  if (!items || items.length === 0) return `${itemType} 없음`;
  
  if (items.length === 1) return `${items[0]}`;
  if (items.length === 2) return `${items[0]}, ${items[1]}`;
  if (items.length <= 5) return items.join(', ');
  
  return `${items.slice(0, 3).join(', ')} 외 ${items.length - 3}개`;
}

// 메뉴 개수 설명
export function describeMenuCount(count: number): string {
  if (count === 0) return '메뉴 없음 ❌';
  if (count < 3) return `메뉴 ${count}개 (너무 적음 ⚠️)`;
  if (count <= 8) return `메뉴 ${count}개 (적절함 ✅)`;
  return `메뉴 ${count}개 (너무 많음 ⚠️)`;
}

// 팝업 개수 설명
export function describePopupCount(count: number): string {
  if (count === 0) return '팝업 없음 ✅';
  if (count === 1) return '팝업 1개 (적절함 ✅)';
  if (count === 2) return '팝업 2개 (보통 ⚠️)';
  return `팝업 ${count}개 (너무 많음 ❌)`;
}

// 점수를 등급으로 변환
export function describeGrade(score: number): string {
  if (score >= 9) return 'S (최우수)';
  if (score >= 8) return 'A (우수)';
  if (score >= 7) return 'B (양호)';
  if (score >= 6) return 'C (보통)';
  if (score >= 5) return 'D (미흡)';
  return 'F (개선 필요)';
}

// 전체 점수 설명
export function describeTotalScore(score: number): string {
  if (score >= 90) return `${score}점 - 매우 우수한 사이트입니다! 🏆`;
  if (score >= 80) return `${score}점 - 우수한 사이트입니다 👍`;
  if (score >= 70) return `${score}점 - 양호한 수준입니다 😊`;
  if (score >= 60) return `${score}점 - 보통 수준입니다 🤔`;
  if (score >= 50) return `${score}점 - 개선이 필요합니다 ⚠️`;
  return `${score}점 - 많은 개선이 필요합니다 ❌`;
}

// 컬러 설명
export function describeColor(color: string): string {
  const colorNames: Record<string, string> = {
    '#FF0000': '빨강',
    '#00FF00': '초록',
    '#0000FF': '파랑',
    '#FFFF00': '노랑',
    '#FF00FF': '자주',
    '#00FFFF': '하늘',
    '#000000': '검정',
    '#FFFFFF': '흰색',
    '#808080': '회색'
  };
  
  return colorNames[color.toUpperCase()] || color;
}

// 폰트 설명
export function describeFont(font: string): string {
  const fontDescriptions: Record<string, string> = {
    'serif': '명조체',
    'sans-serif': '고딕체',
    'monospace': '고정폭 글꼴',
    'Noto Sans': '노토 산스',
    'Roboto': '로보토',
    'Arial': '에어리얼',
    'Helvetica': '헬베티카'
  };
  
  for (const [key, value] of Object.entries(fontDescriptions)) {
    if (font.includes(key)) {
      return value;
    }
  }
  
  return font;
}

// 프로모션 텍스트 정리
export function formatPromoText(text: string): string {
  // 불필요한 공백 제거
  text = text.trim().replace(/\s+/g, ' ');
  
  // 이모지 추가
  if (text.includes('%')) text = `💸 ${text}`;
  else if (text.includes('무료')) text = `🎁 ${text}`;
  else if (text.includes('할인')) text = `🏷️ ${text}`;
  else if (text.includes('이벤트')) text = `🎉 ${text}`;
  
  return text;
}

// 메트릭 이름 한글화
export function translateMetricName(name: string): string {
  const translations: Record<string, string> = {
    'LCP': '최대 콘텐츠 표시 시간',
    'CLS': '레이아웃 변경 지수',
    'TBT': '총 차단 시간',
    'FCP': '첫 콘텐츠 표시 시간',
    'TTI': '상호작용 가능 시간',
    'SI': '속도 지수'
  };
  
  return translations[name] || name;
}

// Evidence 객체를 자연어로 변환
export function describeEvidence(evidence: any): string[] {
  const descriptions: string[] = [];
  
  if (!evidence) return ['증거 데이터 없음'];
  
  // CTA 버튼
  if (evidence.cta) {
    if (evidence.cta.text) {
      descriptions.push(`"${evidence.cta.text}" 버튼이 ${describeBBox(evidence.cta.bbox)}에 있습니다`);
    }
  }
  
  // 프로모션 텍스트
  if (evidence.promoTexts && Array.isArray(evidence.promoTexts)) {
    const promos = evidence.promoTexts.map((p: any) => p.text).filter(Boolean);
    if (promos.length > 0) {
      descriptions.push(`프로모션: ${describeList(promos, '프로모션')}`);
    }
  }
  
  // 로고
  if (evidence.logo) {
    descriptions.push(`로고가 ${describeBBox(evidence.logo.bbox)}에 있습니다`);
  }
  
  // 메뉴
  if (evidence.menu) {
    descriptions.push(describeMenuCount(evidence.menuCount || evidence.menu.length));
  }
  
  // 검색
  if (evidence.searchPresent !== undefined) {
    descriptions.push(describeBoolean(evidence.searchPresent, '검색 기능 있음', '검색 기능 없음'));
  }
  
  // 결제 수단
  if (evidence.payments) {
    descriptions.push(`결제 수단: ${describeList(evidence.payments, '결제')}`);
  }
  
  // 정책
  if (evidence.policies) {
    descriptions.push(`정책: ${describeList(evidence.policies, '정책')}`);
  }
  
  // Alt 비율
  if (evidence.altRatio !== undefined) {
    descriptions.push(describeRatio(evidence.altRatio, '이미지 설명'));
  }
  
  // 팝업
  if (evidence.popups !== undefined) {
    descriptions.push(describePopupCount(evidence.popups));
  }
  
  // 모바일
  if (evidence.viewportMeta !== undefined) {
    descriptions.push(describeBoolean(evidence.viewportMeta, '모바일 최적화', '모바일 최적화 안됨'));
  }
  
  if (evidence.overflow !== undefined) {
    descriptions.push(describeBoolean(!evidence.overflow, '가로 스크롤 없음', '가로 스크롤 있음'));
  }
  
  return descriptions.length > 0 ? descriptions : ['분석 데이터 없음'];
}