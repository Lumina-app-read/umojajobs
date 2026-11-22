import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { FinanceAdminController, MyCreditsController } from './finance.controller';
import { FinancialSettingsService } from './financial-settings.service';
import { LedgerService } from './ledger.service';
import { RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';

/** Monétisation (phase 3a) : paramètres financiers, registre des crédits et grand livre. */
@Module({
  controllers: [MyCreditsController, FinanceAdminController, RegistryController],
  providers: [FinancialSettingsService, CreditsService, LedgerService, RegistryService],
  exports: [FinancialSettingsService, CreditsService, LedgerService],
})
export class FinanceModule {}
