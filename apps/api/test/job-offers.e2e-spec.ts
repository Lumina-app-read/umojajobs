import { type INestApplication } from '@nestjs/common';
import { type JobOfferResponse, type ModerationJobOfferResponse } from '@opportinities/shared';
import type Redis from 'ioredis';
import { JobOfferLifecycleService } from '../src/jobs/job-offer-lifecycle.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';

interface ErrorBody {
  code: string;
  details?: { field: string; rules: string[] }[];
  meta?: { missingFields?: string[]; problem?: string };
}

/** Date calendaire décalée de `days` jours (le Sénégal est à UTC+0 toute l'année). */
const day = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe('Offres d’emploi : publication et modération (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let categoryId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    categoryId = (
      await prisma.jobCategory.findUniqueOrThrow({ where: { slug: 'accounting-finance' } })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  async function loggedInUser(role?: 'moderator'): Promise<{ userId: string; api: ApiClient }> {
    const email = uniqueEmail('jobs');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    const token = extractToken(await waitForEmail(email, 'Confirmez'));
    await api.post('/api/v1/auth/verify-email', { token });
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    if (role) {
      const found = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: found.id } });
    }
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    return { userId: user.id, api };
  }

  const completeOffer = (overrides: Record<string, unknown> = {}) => ({
    title: 'Comptable confirmé',
    companyName: 'Logistique Ouest SA',
    countryIso2: 'SN',
    categoryId,
    contractType: 'permanent',
    workMode: 'on_site',
    description: 'Tenue de la comptabilité générale et préparation des états financiers.',
    requirements: 'Licence en comptabilité, trois ans d’expérience.',
    skills: ['SYSCOHADA', 'Excel', 'excel', ' '],
    startDate: day(0),
    endDate: day(30),
    sourceType: 'company_website',
    sourceUrl: 'https://logistique-ouest.example/carrieres/42',
    applicationEmail: 'recrutement@logistique-ouest.example',
    ...overrides,
  });

  async function createSubmitted(
    api: ApiClient,
    overrides: Record<string, unknown> = {},
  ): Promise<JobOfferResponse> {
    const created = (await api.post('/api/v1/me/job-offers', completeOffer(overrides)))
      .body as JobOfferResponse;
    const submitted = await api.post(`/api/v1/me/job-offers/${created.id}/submit`, {
      version: created.version,
      declarationAccepted: true,
    });
    expect(submitted.status).toBe(200);
    return submitted.body as JobOfferResponse;
  }

  describe('contributeur', () => {
    it('crée un brouillon incomplet et indique les champs manquants', async () => {
      const { api } = await loggedInUser();
      const response = await api.post('/api/v1/me/job-offers', { title: 'Assistant de direction' });
      expect(response.status).toBe(201);
      const offer = response.body as JobOfferResponse;
      expect(offer.status).toBe('draft');
      expect(offer.missingFields).toEqual(
        expect.arrayContaining(['companyName', 'countryIso2', 'endDate']),
      );
      expect(offer.history).toEqual([
        expect.objectContaining({ fromStatus: null, toStatus: 'draft', by: 'contributor' }),
      ]);
    });

    it('nettoie les compétences et calcule la fenêtre de validité dans le fuseau du pays', async () => {
      const { api } = await loggedInUser();
      const offer = (await api.post('/api/v1/me/job-offers', completeOffer()))
        .body as JobOfferResponse;
      expect(offer.skills).toEqual(['SYSCOHADA', 'Excel']);
      expect(offer.timezone).toBe('Africa/Dakar');
      expect(offer.startsAt).toBe(`${day(0)}T00:00:00.000Z`);
      expect(offer.endsAt).toBe(`${day(31)}T00:00:00.000Z`);
      expect(offer.missingFields).toEqual([]);
    });

    it('refuse une date de fin antérieure au début et un salaire maximum inférieur au minimum', async () => {
      const { api } = await loggedInUser();
      const dates = await api.post('/api/v1/me/job-offers', {
        startDate: day(10),
        endDate: day(5),
      });
      expect(dates.status).toBe(400);
      expect((dates.body as ErrorBody).code).toBe('JOB_OFFER_INVALID_DATES');

      const salary = await api.post('/api/v1/me/job-offers', {
        salaryMin: 500000,
        salaryMax: 300000,
      });
      expect(salary.status).toBe(400);
      expect((salary.body as ErrorBody).details?.[0]?.field).toBe('salaryMax');
    });

    it('ne laisse voir ni modifier l’offre d’un autre contributeur (404)', async () => {
      const owner = await loggedInUser();
      const other = await loggedInUser();
      const offer = (await owner.api.post('/api/v1/me/job-offers', { title: 'Juriste' }))
        .body as JobOfferResponse;
      expect((await other.api.get(`/api/v1/me/job-offers/${offer.id}`)).status).toBe(404);
      const patch = await other.api.patch(`/api/v1/me/job-offers/${offer.id}`, {
        version: 1,
        title: 'Piratage',
      });
      expect(patch.status).toBe(404);
    });

    it('refuse une modification sur une version périmée (409)', async () => {
      const { api } = await loggedInUser();
      const offer = (await api.post('/api/v1/me/job-offers', { title: 'Chauffeur' }))
        .body as JobOfferResponse;
      await api.patch(`/api/v1/me/job-offers/${offer.id}`, {
        version: 1,
        title: 'Chauffeur poids lourd',
      });
      const stale = await api.patch(`/api/v1/me/job-offers/${offer.id}`, {
        version: 1,
        title: 'Chauffeur livreur',
      });
      expect(stale.status).toBe(409);
      expect((stale.body as ErrorBody).code).toBe('JOB_OFFER_VERSION_CONFLICT');
    });

    it('exige une offre complète, la déclaration et une date de fin non dépassée', async () => {
      const { api } = await loggedInUser();
      const draft = (await api.post('/api/v1/me/job-offers', { title: 'Infirmier' }))
        .body as JobOfferResponse;
      const incomplete = await api.post(`/api/v1/me/job-offers/${draft.id}/submit`, {
        version: draft.version,
        declarationAccepted: true,
      });
      expect(incomplete.status).toBe(400);
      expect((incomplete.body as ErrorBody).code).toBe('JOB_OFFER_INCOMPLETE');
      expect((incomplete.body as ErrorBody).meta?.missingFields).toContain('companyName');

      const complete = (await api.post('/api/v1/me/job-offers', completeOffer()))
        .body as JobOfferResponse;
      const noDeclaration = await api.post(`/api/v1/me/job-offers/${complete.id}/submit`, {
        version: complete.version,
        declarationAccepted: false,
      });
      expect(noDeclaration.status).toBe(400);

      const ended = (
        await api.post(
          '/api/v1/me/job-offers',
          completeOffer({ startDate: day(-20), endDate: day(-1) }),
        )
      ).body as JobOfferResponse;
      const late = await api.post(`/api/v1/me/job-offers/${ended.id}/submit`, {
        version: ended.version,
        declarationAccepted: true,
      });
      expect(late.status).toBe(400);
      expect((late.body as ErrorBody).code).toBe('JOB_OFFER_ALREADY_ENDED');
    });

    it('fige une version à la soumission et bloque ensuite les modifications', async () => {
      const { api } = await loggedInUser();
      const offer = await createSubmitted(api);
      expect(offer.status).toBe('pending_review');
      expect(await prisma.jobOfferRevision.count({ where: { jobOfferId: offer.id } })).toBe(1);
      const edit = await api.patch(`/api/v1/me/job-offers/${offer.id}`, {
        version: offer.version,
        title: 'Autre',
      });
      expect(edit.status).toBe(409);
      expect((edit.body as ErrorBody).code).toBe('JOB_OFFER_NOT_EDITABLE');
    });
  });

  describe('modération', () => {
    it('est réservée aux comptes ayant la permission jobs.moderate', async () => {
      const { api } = await loggedInUser();
      expect((await api.get('/api/v1/admin/job-offers')).status).toBe(403);
    });

    it('valide une offre : active si elle a commencé, programmée sinon', async () => {
      const contributor = await loggedInUser();
      const moderator = await loggedInUser('moderator');
      const now = await createSubmitted(contributor.api);
      const later = await createSubmitted(contributor.api, {
        title: 'Auditeur interne',
        startDate: day(5),
      });

      const queue = await moderator.api.get('/api/v1/admin/job-offers');
      expect((queue.body as { id: string }[]).map((offer) => offer.id)).toEqual(
        expect.arrayContaining([now.id, later.id]),
      );

      const approved = await moderator.api.post(`/api/v1/admin/job-offers/${now.id}/approve`, {
        version: now.version,
      });
      expect(approved.status).toBe(200);
      expect((approved.body as ModerationJobOfferResponse).status).toBe('active');
      expect((approved.body as ModerationJobOfferResponse).publishedAt).not.toBeNull();

      const scheduled = await moderator.api.post(`/api/v1/admin/job-offers/${later.id}/approve`, {
        version: later.version,
      });
      expect((scheduled.body as ModerationJobOfferResponse).status).toBe('scheduled');
    });

    it('demande une correction motivée, que le contributeur voit avant de resoumettre', async () => {
      const contributor = await loggedInUser();
      const moderator = await loggedInUser('moderator');
      const offer = await createSubmitted(contributor.api);

      const noReason = await moderator.api.post(
        `/api/v1/admin/job-offers/${offer.id}/request-correction`,
        { version: offer.version },
      );
      expect(noReason.status).toBe(400);

      const reason = 'Ajoutez le lien officiel de l’annonce et vérifiez la date limite.';
      await moderator.api.post(`/api/v1/admin/job-offers/${offer.id}/request-correction`, {
        version: offer.version,
        reason,
      });
      const mine = (await contributor.api.get(`/api/v1/me/job-offers/${offer.id}`))
        .body as JobOfferResponse;
      expect(mine.status).toBe('needs_correction');
      expect(mine.history.at(-1)).toMatchObject({ by: 'moderator', reason });

      const fixed = (
        await contributor.api.patch(`/api/v1/me/job-offers/${offer.id}`, {
          version: mine.version,
          sourceDetails: 'Page carrières officielle',
        })
      ).body as JobOfferResponse;
      const resubmitted = await contributor.api.post(`/api/v1/me/job-offers/${offer.id}/submit`, {
        version: fixed.version,
        declarationAccepted: true,
      });
      expect((resubmitted.body as JobOfferResponse).status).toBe('pending_review');
      expect(await prisma.jobOfferRevision.count({ where: { jobOfferId: offer.id } })).toBe(2);
    });

    it('signale les doublons et interdit de modérer sa propre offre', async () => {
      const moderator = await loggedInUser('moderator');
      const other = await loggedInUser();
      const original = await createSubmitted(other.api, { companyName: 'Banque Atlantique' });
      // Même entreprise et même intitulé, écrits autrement, partagés par le modérateur lui-même.
      const copy = await createSubmitted(moderator.api, {
        companyName: 'BANQUE  atlantique',
        title: 'comptable confirme',
        sourceUrl: 'https://autre-source.example/annonce',
      });

      const view = (await moderator.api.get(`/api/v1/admin/job-offers/${original.id}`))
        .body as ModerationJobOfferResponse;
      expect(view.duplicates.map((offer) => offer.id)).toContain(copy.id);
      expect(view.contributor.id).toBe(other.userId);

      const self = await moderator.api.post(`/api/v1/admin/job-offers/${copy.id}/approve`, {
        version: copy.version,
      });
      expect(self.status).toBe(403);
      expect((self.body as ErrorBody).code).toBe('JOB_OFFER_SELF_MODERATION');
    });

    it('rejette, suspend et refuse les transitions impossibles', async () => {
      const contributor = await loggedInUser();
      const moderator = await loggedInUser('moderator');
      const reason = 'Annonce non vérifiable auprès de l’entreprise citée.';

      const toReject = await createSubmitted(contributor.api, { title: 'Commercial terrain' });
      const rejected = await moderator.api.post(`/api/v1/admin/job-offers/${toReject.id}/reject`, {
        version: toReject.version,
        reason,
      });
      expect((rejected.body as ModerationJobOfferResponse).status).toBe('rejected');
      const again = await moderator.api.post(`/api/v1/admin/job-offers/${toReject.id}/approve`, {
        version: (rejected.body as ModerationJobOfferResponse).version,
      });
      expect(again.status).toBe(409);
      expect((again.body as ErrorBody).code).toBe('JOB_OFFER_INVALID_TRANSITION');

      const toSuspend = await createSubmitted(contributor.api, { title: 'Caissier' });
      const active = (
        await moderator.api.post(`/api/v1/admin/job-offers/${toSuspend.id}/approve`, {
          version: toSuspend.version,
        })
      ).body as ModerationJobOfferResponse;
      const suspended = await moderator.api.post(
        `/api/v1/admin/job-offers/${toSuspend.id}/suspend`,
        {
          version: active.version,
          reason: 'Signalement de fraude en cours d’examen.',
        },
      );
      expect((suspended.body as ModerationJobOfferResponse).status).toBe('suspended');
    });

    it('conserve un historique complet et inaltérable', async () => {
      const contributor = await loggedInUser();
      const moderator = await loggedInUser('moderator');
      const offer = await createSubmitted(contributor.api, { title: 'Électricien' });
      await moderator.api.post(`/api/v1/admin/job-offers/${offer.id}/approve`, {
        version: offer.version,
      });

      const history = await prisma.jobOfferStatusHistory.findMany({
        where: { jobOfferId: offer.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(history.map((entry) => entry.toStatus)).toEqual(['draft', 'pending_review', 'active']);
      expect(history[2]).toMatchObject({
        actorId: moderator.userId,
        actorRoles: ['moderator', 'user'],
      });
      expect(history[2]?.requestId).toBeTruthy();

      await expect(
        prisma.jobOfferStatusHistory.updateMany({
          where: { jobOfferId: offer.id },
          data: { reason: 'falsifié' },
        }),
      ).rejects.toThrow(/ajout seul/);
      await expect(
        prisma.jobOfferRevision.deleteMany({ where: { jobOfferId: offer.id } }),
      ).rejects.toThrow(/ajout seul/);
    });
  });

  describe('cycle de vie automatique', () => {
    async function approved(startOffset: number, endOffset: number, title: string) {
      const contributor = await loggedInUser();
      const moderator = await loggedInUser('moderator');
      const offer = await createSubmitted(contributor.api, {
        title,
        startDate: day(startOffset),
        endDate: day(endOffset),
      });
      return (
        await moderator.api.post(`/api/v1/admin/job-offers/${offer.id}/approve`, {
          version: offer.version,
        })
      ).body as ModerationJobOfferResponse;
    }

    const statusOf = async (id: string) =>
      (await prisma.jobOffer.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

    it('active une offre programmée à sa date de début, sans jamais activer une offre terminée', async () => {
      const offer = await approved(3, 10, 'Technicien réseau');
      expect(offer.status).toBe('scheduled');
      const lifecycle = app.get(JobOfferLifecycleService);

      await lifecycle.run(new Date(Date.parse(offer.startsAt as string) - 60_000));
      expect(await statusOf(offer.id)).toBe('scheduled');

      await lifecycle.run(new Date(Date.parse(offer.startsAt as string) + 60_000));
      expect(await statusOf(offer.id)).toBe('active');
      const row = await prisma.jobOffer.findUniqueOrThrow({ where: { id: offer.id } });
      expect(row.publishedAt).not.toBeNull();
    });

    it('expire une offre active ou suspendue à la fin de sa validité, et conserve l’historique', async () => {
      const active = await approved(0, 5, 'Gestionnaire de stock');
      const suspendedOffer = await approved(0, 5, 'Agent de sécurité');
      const moderator = await loggedInUser('moderator');
      await moderator.api.post(`/api/v1/admin/job-offers/${suspendedOffer.id}/suspend`, {
        version: suspendedOffer.version,
        reason: 'Vérification de la source en cours.',
      });
      const lifecycle = app.get(JobOfferLifecycleService);
      const end = new Date(Date.parse(active.endsAt as string) + 1_000);

      await lifecycle.run(end);
      expect(await statusOf(active.id)).toBe('expired');
      expect(await statusOf(suspendedOffer.id)).toBe('expired');
      const last = await prisma.jobOfferStatusHistory.findFirstOrThrow({
        where: { jobOfferId: active.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(last).toMatchObject({ fromStatus: 'active', toStatus: 'expired', actorId: null });
    });

    it('est idempotent, même avec deux exécutions simultanées', async () => {
      const offer = await approved(0, 2, 'Assistant comptable');
      const lifecycle = app.get(JobOfferLifecycleService);
      const end = new Date(Date.parse(offer.endsAt as string) + 1_000);

      await Promise.all([lifecycle.run(end), lifecycle.run(end)]);
      await lifecycle.run(end);
      const expirations = await prisma.jobOfferStatusHistory.count({
        where: { jobOfferId: offer.id, toStatus: 'expired' },
      });
      expect(expirations).toBe(1);
    });
  });

  it('expose les catégories actives sans authentification', async () => {
    const api = await new ApiClient(app).init();
    const response = await api.get('/api/v1/job-categories');
    expect(response.status).toBe(200);
    expect((response.body as { slug: string }[]).map((category) => category.slug)).toContain(
      'accounting-finance',
    );
  });
});
