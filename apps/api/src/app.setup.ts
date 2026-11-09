import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_DEFAULT_VERSION, API_GLOBAL_PREFIX, APP_NAME } from '@opportinities/shared';
import helmet from 'helmet';

export interface AppSetupOptions {
  /** Expose la documentation Swagger. Désactivé en production. */
  enableSwagger: boolean;
}

/**
 * Configuration HTTP commune au serveur et aux tests de bout en bout :
 * en-têtes de sécurité, préfixe et version de l'API, validation stricte des entrées.
 */
export function configureApp(app: INestApplication, options: AppSetupOptions): void {
  app.use(helmet());
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_DEFAULT_VERSION });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  if (options.enableSwagger) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle(`${APP_NAME} API`).setVersion(API_DEFAULT_VERSION).build(),
    );
    SwaggerModule.setup(`${API_GLOBAL_PREFIX}/docs`, app, document);
  }
}
