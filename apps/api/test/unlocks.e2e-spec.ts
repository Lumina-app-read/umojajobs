import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import {
  CANDIDATE_TERMS_VERSION,
  type CommissionResponse,
  type DocumentPagesResponse,
  type UnlockedContentsResponse,
  CONTRIBUTOR_TERMS_VERSION,
  type CreditCostResponse,
  type JobOfferResponse,
  type ModerationJobOfferResponse,
  type UnlockResponse,
  type UnlockSummaryResponse,
  type WalletResponse,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';
import { givePaidCredits } from './support/paid-credits';

/** PDF d'une page, valide pour le rendu (texte en Helvetica, police standard). */
function onePagePdf(): Buffer {
  const text = 'BT /F1 24 Tf 72 760 Td (Offre originale) Tj ET';
  return Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      `4 0 obj << /Length ${text.length} >> stream`,
      text,
      'endstream endobj',
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      'trailer << /Root 1 0 R >>',
      '%%EOF',
      '',
    ].join('\n'),
  );
}

const day = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

interface Member {
  userId: string;
  api: ApiClient;
}

describe('Déverrouillages et commissions (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let contributor: Member;
  let moderator: Member;
  let categoryId: string;

  async function member(role?: 'moderator'): Promise<Member> {
    const email = uniqueEmail('unlock');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    await api.post('/api/v1/auth/verify-email', {
      token: extractToken(await waitForEmail(email, 'Confirmez')),
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    if (role) {
      const found = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: found.id } });
    }
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    await api.post('/api/v1/auth/me/contributor-terms', { version: CONTRIBUTOR_TERMS_VERSION });
    return { userId: user.id, api };
  }

  /** Offre active publiée par le contributeur et validée par le modérateur. */
  async function activeOffer(withDocument = false): Promise<ModerationJobOfferResponse> {
    const created = (
      await contributor.api.post('/api/v1/me/job-offers', {
        title: `Comptable ${randomUUID().slice(0, 8)}`,
        companyName: 'Logistique Ouest SA',
        countryIso2: 'SN',
        categoryId,
        contractType: 'permanent',
        workMode: 'on_site',
        description: 'Tenue de la comptabilité générale et des états financiers.',
        startDate: day(0),
        endDate: day(20),
        sourceType: 'company_website',
        applicationEmail: 'recrutement@logistique-ouest.example',
        applicationInstructions: 'Référence COMPTA-42 en objet.',
        applicationPhone: '+221771234567',
        contributorTips: 'Joindre une attestation de stage : le recruteur la demande toujours.',
      })
    ).body as JobOfferResponse;
    if (withDocument) {
      const uploaded = await contributor.api.upload(
        `/api/v1/me/job-offers/${created.id}/files`,
        { buffer: onePagePdf(), filename: 'annonce.pdf', contentType: 'application/pdf' },
        { kind: 'original' },
      );
      expect(uploaded.status).toBe(201);
      created.version = (uploaded.body as JobOfferResponse).version;
    }
    const submitted = (
      await contributor.api.post(`/api/v1/me/job-offers/${created.id}/submit`, {
        version: created.version,
        declarationAccepted: true,
      })
    ).body as JobOfferResponse;
    return (
      await moderator.api.post(`/api/v1/admin/job-offers/${submitted.id}/approve`, {
        version: submitted.version,
      })
    ).body as ModerationJobOfferResponse;
  }

  /**
   * Approvisionne un compte : `purchase` reproduit l'attribution d'une recharge payée
   * (étape 3c, pas encore branchée), `grant` une dotation gratuite.
   */
  async function fund(userId: string, credits: number, origin: 'purchase' | 'grant') {
    if (origin === 'purchase') {
      await givePaidCredits(prisma, userId, credits);
      return;
    }
    await prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
      const balance = account.balance + credits;
      const movement = await tx.creditMovement.create({
        data: {
          accountId: account.id,
          type: origin,
          quantity: credits,
          balanceAfter: balance,
          idempotencyKey: `test-fund:${randomUUID()}`,
        },
      });
      const lot = await tx.creditLot.create({
        data: {
          accountId: account.id,
          origin,
          creditsTotal: credits,
          creditsRemaining: credits,
          creditUnitValueUsd: new Prisma.Decimal('0.10'),
          commissionable: false,
        },
      });
      await tx.creditLotAllocation.create({
        data: {
          movementId: movement.id,
          lotId: lot.id,
          credits,
          valueUsd: new Prisma.Decimal('0.10').mul(credits),
        },
      });
      await tx.creditAccount.update({ where: { id: account.id }, data: { balance } });
    });
  }

  const acceptRules = async (who: Member) => {
    const accepted = await who.api.post('/api/v1/auth/me/candidate-terms', {
      version: CANDIDATE_TERMS_VERSION,
    });
    expect(accepted.status).toBe(200);
  };

  const unlock = (who: Member, jobOfferId: string) =>
    who.api.post('/api/v1/me/unlocks', { jobOfferId });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    await redis.flushdb();
    categoryId = (
      await prisma.jobCategory.findUniqueOrThrow({ where: { slug: 'accounting-finance' } })
    ).id;
    contributor = await member();
    moderator = await member('moderator');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('publie les coûts des services sans authentification', async () => {
    const costs = (await new ApiClient(app).get('/api/v1/credit-costs'))
      .body as CreditCostResponse[];
    expect(costs.find((cost) => cost.service === 'unlock_standard')?.credits).toBe(5);
  });

  it('refuse un solde insuffisant et ne révèle rien sans déverrouillage', async () => {
    const offer = await activeOffer();
    const reader = await member();
    const refused = await unlock(reader, offer.id);
    expect(refused.status).toBe(422);
    expect((refused.body as { code: string }).code).toBe('INSUFFICIENT_CREDITS');
    expect((await reader.api.get(`/api/v1/me/unlocks/${offer.id}`)).status).toBe(404);
  });

  it('déverrouille une seule fois, même en cas de clics répétés ou simultanés', async () => {
    const offer = await activeOffer();
    const reader = await member();
    await fund(reader.userId, 12, 'grant');

    const results = await Promise.all([1, 2, 3].map(() => unlock(reader, offer.id)));
    expect(results.every((result) => result.status === 200)).toBe(true);
    const bodies = results.map((result) => result.body as UnlockResponse);
    expect(bodies.filter((body) => body.charged)).toHaveLength(1);
    // Coordonnées révélées seulement après acceptation du règlement des candidats.
    const gated = await reader.api.get(`/api/v1/me/unlocks/${offer.id}`);
    expect(gated.status).toBe(403);
    expect((gated.body as { code: string }).code).toBe('CANDIDATE_TERMS_REQUIRED');
    await acceptRules(reader);
    const contents = (await reader.api.get(`/api/v1/me/unlocks/${offer.id}`))
      .body as UnlockedContentsResponse;
    expect(contents.applicationEmail).toBe('recrutement@logistique-ouest.example');
    expect(contents.applicationPhone).toBe('+221771234567');
    expect(contents.contributorTips).toContain('attestation de stage');
    expect(contents.publishedBy).toBe('Awa D.');

    const again = (await unlock(reader, offer.id)).body as UnlockResponse;
    expect(again.charged).toBe(false);
    expect(again.balance).toBe(7);
    const account = await prisma.creditAccount.findUniqueOrThrow({
      where: { userId: reader.userId },
    });
    expect(account.balance).toBe(7);

    // Crédits gratuits : aucune commission (arbitrage A2).
    expect(await prisma.commission.count({ where: { jobOffer: { id: offer.id } } })).toBe(0);
    const list = (await reader.api.get('/api/v1/me/unlocks')).body as UnlockSummaryResponse[];
    expect(list.map((entry) => entry.offer.id)).toEqual([offer.id]);
  });

  it('refuse le déverrouillage de sa propre offre', async () => {
    const offer = await activeOffer();
    await fund(contributor.userId, 10, 'purchase');
    const refused = await unlock(contributor, offer.id);
    expect(refused.status).toBe(403);
    expect((refused.body as { code: string }).code).toBe('JOB_UNLOCK_OWN_OFFER');
  });

  it('crée une commission en attente de 30 % sur des crédits payés, inscrite au grand livre', async () => {
    const offer = await activeOffer();
    const buyer = await member();
    await fund(buyer.userId, 20, 'purchase');

    expect((await unlock(buyer, offer.id)).status).toBe(200);
    const commission = await prisma.commission.findFirstOrThrow({
      where: { jobOfferId: offer.id },
      include: { events: true, ledgerTransaction: { include: { entries: true } } },
    });
    expect(commission.contributorId).toBe(contributor.userId);
    expect(commission.status).toBe('pending');
    expect(commission.baseValueUsd.toFixed(6)).toBe('0.500000');
    expect(commission.amountUsd.toFixed(6)).toBe('0.150000');
    expect(commission.events.map((event) => event.toStatus)).toEqual(['pending']);
    const entries = commission.ledgerTransaction.entries;
    expect(entries.reduce((sum, e) => sum.add(e.debit), new Prisma.Decimal(0)).toFixed(6)).toBe(
      '0.150000',
    );

    const wallet = (await contributor.api.get('/api/v1/me/wallet')).body as WalletResponse;
    expect(Number(wallet.pendingUsd)).toBeGreaterThanOrEqual(0.15);
    expect(wallet.availableUsd).toBe('0.000000');
    expect(wallet.withdrawalMinUsd).toBe('10.00');
    expect(wallet.totalEarnedUsd).toBe(wallet.pendingUsd);

    const mine = (await contributor.api.get('/api/v1/me/commissions')).body as CommissionResponse[];
    expect(mine.find((entry) => entry.offer.id === offer.id)?.amountUsd).toBe('0.150000');

    // Montant et bénéficiaire sont figés en base.
    await expect(
      prisma.$executeRaw`UPDATE "commissions" SET "amount_usd" = 99 WHERE "id" = ${commission.id}::uuid`,
    ).rejects.toThrow(/non modifiables/);
  });

  it('ferme le déverrouillage d’une offre suspendue, mais conserve l’accès déjà acquis', async () => {
    const offer = await activeOffer();
    const early = await member();
    const late = await member();
    await fund(early.userId, 5, 'grant');
    await fund(late.userId, 5, 'grant');
    expect((await unlock(early, offer.id)).status).toBe(200);

    await moderator.api.post(`/api/v1/admin/job-offers/${offer.id}/suspend`, {
      version: offer.version,
      reason: 'Vérification complémentaire nécessaire.',
    });
    const refused = await unlock(late, offer.id);
    expect(refused.status).toBe(409);
    expect((refused.body as { code: string }).code).toBe('JOB_UNLOCK_UNAVAILABLE');
    expect(
      (await prisma.creditAccount.findUniqueOrThrow({ where: { userId: late.userId } })).balance,
    ).toBe(5);

    await acceptRules(early);
    const kept = await early.api.get(`/api/v1/me/unlocks/${offer.id}`);
    expect(kept.status).toBe(200);
  });

  it('affiche les documents en images marquées, sans jamais servir le fichier d’origine', async () => {
    const offer = await activeOffer(true);
    const reader = await member();
    await fund(reader.userId, 5, 'grant');
    expect((await unlock(reader, offer.id)).status).toBe(200);
    await acceptRules(reader);

    const contents = (await reader.api.get(`/api/v1/me/unlocks/${offer.id}`))
      .body as UnlockedContentsResponse;
    const file = contents.files[0];
    expect(file?.kind).toBe('original');
    const base = `/api/v1/me/unlocks/${offer.id}/files/${file?.id}`;

    const pages = await reader.api.get(base);
    expect(pages.status).toBe(200);
    expect((pages.body as DocumentPagesResponse).pageCount).toBe(1);

    const image = await reader.api.get(`${base}/pages/1`);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/webp');
    expect(image.headers['cache-control']).toBe('private, no-store');
    expect(image.headers['content-disposition']).toBe('inline');
    expect((await reader.api.get(`${base}/pages/2`)).status).toBe(404);

    // Aucun lien de téléchargement pour un lecteur, et rien pour qui n'a pas déverrouillé.
    expect((await reader.api.post(`${base}/download`)).status).toBe(404);
    const stranger = await member();
    expect((await stranger.api.get(base)).status).toBe(404);
    expect(
      await prisma.fileDownloadLog.count({ where: { fileId: file?.id, purpose: 'unlock' } }),
    ).toBe(1);
  });
});
