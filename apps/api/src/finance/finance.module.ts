import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { FinanceAdminController, MyCreditsController } from './finance.controller';
import { FinancialSettingsService } from './financial-settings.service';
import { LedgerService } from './ledger.service';

/** Monétisation (phase 3a) : paramètres financiers, registre des crédits et grand livre. */
@Module({
  controllers: [MyCreditsController, FinanceAdminController],
  providers: [FinancialSettingsService, CreditsService, LedgerService],
  exports: [FinancialSettingsService, CreditsService, LedgerService],
})
export class FinanceModule {}
