import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_DEFAULT_VERSION, API_GLOBAL_PREFIX, APP_NAME } from '@opportinities/shared';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { requestIdMiddleware } from './common/http/request-id.middleware';
import { validationExceptionFactory } from './common/http/validation-exception.factory';
import { type EnvironmentVariables } from './config/env.validation';
import { CookiesService } from './security/cookies.service';
import { CSRF_HEADER } from './security/csrf.guard';

export interface AppSetupOptions {
  /** Expose la documentation Swagger. Désactivé en production. */
  enableSwagger: boolean;
}

/**
 * Configuration HTTP commune au serveur et aux tests de bout en bout : identifiant de requête,
 * en-têtes de sécurité, cookies, proxy de confiance, préfixe et version de l'API, validation stricte.
 */
export function configureApp(app: NestExpressApplication, options: AppSetupOptions): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Derrière Nginx : seuls les N derniers proxys sont crus pour X-Forwarded-For (IP réelle du client).
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  app.disable('x-powered-by');

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cookieParser());

  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_DEFAULT_VERSION });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.enableShutdownHooks();

  if (options.enableSwagger) {
    const cookies = app.get(CookiesService);
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle(`${APP_NAME} API`)
        .setVersion(API_DEFAULT_VERSION)
        .addCookieAuth(cookies.sessionCookieName)
        .addApiKey({ type: 'apiKey', in: 'header', name: CSRF_HEADER }, 'csrf')
        .build(),
    );
    SwaggerModule.setup(`${API_GLOBAL_PREFIX}/docs`, app, document);
  }
}
