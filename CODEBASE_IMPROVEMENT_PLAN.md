# 📋 코드베이스 개선 계획

## 🔍 현황 분석

### 프로젝트 규모
- TypeScript 파일: 69개
- TypeScript 에러: 88개
- 테스트 파일: 5개
- 주요 모듈: 15개 (lib 폴더)

### 주요 문제점
1. **TypeScript 에러 많음** (88개)
2. **테스트 커버리지 부족** (5개 테스트만 존재)
3. **환경 변수 의존성** (하드코딩된 localhost 주소)
4. **중복 코드** (scorer.ts vs scorer-v2.ts)
5. **미사용 코드** (주석 처리된 함수들)
6. **일관성 없는 에러 처리**

## 🎯 개선 목표

1. **코드 품질**: TypeScript 에러 0개
2. **유지보수성**: 명확한 모듈 구조
3. **확장성**: 환경 변수 기반 설정
4. **안정성**: 포괄적인 에러 처리
5. **테스트**: 핵심 로직 테스트 커버리지 80%

## 📝 개선 계획 (우선순위별)

### Phase 1: 긴급 수정 (1-2일)
#### 1.1 TypeScript 에러 해결
- [ ] 타입 정의 누락 수정
- [ ] any 타입 제거
- [ ] 미사용 import 정리
- [ ] 함수 파라미터 타입 명시

#### 1.2 환경 설정 개선
- [ ] 클라이언트 API URL 환경 변수화
- [ ] axios 인스턴스 설정
- [ ] CORS 설정 정리

#### 1.3 미사용 코드 제거
- [ ] 주석 처리된 코드 삭제
- [ ] 중복 모듈 통합 (scorer 통합)
- [ ] 사용하지 않는 파일 제거

### Phase 2: 구조 개선 (2-3일)
#### 2.1 모듈 리팩토링
- [ ] 공통 인터페이스 분리 (`types/` 정리)
- [ ] 유틸리티 함수 통합
- [ ] 에러 클래스 표준화

#### 2.2 API 레이어 개선
- [ ] API 클라이언트 추상화
- [ ] 요청/응답 인터셉터 추가
- [ ] 재시도 로직 구현

#### 2.3 상태 관리 개선
- [ ] React Query 또는 SWR 도입 검토
- [ ] 로딩/에러 상태 중앙화
- [ ] 캐싱 전략 수립

### Phase 3: 기능 강화 (3-5일)
#### 3.1 에러 처리 강화
- [ ] 전역 에러 바운더리 구현
- [ ] 에러 로깅 시스템 구축
- [ ] 사용자 친화적 에러 메시지

#### 3.2 성능 최적화
- [ ] 이미지 lazy loading
- [ ] 컴포넌트 메모이제이션
- [ ] 번들 크기 최적화

#### 3.3 테스트 추가
- [ ] 핵심 비즈니스 로직 테스트
- [ ] API 통합 테스트
- [ ] E2E 테스트 설정 (Playwright)

### Phase 4: 배포 준비 (2-3일)
#### 4.1 빌드 설정
- [ ] 프로덕션 빌드 최적화
- [ ] 환경별 설정 분리
- [ ] Docker 이미지 최적화

#### 4.2 문서화
- [ ] API 문서 자동화 (Swagger)
- [ ] 컴포넌트 스토리북 구축
- [ ] 배포 가이드 업데이트

#### 4.3 모니터링
- [ ] 에러 트래킹 (Sentry)
- [ ] 성능 모니터링
- [ ] 사용자 분석

## 🚀 즉시 실행 가능한 작업

### 1. TypeScript 에러 수정 스크립트
```bash
# 자동 수정 가능한 에러 처리
npx eslint --fix src/**/*.ts
npx prettier --write src/**/*.{ts,tsx}
```

### 2. 환경 변수 설정
```typescript
// client/src/config/api.ts
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 인터셉터 추가
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)
```

### 3. 타입 정의 통합
```typescript
// src/types/index.ts 정리
export interface AuditResult {
  // 통합된 타입 정의
}

export interface CheckResult {
  // 명확한 필드 정의
}
```

## 📊 예상 효과

### 단기 (1주)
- TypeScript 에러 0개 달성
- 빌드 시간 30% 단축
- 개발 생산성 향상

### 중기 (2주)
- 버그 발생률 50% 감소
- 코드 리뷰 시간 단축
- 배포 안정성 향상

### 장기 (1개월)
- 유지보수 비용 40% 절감
- 신규 기능 개발 속도 2배 향상
- 팀 온보딩 시간 단축

## 🔧 도구 및 라이브러리

### 필수 추가
- `@tanstack/react-query`: 서버 상태 관리
- `zod`: 런타임 타입 검증
- `vitest`: 테스트 프레임워크

### 선택 고려
- `storybook`: 컴포넌트 문서화
- `sentry`: 에러 트래킹
- `playwright`: E2E 테스트

## ⏱️ 타임라인

| 주차 | 작업 내용 | 완료 기준 |
|------|----------|----------|
| 1주차 | Phase 1 완료 | TypeScript 에러 0개 |
| 2주차 | Phase 2 완료 | 모듈 구조 개선 |
| 3주차 | Phase 3 진행 | 테스트 커버리지 50% |
| 4주차 | Phase 4 완료 | 프로덕션 준비 완료 |

## ✅ 체크리스트

### 즉시 시작
- [ ] TypeScript 에러 목록 작성
- [ ] 미사용 코드 식별
- [ ] 환경 변수 목록 정리

### 이번 주
- [ ] 타입 에러 50% 해결
- [ ] API 클라이언트 리팩토링
- [ ] 테스트 환경 구축

### 이번 달
- [ ] 전체 리팩토링 완료
- [ ] 문서화 완료
- [ ] 배포 자동화 구축

## 💡 참고사항

1. **점진적 개선**: 한 번에 모든 것을 바꾸지 말고 단계별로 진행
2. **기능 유지**: 리팩토링 중에도 기존 기능 정상 작동 보장
3. **팀 소통**: 주요 변경사항은 팀원과 공유
4. **롤백 계획**: 각 단계별 롤백 가능하도록 브랜치 관리

---

**시작하기**: Phase 1.1 TypeScript 에러 해결부터 시작하세요!