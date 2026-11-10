import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { SessionAuthGuard } from './auth/guards/session-auth.guard';
import { CryptoModule } from './common/crypto/crypto.module';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { LocationsModule } from './locations/locations.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SecurityEventsModule } from './security-events/security-events.module';
import { CsrfGuard } from './security/csrf.guard';
import { RedisThrottlerStorage } from './security/redis-throttler.storage';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // En développement, le fichier .env se trouve à la racine du monorepo.
      // En production, les variables sont fournies par l'environnement du conteneur.
      // Les variables déjà présentes dans l'environnement sont prioritaires sur le fichier.
      envFilePath: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    CryptoModule,
    SecurityModule,
    SecurityEventsModule,
    MailModule,
    ThrottlerModule.forRootAsync({
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        // Limite globale par IP ; les routes sensibles ont leurs propres limites (@Throttle).
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        storage,
      }),
    }),
    HealthModule,
    LocationsModule,
    AuthModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Ordre d'exécution : limitation, CSRF, session, permissions.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: CsrfGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
