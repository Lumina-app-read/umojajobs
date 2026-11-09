import { Global, Inject, Injectable, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { type EnvironmentVariables } from '../config/env.validation';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}

/** Client Redis partagé : limitation du nombre de requêtes, puis cache et files de tâches. */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): Redis => {
        const logger = new Logger('Redis');
        const client = new Redis(config.get('REDIS_URL', { infer: true }), {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          lazyConnect: false,
        });
        // Le message d'erreur ioredis ne contient pas l'URL de connexion (ni le mot de passe).
        client.on('error', (error: Error) => logger.warn(`Redis indisponible : ${error.message}`));
        return client;
      },
    },
    RedisLifecycle,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
