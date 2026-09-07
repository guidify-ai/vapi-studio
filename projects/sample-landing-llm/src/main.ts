import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mountStudioUiAssets } from '@guidify-ai/vapi-studio';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: false,
  });
  app.enableCors({ origin: true, credentials: true });
  mountStudioUiAssets(app);
  const port = Number(process.env.PORT ?? 9998);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`sample-landing-llm (Vapi Studio) listening on ${port}`);
}

bootstrap();
