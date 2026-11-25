import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type AdminOverview, PERMISSIONS } from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { CurrentAuth, RequirePermissions } from '../security/decorators';
import { AdminOverviewService } from './admin-overview.service';

/** Tableau de bord de l'administration (lecture seule, blocs selon les permissions). */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS)
@Controller('admin/overview')
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({
    description:
      'Indicateurs des 30 derniers jours, comparés aux 30 précédents, et courbes journalières.',
  })
  get(@CurrentAuth() auth: AuthContext): Promise<AdminOverview> {
    return this.overview.overview(auth.permissions);
  }
}
