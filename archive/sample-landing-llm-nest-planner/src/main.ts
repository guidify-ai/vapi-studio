import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { loadEnvFile } from './load-env';

loadEnvFile();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  // Honor X-Forwarded-For behind reverse proxies (rate limits by real client IP).
  app.set('trust proxy', 1);
  app.enableCors({ origin: true });

  const publicDir = join(process.cwd(), 'public');
  if (existsSync(publicDir)) {
    app.useStaticAssets(publicDir);
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) return next();
      if (req.path.startsWith('/analytics')) return next();
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.includes('.')) return next();
      const index = join(publicDir, 'index.html');
      if (existsSync(index)) return res.sendFile(index);
      return next();
    });
  }

  const port = Number(process.env.PORT || 9998);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`sample-landing-llm listening on :${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
