import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { type INestApplication } from '@nestjs/common';
import {
  type AdminCreditPackResponse,
  CONTRIBUTOR_TERMS_VERSION,
  type CreditCheckoutResponse,
  type CreditOrderResponse,
  type CreditPackResponse,
  type JobOfferResponse,
  type ModerationJobOfferResponse,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import request from 'supertest';
import { totp } from '../src/auth/totp/totp';
import { PaymentReconciliationService } from '../src/payments/payment-reconciliation.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';

const SECRET = 'whsec_test_secret';
const DAY = 86_400_000;

interface FakeSale {
  id: string;
  status: string;
  amount: { value: number; currency: string };
  product: { id: string };
  settlement: {
    amount: number | null;
    service_fee: number | null;
    due_at: string | null;
    done_at: string | null;
  };
  is_access_revoked: boolean;
}

interface Member {
  userId: string;
  api: ApiClient;
}

describe('Recharges de crédits Chariow (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let fake: Server;
  let admin: Member;
  let packId: string;
  const productId = `prd_${randomBytes(4).toString('hex')}`;
  /** Ventes du faux Chariow, et prochaine vente créée par POST /checkout. */
  const sales = new Map<string, FakeSale>();
  const checkouts: unknown[] = [];

  function startFakeChariow(): Promise<void> {
    fake = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        if (req.headers.authorization !== 'Bearer test_chariow_key') {
          res.statusCode = 401;
          res.end('{}');
          return;
        }
        if (req.method === 'POST' && req.url === '/v1/checkout') {
          const body = JSON.parse(Buffer.concat(chunks).toString()) as { product_id: string };
          checkouts.push(body);
          const id = `sal_${randomBytes(6).toString('hex')}`;
          sales.set(id, {
            id,
            status: 'awaiting_payment',
            amount: { value: 10, currency: 'USD' },
            product: { id: body.product_id },
            settlement: { amount: null, service_fee: null, due_at: null, done_at: null },
            is_access_revoked: false,
          });
          res.end(
            JSON.stringify({
              data: {
                step: 'payment',
                message: null,
                purchase: { id, status: 'awaiting_payment' },
                payment: { checkout_url: `https://pay.example/${id}` },
              },
            }),
          );
          return;
        }
        const match = /^\/v1\/sales\/(sal_[a-z0-9_]+)$/.exec(req.url ?? '');
        const sale = match ? sales.get(match[1] as string) : undefined;
        if (req.method === 'GET' && sale) {
          res.end(JSON.stringify({ data: sale }));
          return;
        }
        res.statusCode = 404;
        res.end('{}');
      });
    });
    return new Promise((resolve) => fake.listen(4599, '127.0.0.1', () => resolve()));
  }

  async function member(role?: 'moderator' | 'super_admin'): Promise<Member> {
    const email = uniqueEmail('recharge');
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

  const sign = (body: string) =>
    `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;

  function pulse(saleId: string, deliveryId: string, signature?: string) {
    const body = JSON.stringify({ event: 'successful.sale', sale: { id: saleId } });
    return request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/api/v1/payments/chariow/pulse')
      .set('Content-Type', 'application/json')
      .set('x-pulse-delivery-id', deliveryId)
      .set('x-pulse-event', 'successful.sale')
      .set('x-chariow-signature', signature ?? sign(body))
      .send(body);
  }

  async function waitForStatus(who: Member, reference: string, status: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const order = (await who.api.get(`/api/v1/me/credit-orders/${reference}`))
        .body as CreditOrderResponse;
      if (order.status === status) return order;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Commande ${reference} jamais passée à ${status}`);
  }

  const buy = async (who: Member) =>
    (await who.api.post('/api/v1/me/credit-orders', { packId, phone: '+221 77 123 45 67' }))
      .body as CreditCheckoutResponse;

  const saleOf = async (reference: string) =>
    (await prisma.creditOrder.findUniqueOrThrow({ where: { reference } })).providerSaleId as string;

  beforeAll(async () => {
    await startFakeChariow();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    await redis.flushdb();
    admin = await member('super_admin');
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => fake.close(resolve));
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('refuse un pack dont le prix ne vaut pas crédits × valeur, puis publie un pack valide', async () => {
    const base = {
      sku: `pack_${randomBytes(3).toString('hex')}`,
      name: 'Pack 100 crédits',
      credits: 100,
      chariowProductId: productId,
      isActive: true,
      sortOrder: 1,
    };
    const invalid = await admin.api.post('/api/v1/admin/credit-packs', {
      ...base,
      priceUsd: '9.00',
    });
    expect((invalid.body as { code: string }).code).toBe('CREDIT_PACK_INVALID');
    const created = await admin.api.post('/api/v1/admin/credit-packs', {
      ...base,
      priceUsd: '10.00',
    });
    expect(created.status).toBe(201);
    packId = (created.body as AdminCreditPackResponse[]).find((pack) => pack.sku === base.sku)
      ?.id as string;
    const publicPacks = (await new ApiClient(app).get('/api/v1/credit-packs'))
      .body as CreditPackResponse[];
    expect(publicPacks.map((pack) => pack.id)).toContain(packId);
  });

  it('ouvre le paiement chez Chariow, puis crédite une seule fois sur Pulse signée', async () => {
    const buyer = await member();
    const noPhone = await buyer.api.post('/api/v1/me/credit-orders', { packId });
    expect((noPhone.body as { code: string }).code).toBe('PHONE_REQUIRED');

    const order = await buy(buyer);
    expect(order.checkoutUrl).toMatch(/^https:\/\/pay\.example\/sal_/);
    expect(checkouts.at(-1)).toMatchObject({
      product_id: productId,
      phone: { number: '771234567', country_code: 'SN' },
      custom_metadata: { order_ref: order.reference },
    });
    const saleId = await saleOf(order.reference);

    // Le paiement n'est pas encore confirmé chez Chariow : rien n'est crédité.
    const early = await pulse(saleId, randomUUID());
    expect(early.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(
      (
        (await buyer.api.get(`/api/v1/me/credit-orders/${order.reference}`))
          .body as CreditOrderResponse
      ).status,
    ).toBe('pending');

    const forged = await pulse(saleId, randomUUID(), 'sha256=00');
    expect(forged.status).toBe(401);

    (sales.get(saleId) as FakeSale).status = 'completed';
    const delivery = randomUUID();
    expect((await pulse(saleId, delivery)).status).toBe(200);
    await waitForStatus(buyer, order.reference, 'paid');
    await pulse(saleId, delivery);
    await pulse(saleId, randomUUID());
    await new Promise((resolve) => setTimeout(resolve, 300));

    const account = await prisma.creditAccount.findUniqueOrThrow({
      where: { userId: buyer.userId },
    });
    expect(account.balance).toBe(100);
    const lots = await prisma.creditLot.findMany({ where: { accountId: account.id } });
    expect(lots).toHaveLength(1);
    expect(lots[0]?.commissionable).toBe(true);
    expect(await prisma.paymentEvent.count({ where: { saleId } })).toBe(4);
    const totals = await prisma.ledgerEntry.aggregate({ _sum: { debit: true, credit: true } });
    expect(totals._sum.debit?.toFixed(6)).toBe(totals._sum.credit?.toFixed(6));
  });

  it('crédite dès que la page de retour consulte la commande, sans attendre la Pulse', async () => {
    const buyer = await member();
    const order = await buy(buyer);
    const saleId = await saleOf(order.reference);
    const pending = (await buyer.api.get(`/api/v1/me/credit-orders/${order.reference}`))
      .body as CreditOrderResponse;
    expect(pending.status).toBe('pending');

    (sales.get(saleId) as FakeSale).status = 'completed';
    await redis.flushdb(); // délai minimal entre deux relectures
    const paid = (await buyer.api.get(`/api/v1/me/credit-orders/${order.reference}`))
      .body as CreditOrderResponse;
    expect(paid.status).toBe('paid');
    expect(
      (await prisma.creditAccount.findUniqueOrThrow({ where: { userId: buyer.userId } })).balance,
    ).toBe(100);
  });

  it('place en anomalie une vente dont le montant ne correspond pas, sans crédit', async () => {
    const buyer = await member();
    const order = await buy(buyer);
    const saleId = await saleOf(order.reference);
    Object.assign(sales.get(saleId) as FakeSale, {
      status: 'completed',
      amount: { value: 5, currency: 'USD' },
    });
    await pulse(saleId, randomUUID());
    await waitForStatus(buyer, order.reference, 'anomaly');
    expect(await prisma.creditAccount.count({ where: { userId: buyer.userId } })).toBe(0);
  });

  it('rattrape une Pulse perdue par réconciliation, puis libère la commission après règlement', async () => {
    const contributor = await member();
    const moderator = await member('moderator');
    const categoryId = (
      await prisma.jobCategory.findUniqueOrThrow({ where: { slug: 'accounting-finance' } })
    ).id;
    const created = (
      await contributor.api.post('/api/v1/me/job-offers', {
        title: 'Contrôleur de gestion',
        companyName: 'Société des Eaux',
        countryIso2: 'SN',
        categoryId,
        contractType: 'permanent',
        workMode: 'on_site',
        description: 'Suivi budgétaire et tableaux de bord mensuels.',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 20 * DAY).toISOString().slice(0, 10),
        sourceType: 'company_website',
        applicationEmail: 'rh@eaux.example',
      })
    ).body as JobOfferResponse;
    const submitted = (
      await contributor.api.post(`/api/v1/me/job-offers/${created.id}/submit`, {
        version: created.version,
        declarationAccepted: true,
      })
    ).body as JobOfferResponse;
    const offer = (
      await moderator.api.post(`/api/v1/admin/job-offers/${submitted.id}/approve`, {
        version: submitted.version,
      })
    ).body as ModerationJobOfferResponse;

    const buyer = await member();
    const order = await buy(buyer);
    const saleId = await saleOf(order.reference);
    (sales.get(saleId) as FakeSale).status = 'completed';

    const reconciliation = app.get(PaymentReconciliationService);
    await reconciliation.run(new Date(Date.now() + 2 * 60_000));
    await waitForStatus(buyer, order.reference, 'paid');

    expect((await buyer.api.post('/api/v1/me/unlocks', { jobOfferId: offer.id })).status).toBe(200);
    const commission = await prisma.commission.findFirstOrThrow({
      where: { jobOfferId: offer.id },
    });
    expect(commission.status).toBe('pending');

    // Délai écoulé mais vente non réglée : la commission reste en attente.
    expect(await reconciliation.releaseCommissions(new Date(Date.now() + 31 * DAY))).toBe(0);

    Object.assign(sales.get(saleId) as FakeSale, {
      status: 'settled',
      settlement: {
        amount: 8.5,
        service_fee: 1.5,
        due_at: null,
        done_at: new Date().toISOString(),
      },
    });
    await reconciliation.run(new Date(Date.now() + 2 * 60_000));
    const payment = await prisma.payment.findFirstOrThrow({ where: { providerSaleId: saleId } });
    expect(payment.serviceFee?.toFixed(2)).toBe('1.50');

    // Nouveau contributeur : 30 jours de retenue, pas 14.
    expect(await reconciliation.releaseCommissions(new Date(Date.now() + 15 * DAY))).toBe(0);
    expect(await reconciliation.releaseCommissions(new Date(Date.now() + 31 * DAY))).toBe(1);
    const released = await prisma.commission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(released.status).toBe('available');

    const totals = await prisma.ledgerEntry.aggregate({ _sum: { debit: true, credit: true } });
    expect(totals._sum.debit?.toFixed(6)).toBe(totals._sum.credit?.toFixed(6));
  });
});
