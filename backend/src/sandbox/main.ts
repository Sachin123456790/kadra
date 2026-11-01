import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, HttpException } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { randomUUID } from 'node:crypto';
import { SandboxDatabase } from './database';
import { SandboxAuth } from './auth';
import { SandboxService } from './service';
import { SandboxWorker } from './worker';
import { SandboxController } from './controller';

@Module({
  providers: [SandboxDatabase, SandboxAuth, SandboxService, SandboxWorker],
  controllers: [SandboxController],
})
export class SandboxModule {}
export async function createSandboxApp() {
  const app = await NestFactory.create<NestFastifyApplication>(
    SandboxModule,
    new FastifyAdapter({ bodyLimit: 1024 * 1024, logger: false }),
    { logger: ['error', 'warn', 'log'] },
  );
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8 },
  });
  app.setGlobalPrefix('api/v1');
  const rate = new Map<string, { count: number; until: number }>();
  const allowed = new Set(
    (
      process.env.SANDBOX_ORIGINS ||
      'http://localhost:8080,http://127.0.0.1:8080,http://localhost:8081,http://127.0.0.1:8081,http://localhost:3100,http://127.0.0.1:3100'
    ).split(','),
  );
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', async (req, reply) => {
      reply
        .header('Cache-Control', 'no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .header('Referrer-Policy', 'same-origin');
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const origin = req.headers.origin;
        if (origin && !allowed.has(origin))
          return reply.code(403).send({
            code: 'ORIGIN_REJECTED',
            message: 'This origin is not allowed.',
          });
        if (req.headers['sec-fetch-site'] === 'cross-site')
          return reply.code(403).send({
            code: 'ORIGIN_REJECTED',
            message: 'Cross-site requests are not allowed.',
          });
      }
      const auth =
        req.url.includes('/auth/login') || req.url.includes('/auth/register');
      const key = `${req.ip}:${auth ? 'auth' : 'api'}`;
      const now = Date.now();
      const limit = auth ? 10 : 300;
      if (rate.size > 5000)
        for (const [k, v] of rate) if (v.until < now) rate.delete(k);
      const bucket = rate.get(key);
      if (bucket && bucket.until > now) {
        if (++bucket.count > limit)
          return reply.code(429).send({
            code: 'RATE_LIMIT',
            message: 'Too many requests. Try again shortly.',
          });
      } else rate.set(key, { count: 1, until: now + 60000 });
    });
  app.useGlobalFilters({
    catch(error: any, host: any) {
      const reply = host.switchToHttp().getResponse();
      const status =
        error instanceof HttpException
          ? error.getStatus()
          : error?.statusCode === 413
            ? 413
            : 500;
      const response: any =
        error instanceof HttpException ? error.getResponse() : null;
      reply.status(status).send({
        error: {
          code: response?.code || 'REQUEST_FAILED',
          message:
            response?.message ||
            (status === 413
              ? 'File exceeds the upload limit.'
              : 'The request could not be completed.'),
        },
        requestId: randomUUID(),
      });
    },
  });
  app.enableShutdownHooks();
  return app;
}
if (require.main === module)
  createSandboxApp().then((app) =>
    app.listen(
      Number(process.env.PORT || 3100),
      process.env.SANDBOX_HOST || '127.0.0.1',
    ),
  );
