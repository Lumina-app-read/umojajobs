import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import {
  type CareerDocumentResponse,
  type CareerExportsResponse,
  type CvContent,
  type LetterContent,
  type CareerDocumentSummary,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';

describe('Career Studio : documents (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  async function member(): Promise<{ api: ApiClient; email: string }> {
    const email = uniqueEmail('studio');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    await api.post('/api/v1/auth/verify-email', {
      token: extractToken(await waitForEmail(email, 'Confirmez')),
    });
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    return { api, email };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('crée un CV prérempli, l’enregistre avec sa version et refuse une écriture concurrente', async () => {
    const { api, email } = await member();
    const created = await api.post('/api/v1/me/career-documents', {
      type: 'cv',
      title: 'CV comptable',
      language: 'fr',
    });
    expect(created.status).toBe(201);
    const cv = created.body as CareerDocumentResponse<CvContent>;
    expect(cv.content.personal).toMatchObject({
      fullName: 'Awa Diallo',
      email,
      countryIso2: 'SN',
    });
    expect(cv.templateKey).toBe('classic');

    const saved = await api.patch(`/api/v1/me/career-documents/${cv.id}`, {
      version: cv.version,
      templateKey: 'modern',
      content: {
        ...cv.content,
        personal: { ...cv.content.personal, headline: 'Comptable confirmée' },
        skills: ['SYSCOHADA', 'Excel'],
      },
    });
    expect(saved.status).toBe(200);
    const after = saved.body as CareerDocumentResponse<CvContent>;
    expect(after.version).toBe(2);
    expect(after.content.personal.headline).toBe('Comptable confirmée');

    const stale = await api.patch(`/api/v1/me/career-documents/${cv.id}`, {
      version: cv.version,
      title: 'Ancienne version',
    });
    expect(stale.status).toBe(409);
    expect((stale.body as { code: string }).code).toBe('CAREER_DOCUMENT_VERSION_CONFLICT');

    const invalid = await api.patch(`/api/v1/me/career-documents/${cv.id}`, {
      version: after.version,
      content: { ...after.content, experiences: [{ id: 'e1', startDate: '2024-13' }] },
    });
    expect(invalid.status).toBe(400);
    expect((invalid.body as { details: { field: string }[] }).details[0]?.field).toBe(
      'content.experiences.0.startDate',
    );
  });

  it('isole les documents de chaque utilisateur et masque un document supprimé', async () => {
    const owner = await member();
    const other = await member();
    const cv = (
      await owner.api.post('/api/v1/me/career-documents', {
        type: 'cv',
        title: 'Mon CV',
        language: 'en',
      })
    ).body as CareerDocumentResponse<CvContent>;

    expect((await other.api.get(`/api/v1/me/career-documents/${cv.id}`)).status).toBe(404);
    expect(
      (await other.api.patch(`/api/v1/me/career-documents/${cv.id}`, { version: 1, title: 'X' }))
        .status,
    ).toBe(404);

    expect((await owner.api.delete(`/api/v1/me/career-documents/${cv.id}`)).status).toBe(204);
    const list = (await owner.api.get('/api/v1/me/career-documents'))
      .body as CareerDocumentSummary[];
    expect(list.map((entry) => entry.id)).not.toContain(cv.id);
    expect(await prisma.careerDocument.count({ where: { id: cv.id } })).toBe(1);
  });

  it('crée une lettre avec les formules dans la langue du document et son propre tarif', async () => {
    const { api, email } = await member();
    const created = await api.post('/api/v1/me/career-documents', {
      type: 'cover_letter',
      title: 'Motivation comptable',
      language: 'fr',
    });
    expect(created.status).toBe(201);
    const letter = created.body as CareerDocumentResponse<LetterContent>;
    expect(letter.templateKey).toBe('classic');
    expect(letter.content.sender).toMatchObject({ fullName: 'Awa Diallo', email });
    expect(letter.content.salutation).toBe('Madame, Monsieur,');

    const saved = await api.patch(`/api/v1/me/career-documents/${letter.id}`, {
      version: letter.version,
      templateKey: 'modern',
      content: {
        ...letter.content,
        subject: 'Candidature au poste de comptable',
        date: '2026-11-13',
        body: 'Premier paragraphe.\n\nSecond paragraphe.',
        unknown: 'ignoré',
      },
    });
    expect(saved.status).toBe(200);
    const after = saved.body as CareerDocumentResponse<LetterContent>;
    expect(after.content.body).toBe('Premier paragraphe.\n\nSecond paragraphe.');
    expect(after.content).not.toHaveProperty('unknown');

    // Un modèle de CV n'existe pas pour une lettre ; une date impossible est refusée.
    const badTemplate = await api.patch(`/api/v1/me/career-documents/${letter.id}`, {
      version: after.version,
      templateKey: 'executive',
    });
    expect(badTemplate.status).toBe(400);
    const badDate = await api.patch(`/api/v1/me/career-documents/${letter.id}`, {
      version: after.version,
      content: { ...after.content, date: '2026-13-01' },
    });
    expect((badDate.body as { details: { field: string }[] }).details[0]?.field).toBe(
      'content.date',
    );

    const english = (
      await api.post('/api/v1/me/career-documents', {
        type: 'resignation_letter',
        title: 'Resignation',
        language: 'en',
      })
    ).body as CareerDocumentResponse<LetterContent>;
    expect(english.content.salutation).toBe('Dear Sir or Madam,');
    const prices = (await api.get(`/api/v1/me/career-documents/${english.id}/exports`))
      .body as CareerExportsResponse;
    expect(prices.cost).toBe(10);
  });

  it('prépare une recommandation au nom du signataire, le titulaire étant le candidat', async () => {
    const { api } = await member();
    const draft = (
      await api.post('/api/v1/me/career-documents', {
        type: 'recommendation_draft',
        title: 'Recommandation',
        language: 'fr',
      })
    ).body as CareerDocumentResponse<LetterContent>;
    // L'expéditeur est le recommandant (à renseigner) ; le titulaire du compte est le candidat.
    expect(draft.content.sender.fullName).toBe('');
    expect(draft.content.sender.email).toBe('');
    expect(draft.brief).toEqual({ candidateName: 'Awa Diallo' });

    const incomplete = await api.post(`/api/v1/me/career-documents/${draft.id}/ai/generate`, {
      idempotencyKey: randomUUID(),
    });
    expect(
      (incomplete.body as { code: string; details: { field: string }[] }).details.map(
        (d) => d.field,
      ),
    ).toEqual(['sender.fullName', 'qualities']);
  });
});
