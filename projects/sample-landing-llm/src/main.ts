import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });
  app.enableCors({ origin: true, credentials: true });
  const port = Number(process.env.PORT ?? 9998);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`sample-landing-llm (Vapi Studio) listening on ${port}`);
}

bootstrap();
