# Vercel 배포 가이드

## ⚠️ 중요 사항
이 프로젝트는 백엔드 서비스(Redis Queue, Worker Process, Puppeteer)가 필요하므로 Vercel만으로는 완전한 배포가 불가능합니다. 

### 권장 배포 아키텍처:
- **프론트엔드(React)**: Vercel
- **백엔드 API + Worker**: Railway, Render, 또는 AWS EC2
- **Redis**: Upstash Redis 또는 Redis Cloud
- **PostgreSQL**: Supabase, Neon, 또는 Railway

## 옵션 1: 프론트엔드만 Vercel에 배포

### 1. GitHub 리포지토리 준비
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Vercel 웹 UI에서 배포

1. [Vercel](https://vercel.com)에 로그인
2. "New Project" 클릭
3. GitHub 리포지토리 연결
4. Import 설정:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. 환경 변수 설정:
   ```
   VITE_API_URL=https://your-backend-api.com
   ```

6. "Deploy" 클릭

## 옵션 2: 전체 스택 배포 (권장)

### 백엔드 배포 (Railway 예시)

1. **Railway에서 새 프로젝트 생성**
   - Redis 서비스 추가
   - PostgreSQL 서비스 추가
   - GitHub 리포지토리 연결

2. **환경 변수 설정**:
   ```
   # API 서버용
   PORT=3000
   NODE_ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   
   # AI & API Keys
   FIRECRAWL_API_KEY=your_key
   LLM_PROVIDER=openai
   LLM_API_KEY=your_openai_key
   LLM_MODEL=gpt-4
   
   # S3 Storage (선택사항)
   S3_ENDPOINT=https://s3.amazonaws.com
   S3_BUCKET=your-bucket
   S3_ACCESS_KEY=your_key
   S3_SECRET_KEY=your_secret
   S3_REGION=ap-northeast-2
   ```

3. **Worker 프로세스 설정**:
   - 별도 서비스로 Worker 추가
   - Start Command: `npm run worker`
   - 동일한 환경 변수 사용

### 프론트엔드 배포 (Vercel)

1. **Vercel 프로젝트 설정**:
   - Root Directory: `client`
   - Framework: Vite
   
2. **환경 변수**:
   ```
   VITE_API_URL=https://your-railway-app.railway.app
   ```

## 필수 환경 변수 목록

### 백엔드 (API + Worker)
- `DATABASE_URL` - PostgreSQL 연결 문자열
- `REDIS_URL` - Redis 연결 문자열
- `FIRECRAWL_API_KEY` - Firecrawl API 키
- `LLM_PROVIDER` - 'openai' 또는 'anthropic'
- `LLM_API_KEY` - OpenAI/Anthropic API 키
- `LLM_MODEL` - 사용할 모델 (예: gpt-4)
- `PORT` - API 서버 포트 (기본: 3000)
- `NODE_ENV` - 'production'

### 프론트엔드
- `VITE_API_URL` - 백엔드 API URL

## 배포 후 확인사항

1. **API Health Check**: `https://your-api.com/api/health`
2. **Redis 연결 확인**: Worker 로그 확인
3. **Puppeteer 동작 확인**: 첫 분석 실행 테스트

## 트러블슈팅

### Puppeteer 관련 이슈
Railway/Render에서 Puppeteer 실행 시:
```dockerfile
# Dockerfile 추가 필요
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-cjk
```

### 메모리 부족
- Worker 인스턴스 메모리 최소 1GB 권장
- `QUEUE_CONCURRENCY=1`로 설정하여 동시 처리 제한

### CORS 에러
백엔드 API에서 프론트엔드 도메인 허용:
```typescript
// src/index.ts
app.register(cors, {
  origin: 'https://your-app.vercel.app'
});
```

## 대안: Docker Compose 배포

완전한 로컬 환경 재현이 필요한 경우:
- DigitalOcean App Platform
- AWS ECS
- Google Cloud Run

배포 관련 추가 지원이 필요하면 문의해주세요.