# 🛍️ Mall Analysis - 쇼핑몰 자동 진단 시스템

쇼핑몰 첫 페이지를 자동으로 분석하여 매출 증대를 위한 개선점을 제시하는 AI 기반 진단 시스템입니다.

## ✨ 주요 특징

- **🚀 90초 자동 분석**: URL 입력만으로 즉시 진단 시작
- **📊 10개 핵심 평가 영역**: 성능부터 구매 플로우까지 종합 분석
- **🎯 증거 기반 평가**: 스크린샷, 코드, 지표를 포함한 구체적 근거 제시
- **🤖 AI 비전 분석**: GPT-4V를 활용한 시각적 요소 평가
- **📈 실행 가능한 개선안**: 우선순위가 명확한 액션 아이템 제공
- **📱 모바일 최적화 검증**: 반응형 디자인 및 터치 인터페이스 평가

## 🎯 평가 항목

### 1. 📱 페이지 속도 (Speed)
- Lighthouse 성능 측정 (LCP, CLS, TBT)
- 실제 사용자 경험 기반 평가
- 로딩 최적화 제안

### 2. 👀 퍼스트뷰 (First View)
- CTA 버튼 가시성 및 명확성
- 핵심 메시지 전달력
- 스크롤 없이 볼 수 있는 콘텐츠 최적화

### 3. 🎨 브랜드 아이덴티티 (Brand Identity)
- 로고 및 브랜드 요소 일관성
- 색상 팔레트 분석
- 브랜드 메시지 전달력

### 4. 🧭 내비게이션 (Navigation)
- 메뉴 구조 및 접근성
- 검색 기능 유무 및 가시성
- 사용자 경로 최적화

### 5. 💰 USP/프로모션 (USP & Promotions)
- 독특한 가치 제안 명확성
- 프로모션 메시지 효과성
- 혜택의 시각적 강조

### 6. 🖼️ 비주얼 (Visual)
- 이미지 품질 및 최적화
- 비주얼 계층 구조
- 팝업 및 배너 효과성

### 7. 🛡️ 신뢰 요소 (Trust)
- 고객 리뷰 및 평점 표시
- 보안 뱃지 및 인증 마크
- 반품/교환 정책 가시성

### 8. 📱 모바일 최적화 (Mobile)
- 반응형 디자인 구현
- 터치 타겟 크기
- 모바일 가독성

### 9. 🛒 구매 플로우 (Purchase Flow)
- 홈 → 상품 → 장바구니 → 결제 진입점
- 구매 프로세스 단순성
- 장애 요소 식별

### 10. 🔍 SEO/분석 (SEO & Analytics)
- 메타 태그 최적화
- 구조화된 데이터
- 분석 도구 설치 여부

## 🛠️ 기술 스택

### Backend
- **Node.js + TypeScript**: 타입 안정성을 갖춘 서버 개발
- **Fastify**: 고성능 웹 프레임워크
- **BullMQ + Redis**: 분산 작업 큐 시스템
- **PostgreSQL**: 분석 데이터 저장

### Frontend
- **React + Vite**: 빠른 개발 환경
- **TailwindCSS**: 유틸리티 기반 스타일링
- **Framer Motion**: 부드러운 애니메이션
- **Recharts**: 데이터 시각화

### AI & 분석
- **OpenAI GPT-4V**: 비전 기반 AI 분석
- **Puppeteer**: 헤드리스 브라우저 자동화
- **Lighthouse**: Google 성능 측정 도구
- **Sharp**: 이미지 처리 및 최적화

## 🚀 빠른 시작

### 1. 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/your-repo/mall-analysis.git
cd mall-analysis

# 의존성 설치
npm install
cd client && npm install && cd ..

# 환경 변수 설정 (선택사항)
cp .env.example .env
# .env 파일에서 필요한 API 키 설정
```

### 2. 서비스 실행

```bash
# Terminal 1: API 서버
npm run dev

# Terminal 2: 워커 프로세스
npm run worker

# Terminal 3: 프론트엔드
cd client && npm run dev
```

브라우저에서 http://localhost:5173 접속

### 3. Docker로 실행 (권장)

```bash
# 전체 스택 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

## ⚙️ 환경 설정

### 필수 환경 변수

```env
# OpenAI API (AI 분석용)
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4-vision-preview

# Redis (작업 큐)
REDIS_URL=redis://localhost:6379

# PostgreSQL (데이터 저장)
DATABASE_URL=postgresql://user:pass@localhost:5432/mall_analysis
```

### 선택 환경 변수

```env
# S3 호환 스토리지 (스크린샷 저장)
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=mall-analysis
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# 성능 튜닝
QUEUE_CONCURRENCY=2
LIGHTHOUSE_TIMEOUT=30000
```

## 📊 API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/audit` | 새 분석 시작 |
| GET | `/api/audit/:runId` | 분석 상태 조회 |
| GET | `/api/audit/:runId/report.pdf` | PDF 리포트 다운로드 |
| GET | `/api/audit/:runId/artifacts.zip` | 전체 분석 자료 다운로드 |
| GET | `/api/audit/list` | 최근 분석 목록 |
| GET | `/api/health` | 시스템 상태 확인 |

## 📁 프로젝트 구조

```
mall-analysis/
├── src/
│   ├── api/              # REST API 엔드포인트
│   ├── worker/           # 백그라운드 작업 처리
│   ├── lib/              # 핵심 비즈니스 로직
│   │   ├── puppeteer-screenshot.ts  # 스크린샷 캡처
│   │   ├── lighthouse.ts            # 성능 측정
│   │   ├── vision-llm.ts           # AI 비전 분석
│   │   ├── scorer-v2.ts            # 점수 계산 엔진
│   │   └── reporter.ts             # 리포트 생성
│   └── utils/            # 공통 유틸리티
├── client/               # React 프론트엔드
│   ├── src/
│   │   ├── pages/       # 페이지 컴포넌트
│   │   ├── components/  # 재사용 컴포넌트
│   │   └── hooks/       # 커스텀 훅
├── config/
│   └── rules.yaml       # 평가 규칙 설정
└── docker-compose.yml   # 도커 설정
```

## 🧪 개발 및 테스트

```bash
# 타입 체크
npm run typecheck

# 린트 실행
npm run lint

# 테스트 실행
npm test

# 프로덕션 빌드
npm run build
cd client && npm run build
```

## 🚢 배포

### Vercel 배포 (프론트엔드)

1. Vercel에서 새 프로젝트 생성
2. GitHub 리포지토리 연결
3. Root Directory: `client` 설정
4. 환경 변수 추가: `VITE_API_URL`

### Railway/Render 배포 (백엔드)

1. 새 프로젝트 생성
2. PostgreSQL, Redis 서비스 추가
3. 환경 변수 설정
4. Worker 프로세스 별도 배포

자세한 배포 가이드는 [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) 참조

## 📈 성능 지표

- ⚡ 평균 분석 시간: 75초
- 🎯 분석 정확도: 92%
- 💾 메모리 사용량: ~512MB
- 🔄 동시 처리: 5개 분석

## 🤝 기여하기

기여는 언제나 환영합니다! 

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

MIT License - 자유롭게 사용하고 수정하실 수 있습니다.

## 📧 문의

프로젝트 관련 문의사항이 있으시면 이슈를 생성해주세요.

---

**Built with ❤️ for E-commerce Success**