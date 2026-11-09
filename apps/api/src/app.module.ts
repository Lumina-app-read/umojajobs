import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { LocationsModule } from './locations/locations.module';
import { PrismaModule } from './prisma/prisma.module';

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
    HealthModule,
    LocationsModule,
  ],
})
export class AppModule {}
