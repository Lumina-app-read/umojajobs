import { randomBytes } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import {
  CONTRIBUTOR_TERMS_VERSION,
  type JobOfferResponse,
  type JobSearchResponse,
  type ModerationJobOfferResponse,
  type PublicJobOfferDetail,
  type SavedJobResponse,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import request from 'supertest';
import { JobOfferLifecycleService } from '../src/jobs/job-offer-lifecycle.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';

const day = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe('Consultation publique des offres (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let contributor: ApiClient;
  let moderator: ApiClient;
  const categories: Record<string, string> = {};

  async function loggedInUser(role?: 'moderator'): Promise<ApiClient> {
    const email = uniqueEmail('search');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    const token = extractToken(await waitForEmail(email, 'Confirmez'));
    await api.post('/api/v1/auth/verify-email', { token });
    if (role) {
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const found = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: found.id } });
    }
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    await api.post('/api/v1/auth/me/contributor-terms', { version: CONTRIBUTOR_TERMS_VERSION });
    return api;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    await redis.flushdb();
    for (const slug of ['it-telecom', 'health']) {
      categories[slug] = (await prisma.jobCategory.findUniqueOrThrow({ where: { slug } })).id;
    }
    contributor = await loggedInUser();
    moderator = await loggedInUser('moderator');
  });

  afterAll(async () => {
    await app.close();
  });

  /** Jeton propre à chaque test : isole ses offres des autres suites de la même base. */
  const token = () => `zq${randomBytes(4).toString('hex')}`;

  async function publish(
    overrides: Record<string, unknown>,
    decision: 'approve' | 'none' | 'suspend' = 'approve',
  ): Promise<ModerationJobOfferResponse | JobOfferResponse> {
    const created = (
      await contributor.post('/api/v1/me/job-offers', {
        companyName: 'Hôpital Régional',
        countryIso2: 'SN',
        categoryId: categories.health,
        contractType: 'permanent',
        workMode: 'on_site',
        description: 'Prise en charge des patients et suivi des dossiers.',
        startDate: day(0),
        endDate: day(15),
        sourceType: 'company_website',
        applicationEmail: 'rh-secret@hopital.example',
        ...overrides,
      })
    ).body as JobOfferResponse;
    const submitted = (
      await contributor.post(`/api/v1/me/job-offers/${created.id}/submit`, {
        version: created.version,
        declarationAccepted: true,
      })
    ).body as JobOfferResponse;
    if (decision === 'none') return submitted;
    const approved = (
      await moderator.post(`/api/v1/admin/job-offers/${submitted.id}/approve`, {
        version: submitted.version,
      })
    ).body as ModerationJobOfferResponse;
    if (decision === 'approve') return approved;
    return (
      await moderator.post(`/api/v1/admin/job-offers/${approved.id}/suspend`, {
        version: approved.version,
        reason: 'Vérification complémentaire nécessaire.',
      })
    ).body as ModerationJobOfferResponse;
  }

  const search = async (query: string) =>
    (await request(app.getHttpServer()).get(`/api/v1/job-offers?${query}`))
      .body as JobSearchResponse;

  it('trouve une offre validée sans tenir compte des accents, sans rien exposer de privé', async () => {
    const tag = token();
    const offer = await publish({ title: `Infirmière diplômée ${tag}` });
    expect(offer.status).toBe('active');

    const result = await search(`q=${encodeURIComponent(`infirmiere diplomee ${tag}`)}`);
    expect(result.total).toBe(1);
    const [item] = result.items;
    expect(item).toMatchObject({ id: offer.id, verified: true, status: 'active' });
    expect(item?.slug).toMatch(/^infirmiere-diplomee-zq[0-9a-f]{8}-hopital-regional-[0-9a-f]{8}$/);
    const raw = JSON.stringify(result);
    expect(raw).not.toContain('rh-secret');
    expect(raw).not.toContain('applicationEmail');
    expect(raw).not.toContain('contributor');
  });

  it('n’affiche ni les offres en attente, ni programmées, ni suspendues', async () => {
    const tag = token();
    await publish({ title: `Sage-femme ${tag}` }, 'none');
    const scheduled = await publish({ title: `Sage-femme ${tag}`, startDate: day(3) });
    const suspended = await publish({ title: `Sage-femme ${tag}` }, 'suspend');
    expect(scheduled.status).toBe('scheduled');

    expect((await search(`q=${tag}`)).total).toBe(0);
    const server = request(app.getHttpServer());
    // Une offre programmée a déjà son adresse, mais elle n'est pas encore publique.
    const scheduledSlug = (await prisma.jobOffer.findUniqueOrThrow({ where: { id: scheduled.id } }))
      .slug as string;
    expect((await server.get(`/api/v1/job-offers/${scheduledSlug}`)).status).toBe(404);
    const suspendedSlug = (await prisma.jobOffer.findUniqueOrThrow({ where: { id: suspended.id } }))
      .slug as string;
    expect((await server.get(`/api/v1/job-offers/${suspendedSlug}`)).status).toBe(404);
  });

  it('filtre par mode de travail, contrat et catégorie, trie et pagine', async () => {
    const tag = token();
    const remote = await publish({
      title: `Développeur ${tag}`,
      categoryId: categories['it-telecom'],
      workMode: 'remote',
      endDate: day(30),
    });
    const hybrid = await publish({
      title: `Développeuse ${tag}`,
      categoryId: categories['it-telecom'],
      workMode: 'hybrid',
      contractType: 'freelance',
      endDate: day(5),
    });
    await publish({ title: `Infirmier ${tag}` });

    expect((await search(`q=${tag}&category=it-telecom`)).total).toBe(2);
    const modes = await search(`q=${tag}&workMode=remote&workMode=hybrid`);
    expect(modes.items.map((item) => item.id).sort()).toEqual([remote.id, hybrid.id].sort());
    expect((await search(`q=${tag}&contractType=freelance`)).items.map((i) => i.id)).toEqual([
      hybrid.id,
    ]);
    const byDeadline = await search(`q=${tag}&category=it-telecom&sort=deadline`);
    expect(byDeadline.items.map((item) => item.id)).toEqual([hybrid.id, remote.id]);
    const firstPage = await search(`q=${tag}&pageSize=1&page=2`);
    expect(firstPage).toMatchObject({ total: 3, page: 2, pageSize: 1 });
    expect(firstPage.items).toHaveLength(1);

    const invalid = await request(app.getHttpServer()).get('/api/v1/job-offers?workMode=lune');
    expect(invalid.status).toBe(400);
  });

  it('présente le contenu du déverrouillage sans le révéler, puis archive l’offre expirée', async () => {
    const tag = token();
    const offer = (await publish({
      title: `Pharmacien ${tag}`,
      applicationUrl: 'https://hopital.example/postuler',
      applicationInstructions: null,
    })) as ModerationJobOfferResponse;
    const slug = (await prisma.jobOffer.findUniqueOrThrow({ where: { id: offer.id } }))
      .slug as string;
    const server = request(app.getHttpServer());

    const detail = (await server.get(`/api/v1/job-offers/${slug}`)).body as PublicJobOfferDetail;
    expect(detail.unlockContents).toEqual({
      applicationEmail: true,
      applicationUrl: true,
      applicationAddress: false,
      applicationInstructions: false,
      applicationPhone: false,
      contributorTips: false,
      originalDocument: false,
      attachments: 0,
    });
    expect(JSON.stringify(detail)).not.toContain('hopital.example/postuler');

    await app
      .get(JobOfferLifecycleService)
      .run(new Date(Date.parse(offer.endsAt as string) + 1000));
    const expired = (await server.get(`/api/v1/job-offers/${slug}`)).body as PublicJobOfferDetail;
    expect(expired.status).toBe('expired');
    expect(expired.expiredAt).not.toBeNull();
    expect((await search(`q=${tag}`)).total).toBe(0);
    const archives = (await server.get('/api/v1/job-offers/archives')).body as JobSearchResponse;
    expect(archives.items.map((item) => item.id)).toContain(offer.id);
  });

  it('enregistre et retire des offres (idempotent), uniquement si elles sont actives', async () => {
    const tag = token();
    const offer = await publish({ title: `Kinésithérapeute ${tag}` });
    const reader = await loggedInUser();

    expect((await reader.agent.get('/api/v1/me/saved-jobs')).status).toBe(200);
    expect((await request(app.getHttpServer()).get('/api/v1/me/saved-jobs')).status).toBe(401);

    const save = () => reader.put(`/api/v1/me/saved-jobs/${offer.id}`);
    expect((await save()).status).toBe(204);
    expect((await save()).status).toBe(204);
    const saved = (await reader.get('/api/v1/me/saved-jobs')).body as SavedJobResponse[];
    expect(saved.map((entry) => entry.offer.id)).toEqual([offer.id]);

    expect((await reader.delete(`/api/v1/me/saved-jobs/${offer.id}`)).status).toBe(204);
    expect((await reader.get('/api/v1/me/saved-jobs')).body).toEqual([]);

    const pending = await publish({ title: `Radiologue ${tag}` }, 'none');
    const refused = await reader.put(`/api/v1/me/saved-jobs/${pending.id}`);
    expect(refused.status).toBe(404);
  });
});
