import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { BundlesController } from './bundles.controller';
import { BundlesService } from './bundles.service';
import { PdfAssemblyService } from './pdf-assembly.service';

/** Dossiers rassemblés : fichiers de l'utilisateur réunis en un seul PDF payé en crédits. */
@Module({
  imports: [FinanceModule],
  controllers: [BundlesController],
  providers: [BundlesService, PdfAssemblyService],
})
export class BundlesModule {}
