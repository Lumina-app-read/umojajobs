import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { ERROR_CODES } from '@opportinities/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HealthStatusDto, ReadinessStatusDto } from './health-status.dto';

/** Sondes utilisées par Docker, Nginx et la supervision. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Vivacité : le processus répond. Ne dépend d'aucun service externe. */
  @Get()
  @ApiOkResponse({ type: HealthStatusDto })
  check(): HealthStatusDto {
    return { status: 'ok' };
  }

  /** Disponibilité : l'API peut servir des requêtes (base de données joignable). */
  @Get('ready')
  @ApiOkResponse({ type: ReadinessStatusDto })
  @ApiServiceUnavailableResponse({ description: 'Base de données injoignable.' })
  async ready(): Promise<ReadinessStatusDto> {
    if (!(await this.prisma.isHealthy())) {
      throw new ServiceUnavailableException({ code: ERROR_CODES.SERVICE_UNAVAILABLE });
    }
    return { status: 'ok', database: 'up' };
  }
}
