import { type INestApplication } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/** Application complète (même configuration HTTP que la production), branchée sur la base de test. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, { enableSwagger: false });
  await app.init();
  return app;
}
