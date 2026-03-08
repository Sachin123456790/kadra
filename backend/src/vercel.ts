import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

const server = express();
let isReady = false;

async function bootstrap() {
  // Apply multer only to document upload routes before NestJS takes over
  try {
    const multer = await import('multer');
    const upload = (multer.default || multer)({
      storage: (multer.default || multer).memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    });
    server.post(/.*documents\/master-lpa$/, upload.single('file'));
  } catch (e) {
    console.warn('Multer setup failed:', e);
  }

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new AppExceptionFilter());
  await app.init();
  isReady = true;
}

const bootstrapPromise = bootstrap();

export default async function handler(req: any, res: any) {
  if (!isReady) await bootstrapPromise;
  server(req, res);
}
