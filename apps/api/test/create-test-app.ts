import { type INestApplication } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REDIS_CLIENT } from '../src/redis/redis.module';

/** Application complète (même configuration HTTP que la production), branchée sur la base de test. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app, { enableSwagger: false });
  await app.init();
  // Le client Redis n'a pas de file d'attente hors connexion : on attend qu'il soit prêt,
  // sinon la première commande d'un test (flushdb) peut échouer selon l'ordre des suites.
  const redis = app.get<Redis>(REDIS_CLIENT);
  if (redis.status !== 'ready') {
    await new Promise<void>((resolve, reject) => {
      redis.once('ready', () => resolve());
      redis.once('error', reject);
    });
  }
  return app;
}
