# Vercel 배포 환경 변수 설정 가이드

## 📌 중요 사항
이 프로젝트는 **프론트엔드와 백엔드가 분리**되어 있습니다:
- **프론트엔드(React)**: Vercel에 배포
- **백엔드(API + Worker)**: 별도 서버 필요 (Railway, Render, AWS 등)

## 🔧 Vercel 환경 변수 설정

### 프론트엔드 전용 (Vercel에 설정)

현재 클라이언트 코드는 `/api` 경로로 직접 요청하므로, **프록시 설정**이 필요합니다.

#### 옵션 1: 개발용 (프록시 사용)
```
# vercel.json에서 rewrites로 처리
# 환경 변수 필요 없음
```

#### 옵션 2: 프로덕션용 (외부 API 서버)
```
VITE_API_URL=https://your-backend-api.railway.app
```

단, 현재 코드를 수정해야 합니다:
1. axios 요청을 환경 변수 기반으로 변경
2. `axios.defaults.baseURL` 설정 추가

### 백엔드 환경 변수 (Railway/Render 등에 설정)

#### 필수 환경 변수
```env
# OpenAI API (AI 분석용)
LLM_API_KEY=sk-proj-xxxxxxxxxxxxx
LLM_MODEL=gpt-4-vision-preview
LLM_PROVIDER=openai

# Redis (작업 큐)
REDIS_URL=redis://default:password@redis-server:6379

# PostgreSQL (데이터 저장)
DATABASE_URL=postgresql://user:password@postgres-server:5432/mall_analysis

# 서버 설정
PORT=3000
NODE_ENV=production
```

#### 선택 환경 변수
```env
# S3 호환 스토리지 (스크린샷 저장)
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=mall-analysis-screenshots
S3_ACCESS_KEY=AKIAXXXXXXXXXX
S3_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxx
S3_REGION=ap-northeast-2

# 성능 튜닝
QUEUE_CONCURRENCY=2
LIGHTHOUSE_TIMEOUT=30000

# Firecrawl API (고급 스크래핑)
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxx
FIRECRAWL_API_BASE=https://api.firecrawl.dev/v1
```

## 🚀 Vercel 배포 단계별 가이드

### 1. 클라이언트 코드 수정 (필요시)

`client/src/config/api.ts` 파일 생성:
```typescript
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

axios.defaults.baseURL = API_URL

export default axios
```

각 컴포넌트에서:
```typescript
// 기존
import axios from 'axios'

// 변경
import axios from '../config/api'
```

### 2. Vercel 프로젝트 설정

1. [Vercel Dashboard](https://vercel.com/dashboard)에 로그인
2. "New Project" 클릭
3. GitHub 리포지토리 연결
4. 다음 설정 적용:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3. 환경 변수 추가

Vercel 대시보드에서:
1. Settings → Environment Variables
2. 다음 변수 추가:
   ```
   VITE_API_URL=https://your-backend.railway.app
   ```

### 4. vercel.json 설정 (개발용)

로컬 개발 서버로 프록시하려면:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "http://localhost:3000/api/:path*"
    }
  ]
}
```

## 🔍 환경 변수 확인 방법

### Vercel에서 확인
```bash
vercel env ls
```

### 로컬에서 테스트
```bash
# .env.local 파일 생성
echo "VITE_API_URL=http://localhost:3000" > client/.env.local

# 개발 서버 실행
cd client && npm run dev
```

## ⚠️ 주의사항

1. **CORS 설정**: 백엔드 서버에서 Vercel 도메인 허용 필요
2. **API 키 보안**: 프론트엔드에 민감한 API 키 노출 금지
3. **프록시 제한**: Vercel의 무료 플랜은 프록시 기능 제한 있음

## 📝 체크리스트

- [ ] 백엔드 서버 배포 완료
- [ ] 백엔드 URL 확인
- [ ] CORS 설정 완료
- [ ] 환경 변수 설정
- [ ] 클라이언트 코드 수정 (필요시)
- [ ] 로컬 테스트 완료
- [ ] Vercel 배포

## 🆘 문제 해결

### API 호출 실패
1. 브라우저 개발자 도구에서 네트워크 탭 확인
2. CORS 에러 확인
3. 백엔드 서버 상태 확인

### 환경 변수 인식 안됨
1. `VITE_` 접두사 확인
2. Vercel 재배포 시도
3. 빌드 로그 확인

---

자세한 배포 과정은 [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) 참조