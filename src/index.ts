import 'dotenv/config';
import { startServer } from './api/server.js';

// 환경변수 검증
function validateEnv() {
  const warnings = [];
  
  if (!process.env.DATABASE_URL) {
    warnings.push('DATABASE_URL not set - Using in-memory database (data will not persist)');
  }
  
  if (!process.env.REDIS_URL) {
    warnings.push('REDIS_URL not set - Using in-memory queue (limited to single instance)');
  }
  
  if (!process.env.FIRECRAWL_API_KEY) {
    warnings.push('FIRECRAWL_API_KEY not set - Firecrawl features will be disabled');
  }
  
  if (!process.env.LLM_API_KEY) {
    warnings.push('LLM_API_KEY not set - Using mock grader');
  }

  if (!process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
    warnings.push('S3 credentials not set - Using local file storage');
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Running with limited features:');
    warnings.forEach(w => console.warn(`   - ${w}`));
    console.warn('\n💡 For full functionality, configure the missing environment variables in .env file\n');
  } else {
    console.log('✅ All services configured properly\n');
  }
}

// 메인 함수
async function main() {
  console.log(`
╔══════════════════════════════════════════╗
║     Mall Analysis POC - API Server       ║
║     자사몰 첫 페이지 자동 진단 시스템    ║
╚══════════════════════════════════════════╝
  `);

  // 환경변수 검증
  validateEnv();

  // 서버 시작
  await startServer();
}

// 에러 핸들링
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// 실행
main().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});