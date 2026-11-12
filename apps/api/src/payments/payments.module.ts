import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { ChariowClient } from './chariow.client';
import { CreditPurchasesService } from './credit-purchases.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PaymentSchedulerService } from './payment-scheduler.service';
import {
  AdminCreditPacksController,
  ChariowPulseController,
  CreditPacksController,
  MyCreditOrdersController,
} from './payments.controller';

/** Recharges de crédits payées par Chariow (phase 3c) et libération des commissions. */
@Module({
  imports: [FinanceModule],
  controllers: [
    CreditPacksController,
    MyCreditOrdersController,
    ChariowPulseController,
    AdminCreditPacksController,
  ],
  providers: [
    ChariowClient,
    CreditPurchasesService,
    PaymentReconciliationService,
    PaymentSchedulerService,
  ],
  exports: [ChariowClient, CreditPurchasesService, PaymentReconciliationService],
})
export class PaymentsModule {}
