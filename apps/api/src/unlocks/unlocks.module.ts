import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { DocumentRenderService } from '../documents/document-render.service';
import {
  CreditCostsController,
  MyCommissionsController,
  MyWalletController,
  MyUnlocksController,
} from './unlocks.controller';
import { UnlocksService } from './unlocks.service';

/** Déverrouillages d'offres en crédits et commissions des contributeurs (phase 3b). */
@Module({
  imports: [FinanceModule],
  controllers: [
    CreditCostsController,
    MyUnlocksController,
    MyCommissionsController,
    MyWalletController,
  ],
  providers: [UnlocksService, DocumentRenderService],
})
export class UnlocksModule {}
