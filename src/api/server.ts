import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { auditRoutes } from './routes/audit.js';
import { healthRoutes } from './routes/health.js';
import { setupDatabase } from '../utils/database.js';
import { setupQueue } from '../utils/queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createServer() {
  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'development' 
      ? {
          level: process.env.LOG_LEVEL || 'info',
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname'
            }
          }
        }
      : {
          level: process.env.LOG_LEVEL || 'info'
        },
    bodyLimit: 10 * 1024 * 1024, // 10MB
    requestTimeout: 120000, // 120초
  });

  // 플러그인 등록
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB
    }
  });

  // 정적 파일 서빙 (클라이언트 빌드 파일)
  await fastify.register(fastifyStatic, {
    root: join(__dirname, '../../client/dist'),
    prefix: '/',
    constraints: {} // 다른 라우트와 충돌 방지
  });

  // 에러 핸들러
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 
      ? 'Internal Server Error' 
      : error.message;

    reply.status(statusCode).send({
      error: true,
      message,
      statusCode,
      timestamp: new Date().toISOString()
    });
  });

  // 404 핸들러
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: true,
      message: 'Route not found',
      statusCode: 404,
      timestamp: new Date().toISOString()
    });
  });

  // 라우트 등록
  await fastify.register(healthRoutes, { prefix: '/api/health' });
  await fastify.register(auditRoutes, { prefix: '/api/audit' });

  // Graceful shutdown
  const closeGracefully = async (signal: string) => {
    fastify.log.info(`Received signal ${signal}, closing gracefully...`);
    
    try {
      await fastify.close();
      process.exit(0);
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => closeGracefully('SIGTERM'));
  process.on('SIGINT', () => closeGracefully('SIGINT'));

  return fastify;
}

// 서버 시작
export async function startServer() {
  try {
    // 데이터베이스 초기화
    await setupDatabase();
    
    // 큐 초기화
    await setupQueue();

    // 서버 생성
    const server = await createServer();
    
    // 서버 시작
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    console.log(`
🚀 Mall Analysis API Server is running!
📍 URL: http://${host}:${port}
📊 Health: http://${host}:${port}/api/health
🔍 Audit: POST http://${host}:${port}/api/audit
    `);

    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}