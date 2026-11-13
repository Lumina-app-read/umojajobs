import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { FinanceModule } from '../finance/finance.module';
import { ChromiumPdfRenderer, PDF_RENDERER } from './pdf-renderer';
import { RenderTokenService } from './render-token';
import { StudioGenerationService } from './studio-generation.service';
import { StudioSchedulerService } from './studio-scheduler.service';
import {
  CareerExportRenderController,
  CareerExportsController,
  StudioAdminController,
  StudioController,
} from './studio.controller';
import { StudioExportsService } from './studio-exports.service';
import { StudioService } from './studio.service';
import { StudioUsageService } from './studio-usage.service';
import { StudioPhotoService } from './studio-photo.service';

/** Career Studio (phase 4) : documents, assistant IA et exports PDF payés en crédits. */
@Module({
  imports: [AiModule, FinanceModule],
  controllers: [
    StudioController,
    CareerExportsController,
    CareerExportRenderController,
    StudioAdminController,
  ],
  providers: [
    StudioService,
    StudioGenerationService,
    StudioSchedulerService,
    StudioUsageService,
    StudioPhotoService,
    StudioExportsService,
    RenderTokenService,
    { provide: PDF_RENDERER, useClass: ChromiumPdfRenderer },
  ],
  exports: [StudioService],
})
export class StudioModule {}
