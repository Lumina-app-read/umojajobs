import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import {
  type AdminWithdrawalResponse,
  CONTRIBUTOR_TERMS_VERSION,
  type JobOfferResponse,
  type ModerationJobOfferResponse,
  type WalletResponse,
  type WithdrawalMethodResponse,
  type WithdrawalResponse,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import { totp } from '../src/auth/totp/totp';
import { LedgerService } from '../src/finance/ledger.service';
import { type FinancialSettingKey, Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';

const day = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

interface Member {
  userId: string;
  api: ApiClient;
}

describe('Retraits des contributeurs (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let contributor: Member;
  let moderator: Member;
  let approver: Member;
  let payer: Member;

  async function member(role?: 'moderator' | 'super_admin'): Promise<Member> {
    const email = uniqueEmail('retrait');
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
      if (role === 'super_admin') {
        const { secret } = (await api.post('/api/v1/auth/mfa/totp/setup')).body as {
          secret: string;
        };
        await api.post('/api/v1/auth/mfa/totp/enable', { code: totp(secret) });
      }
    }
    await api.post('/api/v1/auth/me/contributor-terms', { version: CONTRIBUTOR_TERMS_VERSION });
    return { userId: user.id, api };
  }

  /** Valeur d'un paramètre, effective immédiatement (historique en ajout seul). */
  const setting = (key: FinancialSettingKey, value: string) =>
    prisma.financialSetting.create({
      data: { key, value: new Prisma.Decimal(value), effectiveFrom: new Date(), reason: 'Test' },
    });

  /**
   * Commission disponible de `amount` USD pour le contributeur : déverrouillage simulé, puis
   * libération (pending → available) telle que la fera la tâche planifiée de l'étape 3c.
   */
  async function availableCommission(amount: string): Promise<string> {
    const offer = await prisma.jobOffer.findFirstOrThrow({
      where: { contributorId: contributor.userId, status: 'active' },
    });
    const buyer = await member();
    return prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.create({ data: { userId: buyer.userId } });
      const movement = await tx.creditMovement.create({
        data: {
          accountId: account.id,
          type: 'consume',
          quantity: -5,
          balanceAfter: 0,
          idempotencyKey: `test:${randomUUID()}`,
        },
      });
      const unlock = await tx.jobUnlock.create({
        data: {
          userId: buyer.userId,
          jobOfferId: offer.id,
          service: 'unlock_standard',
          credits: 5,
          movementId: movement.id,
          valueUsd: new Prisma.Decimal(amount).mul(10),
        },
      });
      const ledger = app.get(LedgerService);
      const value = new Prisma.Decimal(amount);
      const accrual = await ledger.post(tx, {
        type: 'commission_accrual',
        idempotencyKey: `test-accrual:${unlock.id}`,
        lines: [
          { account: { code: 'contributor_commissions', type: 'expense' }, debit: value },
          {
            account: {
              code: `contributor_available:${contributor.userId}`,
              type: 'liability',
              ownerUserId: contributor.userId,
            },
            credit: value,
          },
        ],
      });
      const commission = await tx.commission.create({
        data: {
          unlockId: unlock.id,
          contributorId: contributor.userId,
          jobOfferId: offer.id,
          baseValueUsd: value.mul(10),
          rate: new Prisma.Decimal('0.1'),
          amountUsd: value,
          status: 'available',
          availableAt: new Date(),
          ledgerTransactionId: accrual,
        },
      });
      return commission.id;
    });
  }

  const wallet = async () =>
    (await contributor.api.get('/api/v1/me/wallet')).body as WalletResponse;
  const decide = (who: Member, id: string, body: object) =>
    who.api.post(`/api/v1/admin/withdrawals/${id}/decision`, body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    await redis.flushdb();
    contributor = await member();
    moderator = await member('moderator');
    approver = await member('super_admin');
    payer = await member('super_admin');

    const categoryId = (
      await prisma.jobCategory.findUniqueOrThrow({ where: { slug: 'accounting-finance' } })
    ).id;
    const created = (
      await contributor.api.post('/api/v1/me/job-offers', {
        title: 'Analyste financier',
        companyName: 'Banque du Fleuve',
        countryIso2: 'SN',
        categoryId,
        contractType: 'permanent',
        workMode: 'on_site',
        description: 'Analyse des risques et suivi des portefeuilles clients.',
        startDate: day(0),
        endDate: day(20),
        sourceType: 'company_website',
        applicationEmail: 'rh@banque-fleuve.example',
      })
    ).body as JobOfferResponse;
    const submitted = (
      await contributor.api.post(`/api/v1/me/job-offers/${created.id}/submit`, {
        version: created.version,
        declarationAccepted: true,
      })
    ).body as JobOfferResponse;
    const approved = (
      await moderator.api.post(`/api/v1/admin/job-offers/${submitted.id}/approve`, {
        version: submitted.version,
      })
    ).body as ModerationJobOfferResponse;
    expect(approved.status).toBe('active');
  });

  afterAll(async () => {
    // Retour aux valeurs décidées pour les autres suites.
    await setting('withdrawal_min_usd', '10');
    await setting('withdrawal_dual_approval_usd', '50');
    await app.close();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('réserve, fait valider par deux administrateurs au-delà du seuil, puis verse', async () => {
    const first = await availableCommission('6');
    const second = await availableCommission('6');
    await setting('withdrawal_min_usd', '1');
    await setting('withdrawal_dual_approval_usd', '5');

    const method = await contributor.api.post('/api/v1/me/withdrawal-methods', {
      type: 'mobile_money',
      countryIso2: 'SN',
      provider: 'Orange Money',
      accountHolder: 'Awa Diallo',
      accountNumber: '+221 77 123 45 67',
    });
    expect(method.status).toBe(201);
    const methodBody = method.body as WithdrawalMethodResponse;
    expect(methodBody.maskedAccount).toBe('••• 4567');
    const stored = await prisma.withdrawalMethod.findUniqueOrThrow({
      where: { id: methodBody.id },
    });
    expect(stored.detailsEncrypted).not.toContain('771234567');

    const ask = (amountUsd: string) =>
      contributor.api.post('/api/v1/me/withdrawals', { methodId: methodBody.id, amountUsd });
    expect(((await ask('0.50')).body as { code: string }).code).toBe('WITHDRAWAL_BELOW_MINIMUM');
    expect(((await ask('13')).body as { code: string }).code).toBe('WITHDRAWAL_INSUFFICIENT_FUNDS');

    const created = await ask('8');
    expect(created.status).toBe(201);
    const request = created.body as WithdrawalResponse;
    expect(request.status).toBe('pending');
    expect(((await ask('1')).body as { code: string }).code).toBe('WITHDRAWAL_ALREADY_OPEN');

    let balance = await wallet();
    expect(balance.availableUsd).toBe('4.000000');
    expect(balance.reservedUsd).toBe('8.000000');

    expect((await decide(approver, request.id, { action: 'approve' })).status).toBe(200);
    expect((await decide(approver, request.id, { action: 'process' })).status).toBe(200);
    const sameAdmin = await decide(approver, request.id, {
      action: 'pay',
      payoutReference: 'OM-2026-1112-001',
      paidOn: day(0),
    });
    expect((sameAdmin.body as { code: string }).code).toBe('WITHDRAWAL_DUAL_APPROVAL');
    expect(
      (
        (await decide(payer, request.id, { action: 'pay', paidOn: day(0) })).body as {
          code: string;
        }
      ).code,
    ).toBe('VALIDATION_FAILED');

    const paid = await decide(payer, request.id, {
      action: 'pay',
      payoutReference: 'OM-2026-1112-001',
      paidOn: day(0),
    });
    expect(paid.status).toBe(200);
    const view = paid.body as AdminWithdrawalResponse;
    expect(view.status).toBe('paid');
    expect(view.accountNumber).toBe('+221771234567');
    expect(view.events.map((event) => event.toStatus)).toEqual([
      'pending',
      'approved',
      'processing',
      'paid',
    ]);

    balance = await wallet();
    expect(balance.availableUsd).toBe('4.000000');
    expect(balance.reservedUsd).toBe('0.000000');
    expect(balance.totalWithdrawnUsd).toBe('8.000000');
    const statuses = await prisma.commission.findMany({
      where: { id: { in: [first, second] } },
      orderBy: { createdAt: 'asc' },
      select: { status: true },
    });
    expect(statuses.map((row) => row.status)).toEqual(['paid', 'available']);

    await expect(
      prisma.$executeRaw`UPDATE "withdrawal_requests" SET "status" = 'pending' WHERE "id" = ${request.id}::uuid`,
    ).rejects.toThrow(/définitif/);
  });

  it('libère le montant réservé en cas de refus motivé', async () => {
    const methods = (await contributor.api.get('/api/v1/me/withdrawal-methods'))
      .body as WithdrawalMethodResponse[];
    const created = (
      await contributor.api.post('/api/v1/me/withdrawals', {
        methodId: methods[0]?.id,
        amountUsd: '4',
      })
    ).body as WithdrawalResponse;
    expect((await wallet()).availableUsd).toBe('0.000000');

    const noReason = await decide(approver, created.id, { action: 'reject' });
    expect(noReason.status).toBe(400);
    const rejected = await decide(approver, created.id, {
      action: 'reject',
      note: 'Coordonnées Mobile Money à vérifier.',
    });
    expect((rejected.body as AdminWithdrawalResponse).status).toBe('rejected');
    const balance = await wallet();
    expect(balance.availableUsd).toBe('4.000000');
    expect(balance.reservedUsd).toBe('0.000000');

    const totals = await prisma.ledgerEntry.aggregate({ _sum: { debit: true, credit: true } });
    expect(totals._sum.debit?.toFixed(6)).toBe(totals._sum.credit?.toFixed(6));
  });

  it('réserve le traitement aux gestionnaires financiers', async () => {
    const list = await moderator.api.get('/api/v1/admin/withdrawals');
    expect(list.status).toBe(403);
  });
});
