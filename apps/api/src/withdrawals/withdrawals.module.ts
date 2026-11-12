import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { AdminWithdrawalsController, MyWithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

/** Retraits des contributeurs (phase 3d) : moyens, demandes, réservation, traitement. */
@Module({
  imports: [FinanceModule],
  controllers: [MyWithdrawalsController, AdminWithdrawalsController],
  providers: [WithdrawalsService],
})
export class WithdrawalsModule {}
