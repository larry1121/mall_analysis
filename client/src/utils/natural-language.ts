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
  
  // 재귀적으로 객체/배열 처리하는 헬퍼 함수
  const processValue = (value: any, key?: string): string | null => {
    if (value === null || value === undefined) return null;
    
    // 문자열이나 숫자는 그대로 반환
    if (typeof value === 'string' || typeof value === 'number') {
      return key ? `${key}: ${value}` : String(value);
    }
    
    // 불리언
    if (typeof value === 'boolean') {
      return key ? `${key}: ${value ? '✅' : '❌'}` : (value ? '✅' : '❌');
    }
    
    // 배열
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      
      // 객체 배열인 경우
      if (typeof value[0] === 'object') {
        const items = value.map(item => {
          if (item && typeof item === 'object') {
            if (item.text && item.bbox) {
              return `"${item.text}" (위치: ${describeBBox(item.bbox)})`;
            } else if (item.text) {
              return item.text;
            } else if (item.selector) {
              return item.selector;
            }
            // 객체의 첫 번째 문자열 값 반환
            const firstStringValue = Object.values(item).find(v => typeof v === 'string');
            if (firstStringValue) return firstStringValue;
          } else if (typeof item === 'string') {
            return item;
          }
          return null;
        }).filter(Boolean);
        
        if (items.length > 0) {
          return key ? `${key}: ${items.join(', ')}` : items.join(', ');
        }
      } else {
        // 단순 배열
        return key ? `${key}: ${value.join(', ')}` : value.join(', ');
      }
    }
    
    // 객체
    if (typeof value === 'object') {
      // bbox가 있는 객체
      if (value.bbox && Array.isArray(value.bbox)) {
        const text = value.text || key || '요소';
        return `${text} (위치: ${describeBBox(value.bbox)})`;
      }
      
      // selector와 text가 있는 객체
      if (value.selector && value.text) {
        return `${value.text} (위치: ${value.selector})`;
      }
      
      // text만 있는 객체
      if (value.text) {
        return value.text;
      }
      
      // countOnScreenshot 같은 특수 키 처리
      if (value.countOnScreenshot !== undefined) {
        return `${key || '개수'}: ${value.countOnScreenshot}`;
      }
      
      // 키가 너무 많은 복잡한 객체는 간단히 처리
      const keys = Object.keys(value);
      if (keys.length > 10) {
        return key ? `${key}: [복잡한 데이터]` : '[복잡한 데이터]';
      }
      
      // 기타 객체는 키-값 쌍으로 처리
      const parts: string[] = [];
      Object.entries(value).forEach(([k, v]) => {
        // screenshot, bbox 같은 긴 데이터는 건너뛰기
        if (k === 'screenshot' || k === 'localPath') return;
        
        const processed = processValue(v, k);
        if (processed && !processed.includes('[복잡한 데이터]')) {
          parts.push(processed);
        }
      });
      
      if (parts.length > 0) {
        return key ? `${key}: ${parts.join(', ')}` : parts.join(', ');
      }
    }
    
    return null;
  };
  
  // Lighthouse 경로 (Speed 카테고리)
  if (evidence.lighthousePath) {
    if (evidence.lighthousePath.includes('unavailable')) {
      descriptions.push('⚠️ Lighthouse 성능 측정 실패');
    } else {
      descriptions.push('✅ Lighthouse 성능 측정 완료');
    }
  }
  
  // CTA 버튼
  if (evidence.cta) {
    if (evidence.cta.text) {
      descriptions.push(`"${evidence.cta.text}" 버튼이 ${describeBBox(evidence.cta.bbox)}에 있습니다`);
    } else if (evidence.cta === false) {
      descriptions.push('❌ CTA 버튼을 찾을 수 없음');
    }
  }
  
  // 프로모션 텍스트
  if (evidence.promoTexts !== undefined) {
    if (Array.isArray(evidence.promoTexts) && evidence.promoTexts.length > 0) {
      const promos = evidence.promoTexts.map((p: any) => 
        typeof p === 'string' ? p : p.text
      ).filter(Boolean);
      if (promos.length > 0) {
        descriptions.push(`✅ 프로모션: ${describeList(promos, '프로모션')}`);
      }
    } else {
      descriptions.push('⚠️ 프로모션 메시지 없음');
    }
  }
  
  // 로고
  if (evidence.logo !== undefined) {
    if (evidence.logo && evidence.logo.bbox) {
      descriptions.push(`✅ 로고가 ${describeBBox(evidence.logo.bbox)}에 있습니다`);
    } else if (evidence.logo === false) {
      descriptions.push('❌ 로고를 찾을 수 없음');
    }
  }
  
  // 브랜드 색상
  if (evidence.brandColors) {
    if (Array.isArray(evidence.brandColors) && evidence.brandColors.length > 0) {
      descriptions.push(`✅ 브랜드 색상 ${evidence.brandColors.length}개 사용 중`);
    }
  }
  
  // 메뉴
  if (evidence.menu !== undefined || evidence.menuCount !== undefined) {
    let count = 0;
    
    // menuCount 처리
    if (evidence.menuCount !== undefined) {
      if (typeof evidence.menuCount === 'number') {
        count = evidence.menuCount;
      } else if (typeof evidence.menuCount === 'object' && evidence.menuCount !== null) {
        // 객체인 경우 처리
        const processed = processValue(evidence.menuCount, '메뉴');
        if (processed) {
          descriptions.push(processed);
        }
      }
    } 
    // menu 처리
    else if (evidence.menu !== undefined) {
      if (Array.isArray(evidence.menu)) {
        count = evidence.menu.length;
      } else if (typeof evidence.menu === 'object' && evidence.menu !== null) {
        // 객체인 경우 처리
        const processed = processValue(evidence.menu, '메뉴');
        if (processed) {
          descriptions.push(processed);
        }
      }
    }
    
    // 숫자 count가 있는 경우에만 describeMenuCount 호출
    if (typeof count === 'number' && count >= 0 && !descriptions.some(d => d.includes('메뉴'))) {
      descriptions.push(describeMenuCount(count));
    }
  }
  
  // 검색
  if (evidence.searchPresent !== undefined) {
    descriptions.push(describeBoolean(evidence.searchPresent, '검색 기능 있음', '검색 기능 없음'));
  }
  
  // 베스트/신상품
  if (evidence.hasBestNew !== undefined) {
    descriptions.push(describeBoolean(evidence.hasBestNew, '베스트/신상품 카테고리 있음', '베스트/신상품 카테고리 없음'));
  }
  
  // 결제 수단
  if (evidence.payments !== undefined) {
    if (Array.isArray(evidence.payments) && evidence.payments.length > 0) {
      descriptions.push(`✅ 결제 수단: ${describeList(evidence.payments, '결제')}`);
    } else {
      descriptions.push('⚠️ 결제 수단 정보 없음');
    }
  }
  
  // 정책
  if (evidence.policies !== undefined) {
    if (Array.isArray(evidence.policies) && evidence.policies.length > 0) {
      const policyTexts = evidence.policies.map(p => {
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object' && p.text) return p.text;
        if (p && typeof p === 'object') {
          // 객체의 값들을 문자열로 변환
          const values = Object.values(p).filter(v => 
            typeof v === 'string' || typeof v === 'number'
          );
          return values.join(' ');
        }
        return null;
      }).filter(Boolean);
      
      if (policyTexts.length > 0) {
        descriptions.push(`✅ 정책: ${policyTexts.join(', ')}`);
      }
    } else if (typeof evidence.policies === 'string') {
      descriptions.push(`정책: ${evidence.policies}`);
    } else if (typeof evidence.policies === 'object' && evidence.policies !== null) {
      const processed = processValue(evidence.policies, '정책');
      if (processed) descriptions.push(processed);
    } else {
      descriptions.push('⚠️ 정책 정보 없음');
    }
  }
  
  // 인증/보증
  if (evidence.certifications !== undefined) {
    if (Array.isArray(evidence.certifications) && evidence.certifications.length > 0) {
      descriptions.push(`✅ 인증: ${describeList(evidence.certifications, '인증')}`);
    }
  }
  
  // 고객 후기
  if (evidence.reviews !== undefined) {
    if (evidence.reviews === true || evidence.reviews > 0) {
      descriptions.push('✅ 고객 후기 있음');
    } else {
      descriptions.push('❌ 고객 후기 없음');
    }
  }
  
  // Alt 비율
  if (evidence.altRatio !== undefined) {
    descriptions.push(describeRatio(evidence.altRatio, '이미지 설명'));
  }
  
  // 이미지 품질
  if (evidence.imageQuality !== undefined) {
    if (evidence.imageQuality === 'high') {
      descriptions.push('✅ 고품질 이미지 사용');
    } else if (evidence.imageQuality === 'low') {
      descriptions.push('⚠️ 이미지 품질 개선 필요');
    }
  }
  
  // 팝업
  if (evidence.popups !== undefined) {
    if (typeof evidence.popups === 'object' && evidence.popups !== null) {
      // count 속성이 있는 경우
      if (typeof evidence.popups.count === 'number') {
        descriptions.push(describePopupCount(evidence.popups.count));
      } else if (evidence.popups.countOnScreenshot !== undefined) {
        // countOnScreenshot 속성이 있는 경우
        if (typeof evidence.popups.countOnScreenshot === 'number') {
          descriptions.push(describePopupCount(evidence.popups.countOnScreenshot));
        } else {
          descriptions.push(`팝업: ${evidence.popups.countOnScreenshot}`);
        }
      } else {
        // 기타 객체 처리
        const processed = processValue(evidence.popups, '팝업');
        if (processed) descriptions.push(processed);
      }
    } else if (typeof evidence.popups === 'number') {
      descriptions.push(describePopupCount(evidence.popups));
    } else if (typeof evidence.popups === 'string') {
      descriptions.push(`팝업: ${evidence.popups}`);
    }
  }
  
  // 비주얼 계층
  if (evidence.visualHierarchy !== undefined) {
    if (evidence.visualHierarchy === 'clear') {
      descriptions.push('✅ 명확한 시각적 계층 구조');
    } else if (evidence.visualHierarchy === 'unclear') {
      descriptions.push('⚠️ 시각적 계층 구조 개선 필요');
    }
  }
  
  // 모바일
  if (evidence.viewportMeta !== undefined) {
    descriptions.push(describeBoolean(evidence.viewportMeta, '모바일 최적화', '모바일 최적화 안됨'));
  }
  
  if (evidence.overflow !== undefined) {
    descriptions.push(describeBoolean(!evidence.overflow, '가로 스크롤 없음', '가로 스크롤 있음'));
  }
  
  if (evidence.touchTargets !== undefined) {
    if (evidence.touchTargets === 'adequate') {
      descriptions.push('✅ 적절한 터치 타겟 크기');
    } else if (evidence.touchTargets === 'small') {
      descriptions.push('⚠️ 터치 타겟이 너무 작음');
    }
  }
  
  // 구매 플로우
  if (evidence.purchaseSteps !== undefined) {
    if (Array.isArray(evidence.purchaseSteps)) {
      descriptions.push(`구매 단계: ${evidence.purchaseSteps.join(' → ')}`);
    }
  }
  
  // SEO
  if (evidence.metaTags !== undefined) {
    if (evidence.metaTags === 'complete') {
      descriptions.push('✅ SEO 메타 태그 완비');
    } else if (evidence.metaTags === 'incomplete') {
      descriptions.push('⚠️ SEO 메타 태그 누락');
    }
  }
  
  if (evidence.analytics !== undefined) {
    descriptions.push(describeBoolean(evidence.analytics, '분석 도구 설치됨', '분석 도구 없음'));
  }
  
  // 기타 키-값 쌍 처리 (위에서 처리되지 않은 것들)
  Object.keys(evidence).forEach(key => {
    if (!['lighthousePath', 'cta', 'promoTexts', 'logo', 'brandColors', 'menu', 'menuCount', 
         'searchPresent', 'hasBestNew', 'payments', 'policies', 'certifications', 'reviews',
         'altRatio', 'imageQuality', 'popups', 'visualHierarchy', 'viewportMeta', 'overflow',
         'touchTargets', 'purchaseSteps', 'metaTags', 'analytics', 'screenshots'].includes(key)) {
      const value = evidence[key];
      if (value !== null && value !== undefined) {
        const processed = processValue(value, key);
        if (processed) {
          descriptions.push(processed);
        }
      }
    }
  });
  
  return descriptions.length > 0 ? descriptions : ['분석 데이터 없음'];
}