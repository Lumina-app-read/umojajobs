import { Injectable, Logger } from '@nestjs/common';
import { FinancialSettingsService } from '../finance/financial-settings.service';
import { LedgerService } from '../finance/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreditPurchasesService } from './credit-purchases.service';

const MINUTE = 60_000;
const DAY = 86_400_000;
const BATCH = 50;

/**
 * Tâches de fond des paiements (exécutées par le planificateur) :
 * 1. réconciliation : relecture des ventes en attente, au cas où une Pulse serait perdue ;
 * 2. règlements : frais et montant net connus après le versement de Chariow ;
 * 3. commissions : passage de « en attente » à « disponible » (délai de sécurité, audit §8).
 * Chaque étape est idempotente : relancer la tâche ne produit jamais d'effet en double.
 */
@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly purchases: CreditPurchasesService,
    private readonly settings: FinancialSettingsService,
    private readonly ledger: LedgerService,
  ) {}

  async run(now: Date): Promise<void> {
    await this.reconcileOrders(now);
    await this.retryEvents(now);
    await this.syncSettlements(now);
    await this.releaseCommissions(now);
  }

  private async reconcileOrders(now: Date): Promise<void> {
    const orders = await this.prisma.creditOrder.findMany({
      where: {
        status: { in: ['pending', 'failed', 'abandoned'] },
        providerSaleId: { not: null },
        createdAt: {
          gte: new Date(now.getTime() - 3 * DAY),
          lte: new Date(now.getTime() - MINUTE),
        },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
      select: { providerSaleId: true, reference: true },
    });
    for (const order of orders) {
      await this.purchases
        .confirmSale(order.providerSaleId as string)
        .catch((error: Error) =>
          this.logger.warn(`Réconciliation ${order.reference} : ${error.message}`),
        );
    }
  }

  private async retryEvents(now: Date): Promise<void> {
    const events = await this.prisma.paymentEvent.findMany({
      where: {
        processedAt: null,
        signatureValid: true,
        receivedAt: {
          lte: new Date(now.getTime() - MINUTE),
          gte: new Date(now.getTime() - 3 * DAY),
        },
      },
      take: BATCH,
      select: { id: true },
    });
    for (const event of events) await this.purchases.processEvent(event.id);
  }

  private async syncSettlements(now: Date): Promise<void> {
    const payments = await this.prisma.payment.findMany({
      where: { settlementDoneAt: null, createdAt: { gte: new Date(now.getTime() - 30 * DAY) } },
      take: BATCH,
      select: { providerSaleId: true },
    });
    for (const payment of payments) {
      await this.purchases
        .syncSettlement(payment.providerSaleId)
        .catch((error: Error) =>
          this.logger.warn(`Règlement ${payment.providerSaleId} : ${error.message}`),
        );
    }
  }

  /**
   * Une commission devient disponible si : le délai de retenue est écoulé (renforcé pour un
   * nouveau contributeur), les recharges d'origine sont réglées par Chariow, aucun remboursement
   * n'est constaté et l'offre n'est pas suspendue. Sans délais configurés, rien n'est libéré.
   */
  async releaseCommissions(now: Date): Promise<number> {
    const [holdDays, newHoldDays, newPeriodDays] = await Promise.all([
      this.settings.require('commission_hold_days').catch(() => null),
      this.settings.require('commission_hold_days_new_contributor').catch(() => null),
      this.settings.require('new_contributor_period_days').catch(() => null),
    ]);
    if (!holdDays || !newHoldDays || !newPeriodDays) return 0;

    const candidates = await this.prisma.commission.findMany({
      where: {
        status: 'pending',
        createdAt: { lte: new Date(now.getTime() - holdDays.toNumber() * DAY) },
      },
      take: BATCH,
      select: {
        id: true,
        amountUsd: true,
        contributorId: true,
        createdAt: true,
        jobOffer: { select: { status: true } },
        contributor: {
          select: {
            createdAt: true,
            withdrawals: { where: { status: 'paid' }, take: 1, select: { id: true } },
          },
        },
        unlock: {
          select: {
            movement: {
              select: {
                allocations: {
                  select: {
                    lot: {
                      select: {
                        commissionable: true,
                        payment: { select: { settlementDoneAt: true, saleStatus: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    let released = 0;
    for (const commission of candidates) {
      if (commission.jobOffer.status === 'suspended') continue;
      const isNew =
        commission.contributor.withdrawals.length === 0 ||
        commission.contributor.createdAt.getTime() > now.getTime() - newPeriodDays.toNumber() * DAY;
      const hold = (isNew ? newHoldDays : holdDays).toNumber() * DAY;
      if (commission.createdAt.getTime() > now.getTime() - hold) continue;
      const paidLots = commission.unlock.movement.allocations
        .map((allocation) => allocation.lot)
        .filter((lot) => lot.commissionable);
      const settled =
        paidLots.length > 0 &&
        paidLots.every(
          (lot) => lot.payment?.settlementDoneAt && lot.payment.saleStatus === 'settled',
        );
      if (!settled) continue;

      await this.prisma.$transaction(async (tx) => {
        const moved = await tx.commission.updateMany({
          where: { id: commission.id, status: 'pending' },
          data: { status: 'available', availableAt: now },
        });
        if (moved.count === 0) return;
        await tx.commissionEvent.create({
          data: { commissionId: commission.id, fromStatus: 'pending', toStatus: 'available' },
        });
        await this.ledger.post(tx, {
          type: 'commission_release',
          idempotencyKey: `commission-release:${commission.id}`,
          referenceType: 'commission',
          referenceId: commission.id,
          lines: [
            {
              account: {
                code: `contributor_pending:${commission.contributorId}`,
                type: 'liability',
                ownerUserId: commission.contributorId,
              },
              debit: commission.amountUsd,
            },
            {
              account: {
                code: `contributor_available:${commission.contributorId}`,
                type: 'liability',
                ownerUserId: commission.contributorId,
              },
              credit: commission.amountUsd,
            },
          ],
        });
      });
      released += 1;
    }
    return released;
  }
}
