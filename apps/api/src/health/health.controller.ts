import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { ERROR_CODES } from '@opportinities/shared';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Public } from '../security/decorators';
import { HealthStatusDto, ReadinessStatusDto } from './health-status.dto';

/** Sondes utilisées par Docker, Nginx et la supervision. */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Vivacité : le processus répond. Ne dépend d'aucun service externe. */
  @Get()
  @ApiOkResponse({ type: HealthStatusDto })
  check(): HealthStatusDto {
    return { status: 'ok' };
  }

  /** Disponibilité : l'API peut servir des requêtes (PostgreSQL et Redis joignables). */
  @Get('ready')
  @ApiOkResponse({ type: ReadinessStatusDto })
  @ApiServiceUnavailableResponse({ description: 'PostgreSQL ou Redis injoignable.' })
  async ready(): Promise<ReadinessStatusDto> {
    const [database, redis] = await Promise.all([this.prisma.isHealthy(), this.isRedisHealthy()]);
    if (!database || !redis) {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
        meta: { database: database ? 'up' : 'down', redis: redis ? 'up' : 'down' },
      });
    }
    return { status: 'ok', database: 'up', redis: 'up' };
  }

  private async isRedisHealthy(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
