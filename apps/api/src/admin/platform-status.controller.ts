import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, type PlatformStatus } from '@opportinities/shared';
import { RequirePermissions } from '../security/decorators';
import { PlatformStatusService } from './platform-status.service';

/** État de la plateforme (paramètres, lecture seule, sans aucun secret). */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.SETTINGS_MANAGE)
@Controller('admin/platform/status')
export class PlatformStatusController {
  constructor(private readonly platform: PlatformStatusService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ description: 'Services, tâches planifiées et migrations.' })
  get(): Promise<PlatformStatus> {
    return this.platform.status();
  }
}
