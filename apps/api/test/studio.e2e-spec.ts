import { createServer, type Server } from 'node:http';
import { type INestApplication } from '@nestjs/common';
import {
  type AiSuggestionResponse,
  type CareerDocumentResponse,
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
  let fakeOpenAi: Server;
  /** Requêtes reçues par le faux OpenAI (en-tête d'autorisation et corps). */
  const aiCalls: {
    authorization?: string;
    body: { model: string; messages: { content: string }[] };
  }[] = [];

  /**
   * Faux OpenAI (POST /v1/chat/completions) : reformule le texte reçu, ajoute un chiffre si le
   * texte contient « INVENTE », renvoie une erreur 500 s'il contient « PANNE ».
   */
  function startFakeOpenAi(): Promise<void> {
    fakeOpenAi = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        const body = JSON.parse(
          Buffer.concat(chunks).toString(),
        ) as (typeof aiCalls)[number]['body'];
        aiCalls.push({ authorization: req.headers.authorization, body });
        const { text } = JSON.parse(body.messages[1]?.content ?? '{}') as { text: string };
        if (req.url !== '/v1/chat/completions' || text.includes('PANNE')) {
          res.statusCode = 500;
          res.end('{}');
          return;
        }
        const improved = text.includes('INVENTE')
          ? `${text} Hausse de 50 % du chiffre d'affaires.`
          : `- ${text}`;
        res.end(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ text: improved }) } }],
            usage: { prompt_tokens: 120, completion_tokens: 40 },
          }),
        );
      });
    });
    return new Promise((resolve) => fakeOpenAi.listen(4598, '127.0.0.1', () => resolve()));
  }

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
    await startFakeOpenAi();
  });

  afterAll(async () => {
    await new Promise((resolve) => fakeOpenAi.close(resolve));
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
    const cv = created.body as CareerDocumentResponse;
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
    const after = saved.body as CareerDocumentResponse;
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
    ).body as CareerDocumentResponse;

    expect((await other.api.get(`/api/v1/me/career-documents/${cv.id}`)).status).toBe(404);
    expect(
      (await other.api.patch(`/api/v1/me/career-documents/${cv.id}`, { version: 1, title: 'X' }))
        .status,
    ).toBe(404);

    const unavailable = await owner.api.post('/api/v1/me/career-documents', {
      type: 'resignation_letter',
      title: 'Démission',
      language: 'fr',
    });
    expect((unavailable.body as { code: string }).code).toBe('CAREER_DOCUMENT_TYPE_UNAVAILABLE');

    expect((await owner.api.delete(`/api/v1/me/career-documents/${cv.id}`)).status).toBe(204);
    const list = (await owner.api.get('/api/v1/me/career-documents'))
      .body as CareerDocumentSummary[];
    expect(list.map((entry) => entry.id)).not.toContain(cv.id);
    expect(await prisma.careerDocument.count({ where: { id: cv.id } })).toBe(1);
  });

  it('reformule sans inventer, journalise sans le texte et applique le quota quotidien', async () => {
    const { api } = await member();
    const cv = (
      await api.post('/api/v1/me/career-documents', { type: 'cv', title: 'CV IA', language: 'fr' })
    ).body as CareerDocumentResponse;
    const improve = (text: string) =>
      api.post(`/api/v1/me/career-documents/${cv.id}/ai/improve`, {
        target: 'experience',
        text,
        context: { title: 'Comptable', organization: 'Logistique Ouest SA' },
      });

    const first = await improve('Tenue de la comptabilité générale, clôture en 5 jours.');
    expect(first.status).toBe(200);
    expect(first.body as AiSuggestionResponse).toEqual({
      suggestion: '- Tenue de la comptabilité générale, clôture en 5 jours.',
      remaining: 3,
    });
    const call = aiCalls.at(-1);
    expect(call?.authorization).toBe('Bearer test_openai_key');
    expect(call?.body.model).toBe('test-model');

    // Un chiffre absent du texte : la suggestion est écartée, après une seconde tentative.
    const invented = await improve('INVENTE une gestion de la paie pour la PME.');
    expect(invented.status).toBe(422);
    expect((invented.body as { code: string }).code).toBe('AI_SUGGESTION_REJECTED');

    expect((await improve('Préparation des déclarations fiscales.')).status).toBe(200);
    const exhausted = await improve('Préparation des déclarations sociales.');
    expect(exhausted.status).toBe(429);
    expect((exhausted.body as { code: string }).code).toBe('AI_QUOTA_EXCEEDED');

    const rows = await prisma.aiRequest.findMany({
      where: { documentId: cv.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((row) => row.status)).toEqual([
      'succeeded',
      'rejected',
      'rejected',
      'succeeded',
    ]);
    expect(rows[1]?.errorCode).toBe('introduced_facts');
    expect(Object.keys(rows[0] ?? {})).not.toContain('text');
  });

  it('refuse un texte trop court, le document d’un autre et signale une panne du fournisseur', async () => {
    const owner = await member();
    const other = await member();
    const cv = (
      await owner.api.post('/api/v1/me/career-documents', {
        type: 'cv',
        title: 'CV',
        language: 'en',
      })
    ).body as CareerDocumentResponse;
    const path = `/api/v1/me/career-documents/${cv.id}/ai/improve`;

    expect((await owner.api.post(path, { target: 'summary', text: 'Trop court' })).status).toBe(
      400,
    );
    expect(
      (
        await other.api.post(path, {
          target: 'summary',
          text: 'Accountant with five years of experience.',
        })
      ).status,
    ).toBe(404);
    const down = await owner.api.post(path, {
      target: 'summary',
      text: 'PANNE accountant with experience.',
    });
    expect(down.status).toBe(503);
    expect((down.body as { code: string }).code).toBe('AI_UNAVAILABLE');
  });
});
