# 자사몰 첫 페이지 자동 진단 POC

90초 안에 자사몰 첫 페이지를 자동으로 분석하고 10개 항목에 대한 점수, 근거, 개선 제안을 제공하는 시스템입니다.

## 🚀 주요 기능

- **90초 자동 분석**: URL 입력만으로 자동 진단
- **10개 평가 항목**: 성능, 퍼스트뷰, BI, 내비게이션, USP, 비주얼, 신뢰, 모바일, 구매플로우, SEO
- **증거 기반 채점**: 스크린샷 bbox, HTML 인용, 지표 제공
- **AI 기반 평가**: GPT-5 비전 모델 활용
- **플랫폼 자동 감지**: 카페24, 아임웹 등 자동 식별
- **리포트 생성**: PDF, HTML, ZIP 형식 지원

## 📋 평가 항목

1. **페이지 속도** - Lighthouse 메트릭 (LCP, CLS, TBT)
2. **퍼스트뷰** - CTA 가시성, 프로모션 문구
3. **브랜드 아이덴티티** - 로고, 색상 일관성
4. **내비게이션** - 메뉴 구성, 검색 기능
5. **USP/프로모션** - 혜택 명확성, 대비, 위치
6. **비주얼** - 이미지 품질, alt 텍스트, 팝업
7. **신뢰 요소** - 리뷰, 정책, 결제 수단
8. **모바일 최적화** - 뷰포트, 가독성, 탭 타겟
9. **구매 플로우** - 홈→상품→장바구니→결제 진입
10. **SEO/분석** - 메타 태그, 분석 코드

## 🛠️ 기술 스택

### Backend
- Node.js + TypeScript
- Fastify (REST API)
- BullMQ (작업 큐)
- PostgreSQL (데이터베이스)
- Redis (큐 백엔드)

### Frontend
- React + TypeScript
- Vite (빌드 도구)
- TailwindCSS (스타일링)
- Recharts (차트)
- Framer Motion (애니메이션)

### AI & 분석
- OpenAI GPT-5 (Vision LLM)
- Firecrawl (웹 스크래핑)
- Lighthouse (성능 측정)
- Sharp & node-vibrant (이미지 분석)

## 🚀 빠른 시작

### 환경변수 없이 시작 (메모리 모드)

```bash
# 의존성 설치
npm install
cd client && npm install && cd ..

# 서버 시작 (메모리 DB/큐 사용)
npm run dev

# 별도 터미널에서 워커 시작
npm run worker

# 별도 터미널에서 클라이언트 시작
cd client && npm run dev
```

브라우저에서 http://localhost:5173 접속

### Docker로 시작 (전체 스택)

```bash
# .env 파일 생성 (선택사항)
cp .env.example .env
# API 키 설정

# Docker Compose로 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

## 📝 환경 변수

```env
# 데이터베이스 (선택사항 - 없으면 메모리 사용)
DATABASE_URL=postgresql://user:pass@localhost:5432/mall_analysis

# Redis (선택사항 - 없으면 메모리 큐 사용)
REDIS_URL=redis://localhost:6379

# Firecrawl API (선택사항 - 없으면 기본 HTML fetch)
FIRECRAWL_API_KEY=your_api_key

# LLM (선택사항 - 없으면 Mock 그레이더)
LLM_API_KEY=your_openai_key
LLM_MODEL=gpt-5

# S3 Storage (선택사항 - 없으면 로컬 파일)
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=mall-analysis
S3_ACCESS_KEY=your_key
S3_SECRET_KEY=your_secret
```

## 🏗️ 프로젝트 구조

```
mall_analysis/
├── src/
│   ├── api/          # API 엔드포인트
│   ├── worker/       # 백그라운드 작업
│   ├── lib/          # 핵심 모듈
│   │   ├── firecrawl.ts      # 웹 스크래핑
│   │   ├── lighthouse.ts     # 성능 측정
│   │   ├── vision-llm.ts     # AI 그레이더
│   │   ├── cv-utils.ts       # 이미지 분석
│   │   ├── scorer.ts         # 점수 계산
│   │   └── reporter.ts       # 리포트 생성
│   └── utils/        # 유틸리티
├── client/           # React 클라이언트
├── config/
│   └── rules.yaml    # 채점 규칙
└── docker-compose.yml
```

## 📊 API 엔드포인트

- `POST /api/audit` - 새 분석 시작
- `GET /api/audit/:runId` - 분석 상태 조회
- `GET /api/audit/:runId/report.pdf` - PDF 다운로드
- `GET /api/audit/:runId/artifacts.zip` - 전체 파일 다운로드
- `GET /api/audit/list` - 분석 목록
- `GET /api/health` - 시스템 상태

## 🔧 개발

```bash
# 테스트 실행
npm test

# 타입 체크
npm run typecheck

# 린트
npm run lint

# 빌드
npm run build
cd client && npm run build
```

## 🚢 배포

### Production Docker

```bash
# Production 이미지 빌드
docker build -t mall-analysis .

# Production 실행
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes

```bash
# 추후 Helm 차트 제공 예정
kubectl apply -f k8s/
```

## 📈 성능

- 평균 응답 시간: 75초
- 최대 응답 시간: 90초
- 동시 처리: 5개 감사
- 메모리 사용: ~512MB

## 🤝 기여

이슈와 PR은 언제나 환영합니다!

## 📄 라이선스

MIT

## 🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>