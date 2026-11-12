import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '../../src/generated/prisma/client';
import { type PrismaService } from '../../src/prisma/prisma.service';

/**
 * Crédits payés pour les tests : pack, commande payée, paiement et lot « purchase »
 * commissionnable, comme les produit l'attribution réelle (étape 3c). Pas d'écriture comptable.
 */
export async function givePaidCredits(
  prisma: PrismaService,
  userId: string,
  credits: number,
  options: { settled?: boolean } = {},
): Promise<{ paymentId: string; saleId: string }> {
  const unit = new Prisma.Decimal('0.10');
  const price = unit.mul(credits);
  const saleId = `sal_test_${randomBytes(6).toString('hex')}`;
  return prisma.$transaction(async (tx) => {
    const pack = await tx.creditPack.create({
      data: {
        sku: `t_${randomBytes(5).toString('hex')}`,
        name: 'Pack de test',
        credits,
        priceUsd: price,
      },
    });
    const order = await tx.creditOrder.create({
      data: {
        reference: `CR-20261112-${randomBytes(4).toString('hex').toUpperCase()}`,
        userId,
        packId: pack.id,
        credits,
        priceUsd: price,
        creditUnitValueUsd: unit,
        chariowProductId: `prd_${randomUUID()}`,
        status: 'paid',
        paidAt: new Date(),
        providerSaleId: saleId,
      },
    });
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        provider: 'chariow',
        providerSaleId: saleId,
        amountUsd: price,
        currency: 'USD',
        saleStatus: options.settled ? 'settled' : 'completed',
        settlementDoneAt: options.settled ? new Date() : null,
        rawSnapshot: {},
      },
    });
    const account = await tx.creditAccount.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    const balance = account.balance + credits;
    const movement = await tx.creditMovement.create({
      data: {
        accountId: account.id,
        type: 'purchase',
        quantity: credits,
        balanceAfter: balance,
        idempotencyKey: `purchase:${saleId}`,
      },
    });
    const lot = await tx.creditLot.create({
      data: {
        accountId: account.id,
        origin: 'purchase',
        creditsTotal: credits,
        creditsRemaining: credits,
        creditUnitValueUsd: unit,
        commissionable: true,
        paymentId: payment.id,
      },
    });
    await tx.creditLotAllocation.create({
      data: { movementId: movement.id, lotId: lot.id, credits, valueUsd: price },
    });
    await tx.creditAccount.update({ where: { id: account.id }, data: { balance } });
    return { paymentId: payment.id, saleId };
  });
}
