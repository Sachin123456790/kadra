import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

const server = express();
let isReady = false;

async function bootstrap() {
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
