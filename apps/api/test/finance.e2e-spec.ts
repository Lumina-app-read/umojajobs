import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import {
  type CreditBalanceResponse,
  type CreditGrantResponse,
  type FinancialSettingResponse,
  type ServiceCostResponse,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import { totp } from '../src/auth/totp/totp';
import { CreditsService } from '../src/finance/credits.service';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';

type Role = 'admin' | 'super_admin';

describe('Finances : paramètres, crédits et grand livre (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let credits: CreditsService;
  let treasurer: ApiClient;
  let treasurerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    credits = app.get(CreditsService);
    const admin = await account('super_admin');
    treasurer = admin.api;
    treasurerId = admin.userId;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  /** Compte vérifié et connecté ; un rôle d'administration inscrit et valide son TOTP. */
  async function account(role?: Role): Promise<{ userId: string; api: ApiClient }> {
    const email = uniqueEmail('finance');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    await api.post('/api/v1/auth/verify-email', {
      token: extractToken(await waitForEmail(email, 'Confirmez')),
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    if (role) {
      const found = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: found.id } });
      const { secret } = (await api.post('/api/v1/auth/mfa/totp/setup')).body as {
        secret: string;
      };
      expect((await api.post('/api/v1/auth/mfa/totp/enable', { code: totp(secret) })).status).toBe(
        200,
      );
    }
    return { userId: user.id, api };
  }

  const grant = (userId: string, amount: number, key: string = randomUUID()) =>
    treasurer.post(
      '/api/v1/admin/finance/credit-grants',
      { userId, credits: amount, reason: 'Geste commercial de bienvenue' },
      { 'Idempotency-Key': key },
    );

  async function ledgerTotals(): Promise<{ debit: string; credit: string }> {
    const totals = await prisma.ledgerEntry.aggregate({ _sum: { debit: true, credit: true } });
    return {
      debit: (totals._sum.debit ?? new Prisma.Decimal(0)).toFixed(6),
      credit: (totals._sum.credit ?? new Prisma.Decimal(0)).toFixed(6),
    };
  }

  const consume = (userId: string, amount: number, key = `test:${randomUUID()}`) =>
    prisma.$transaction((tx) =>
      credits.consume(tx, {
        userId,
        service: 'unlock_standard',
        credits: amount,
        idempotencyKey: key,
        referenceType: 'test',
        referenceId: randomUUID(),
      }),
    );

  it('réserve l’administration financière aux permissions dédiées', async () => {
    const member = await account();
    expect((await member.api.get('/api/v1/admin/finance/settings')).status).toBe(403);

    const admin = await account('admin');
    const settings = await admin.api.get('/api/v1/admin/finance/settings');
    expect(settings.status).toBe(200);
    const update = await admin.api.put('/api/v1/admin/finance/settings/withdrawal_min_usd', {
      value: '12',
      reason: 'Tentative sans la permission de gestion',
    });
    expect(update.status).toBe(403);
    expect((await grant(member.userId, 5)).status).toBe(200);
    const denied = await admin.api.post(
      '/api/v1/admin/finance/credit-grants',
      { userId: member.userId, credits: 5, reason: 'Tentative sans la permission' },
      { 'Idempotency-Key': randomUUID() },
    );
    expect(denied.status).toBe(403);
  });

  it('expose les valeurs initiales et laisse vides les décisions encore ouvertes', async () => {
    const settings = (await treasurer.get('/api/v1/admin/finance/settings'))
      .body as FinancialSettingResponse[];
    const value = (key: string) => settings.find((setting) => setting.key === key)?.value;
    expect(value('credit_unit_value_usd')).toBe('0.1');
    expect(value('contributor_commission_rate')).toBe('0.3');
    expect(value('commission_hold_days')).toBeNull();
    expect(value('withdrawal_dual_approval_usd')).toBeNull();

    const costs = (await treasurer.get('/api/v1/admin/finance/service-costs'))
      .body as ServiceCostResponse[];
    expect(costs.find((cost) => cost.service === 'unlock_standard')?.credits).toBe(5);
  });

  it('historise chaque modification et refuse une valeur hors bornes', async () => {
    const invalid = await treasurer.put(
      '/api/v1/admin/finance/settings/contributor_commission_rate',
      {
        value: '1.5',
        reason: 'Valeur volontairement invalide',
      },
    );
    expect(invalid.status).toBe(400);
    expect((invalid.body as { code: string }).code).toBe('FINANCIAL_SETTING_INVALID');

    const updated = await treasurer.put('/api/v1/admin/finance/settings/commission_hold_days', {
      value: '14',
      reason: 'Décision N4 : délai de retenue standard',
    });
    expect(updated.status).toBe(200);
    const row = (updated.body as FinancialSettingResponse[]).find(
      (setting) => setting.key === 'commission_hold_days',
    );
    expect(row?.value).toBe('14');
    expect(row?.changedBy).not.toBeNull();

    const cost = await treasurer.put('/api/v1/admin/finance/service-costs/doc_pack', {
      credits: 24,
      reason: 'Ajustement du pack documentaire',
    });
    expect(cost.status).toBe(200);
    expect(await prisma.serviceCreditCost.count({ where: { service: 'doc_pack' } })).toBe(2);
    expect(
      await prisma.securityEvent.count({ where: { type: 'financial_setting_changed' } }),
    ).toBeGreaterThanOrEqual(2);

    // Rétablit le coût initial pour les autres scénarios.
    await treasurer.put('/api/v1/admin/finance/service-costs/doc_pack', {
      credits: 25,
      reason: 'Retour à la valeur initiale',
    });
  });

  it('retrouve un bénéficiaire par son email, réservé à la gestion financière', async () => {
    const member = await account();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: member.userId } });
    const found = await treasurer.get(
      `/api/v1/admin/finance/users/lookup?email=${encodeURIComponent(user.email.toUpperCase())}`,
    );
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ id: member.userId, balance: 0 });
    const missing = await treasurer.get(
      '/api/v1/admin/finance/users/lookup?email=inconnu%40example.test',
    );
    expect(missing.status).toBe(404);
    const reader = await account('admin');
    const denied = await reader.api.get(
      `/api/v1/admin/finance/users/lookup?email=${encodeURIComponent(user.email)}`,
    );
    expect(denied.status).toBe(403);
  });

  it('attribue des crédits gratuits une seule fois par clé, sans droit à commission', async () => {
    const member = await account();
    const key = randomUUID();
    const first = await grant(member.userId, 20, key);
    expect(first.status).toBe(200);
    const replay = await grant(member.userId, 20, key);
    expect(replay.body).toEqual(first.body);
    expect((first.body as CreditGrantResponse).balance).toBe(20);

    const self = await treasurer.post(
      '/api/v1/admin/finance/credit-grants',
      { userId: treasurerId, credits: 5, reason: 'Tentative de dotation personnelle' },
      { 'Idempotency-Key': randomUUID() },
    );
    expect(self.status).toBe(403);
    expect((self.body as { code: string }).code).toBe('CREDIT_SELF_GRANT');

    const missingKey = await treasurer.post('/api/v1/admin/finance/credit-grants', {
      userId: member.userId,
      credits: 5,
      reason: 'Sans clé d’idempotence',
    });
    expect(missingKey.status).toBe(400);

    const lots = await prisma.creditLot.findMany({
      where: { account: { userId: member.userId } },
    });
    expect(lots).toHaveLength(1);
    expect(lots[0]?.commissionable).toBe(false);
    expect(lots[0]?.creditUnitValueUsd.toFixed(2)).toBe('0.10');

    const mine = (await member.api.get('/api/v1/me/credits')).body as CreditBalanceResponse;
    expect(mine.balance).toBe(20);
    expect(mine.movements.map((movement) => [movement.type, movement.quantity])).toEqual([
      ['grant', 20],
    ]);
    const totals = await ledgerTotals();
    expect(totals.debit).toBe(totals.credit);
  });

  it('consomme en FIFO avec la valeur figée de chaque lot et refuse un solde insuffisant', async () => {
    const member = await account();
    await grant(member.userId, 3);
    await treasurer.put('/api/v1/admin/finance/settings/credit_unit_value_usd', {
      value: '0.12',
      reason: 'Test de valeur figée par lot',
    });
    await grant(member.userId, 10);
    await treasurer.put('/api/v1/admin/finance/settings/credit_unit_value_usd', {
      value: '0.10',
      reason: 'Retour à la valeur de référence',
    });

    const result = await consume(member.userId, 5);
    expect(result.balance).toBe(8);
    expect(result.valueUsd.toFixed(6)).toBe('0.540000');
    expect(result.commissionableValueUsd.toFixed(6)).toBe('0.000000');
    expect(result.allocations.map((allocation) => allocation.credits)).toEqual([3, 2]);

    await expect(consume(member.userId, 9)).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_CREDITS' },
    });
    // Écriture de consommation : la dette envers l'utilisateur baisse, le chiffre d'affaires monte.
    const posted = await prisma.ledgerEntry.findMany({
      where: {
        transaction: { idempotencyKey: { startsWith: 'test:' } },
        account: { code: 'revenue_unlocks' },
      },
      orderBy: { id: 'desc' },
      take: 1,
    });
    expect(posted[0]?.credit.toFixed(6)).toBe('0.540000');
    const totals = await ledgerTotals();
    expect(totals.debit).toBe(totals.credit);
  });

  it('ne laisse passer qu’une consommation lorsque deux arrivent en même temps', async () => {
    const member = await account();
    await grant(member.userId, 15);
    const outcomes = await Promise.allSettled([
      consume(member.userId, 10),
      consume(member.userId, 10),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const accountRow = await prisma.creditAccount.findUniqueOrThrow({
      where: { userId: member.userId },
    });
    expect(accountRow.balance).toBe(5);
    const movements = await prisma.creditMovement.aggregate({
      where: { accountId: accountRow.id },
      _sum: { quantity: true },
    });
    expect(movements._sum.quantity).toBe(5);
  });

  it('protège les registres en base : ajout seul, équilibre et lots gratuits', async () => {
    await expect(
      prisma.$executeRaw`UPDATE "credit_movements" SET "quantity" = 999`,
    ).rejects.toThrow(/ajout seul/);
    await expect(prisma.$executeRaw`DELETE FROM "ledger_entries"`).rejects.toThrow(/ajout seul/);

    const accountId = (
      await prisma.ledgerAccount.findUniqueOrThrow({
        where: { code: 'customer_credits' },
      })
    ).id;
    await expect(
      prisma.$transaction(async (tx) => {
        const transaction = await tx.ledgerTransaction.create({
          data: { type: 'credit_grant', idempotencyKey: `déséquilibre:${randomUUID()}` },
        });
        await tx.ledgerEntry.create({
          data: { transactionId: transaction.id, accountId, debit: new Prisma.Decimal('1') },
        });
      }),
    ).rejects.toThrow(/déséquilibrée/);

    const member = await account();
    await grant(member.userId, 1);
    const creditAccount = await prisma.creditAccount.findUniqueOrThrow({
      where: { userId: member.userId },
    });
    await expect(
      prisma.creditLot.create({
        data: {
          accountId: creditAccount.id,
          origin: 'grant',
          creditsTotal: 5,
          creditsRemaining: 5,
          creditUnitValueUsd: new Prisma.Decimal('0.1'),
          commissionable: true,
        },
      }),
    ).rejects.toThrow(/credit_lots_commissionable_chk/);
  });
});
