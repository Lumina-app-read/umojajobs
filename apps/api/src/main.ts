import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { type EnvironmentVariables, NodeEnv } from './config/env.validation';

async function bootstrap(): Promise<void> {
  // Corps brut conservé : la signature des Pulses Chariow porte sur les octets reçus.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  configureApp(app, {
    enableSwagger: config.get('NODE_ENV', { infer: true }) !== NodeEnv.Production,
  });

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API démarrée sur le port ${port}`, 'Bootstrap');
}

void bootstrap();
