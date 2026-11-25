import { Module } from '@nestjs/common';
import { AdminOverviewController } from './admin-overview.controller';
import { AdminOverviewService } from './admin-overview.service';
import { PlatformStatusController } from './platform-status.controller';
import { PlatformStatusService } from './platform-status.service';

/** Tableau de bord et rubriques transverses de l'administration. */
@Module({
  controllers: [AdminOverviewController, PlatformStatusController],
  providers: [AdminOverviewService, PlatformStatusService],
})
export class AdminModule {}
