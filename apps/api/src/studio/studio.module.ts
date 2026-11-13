import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { FinanceModule } from '../finance/finance.module';
import { ChromiumPdfRenderer, PDF_RENDERER } from './pdf-renderer';
import { RenderTokenService } from './render-token';
import { StudioAiService } from './studio-ai.service';
import {
  CareerExportRenderController,
  CareerExportsController,
  StudioController,
} from './studio.controller';
import { StudioExportsService } from './studio-exports.service';
import { StudioService } from './studio.service';

/** Career Studio (phase 4) : documents, assistant IA et exports PDF payés en crédits. */
@Module({
  imports: [AiModule, FinanceModule],
  controllers: [StudioController, CareerExportsController, CareerExportRenderController],
  providers: [
    StudioService,
    StudioAiService,
    StudioExportsService,
    RenderTokenService,
    { provide: PDF_RENDERER, useClass: ChromiumPdfRenderer },
  ],
  exports: [StudioService],
})
export class StudioModule {}
