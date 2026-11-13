import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { type INestApplication } from '@nestjs/common';
import {
  type AiGenerationResponse,
  type AiPricesResponse,
  type AiUsageResponse,
  type CareerDocumentResponse,
  type CvContent,
  type LetterContent,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import { totp } from '../src/auth/totp/totp';
import { CreditsService } from '../src/finance/credits.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { StudioGenerationService } from '../src/studio/studio-generation.service';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';
import { givePaidCredits } from './support/paid-credits';

interface ChatBody {
  model: string;
  messages: { content: string }[];
}

/**
 * Faux OpenAI (POST /v1/chat/completions), piloté par des marqueurs placés dans les faits :
 * PANNE (HTTP 500), LENT (au-delà du délai d'attente), ATTENTE (réponse lente), CASSE (réponse
 * illisible), INVENTE (ajoute un chiffre), COMPETENCE (ajoute une compétence).
 */
class FakeOpenAi {
  server!: Server;
  calls: ChatBody[] = [];

  start(): Promise<void> {
    this.server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString()) as ChatBody;
        this.calls.push(body);
        const system = body.messages[0]?.content ?? '';
        const user = body.messages[1]?.content ?? '';
        const reply = (content: string) => {
          if (res.destroyed) return;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              choices: [{ message: { content } }],
              usage: { prompt_tokens: 900, completion_tokens: 350 },
            }),
          );
        };
        if (user.includes('PANNE')) {
          res.statusCode = 500;
          res.end('{}');
          return;
        }
        const delay = user.includes('LENT') ? 2_500 : user.includes('ATTENTE') ? 700 : 0;
        setTimeout(() => {
          if (user.includes('CASSE')) return reply('pas du JSON');
          if (system.includes('"subject": "<letter subject')) {
            return reply(
              JSON.stringify({
                subject: 'Candidature au poste de comptable',
                salutation: 'Monsieur,',
                body: user.includes('INVENTE')
                  ? 'J’ai augmenté le chiffre d’affaires de 40 %.'
                  : 'Premier paragraphe.\n\nSecond paragraphe.',
                closing: 'Je vous prie d’agréer mes salutations distinguées.',
              }),
            );
          }
          if (system.includes('"summary": "..."')) {
            const facts = (
              JSON.parse(user) as {
                facts: { experiences: { id: string; notes: string }[]; skills: string[] };
              }
            ).facts;
            return reply(
              JSON.stringify({
                summary: 'Comptable rigoureuse au service des PME.',
                experiences: facts.experiences.map((item) => ({
                  id: item.id,
                  description: `- ${item.notes}`,
                })),
                skills: user.includes('COMPETENCE')
                  ? [...facts.skills, 'Python']
                  : [...facts.skills].reverse(),
              }),
            );
          }
          return reply(JSON.stringify({ text: 'Texte reformulé avec soin.' }));
        }, delay);
      });
    });
    return new Promise((resolve) => this.server.listen(4598, '127.0.0.1', () => resolve()));
  }
}

describe('Career Studio : génération IA payée en crédits (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  const fake = new FakeOpenAi();

  async function member(): Promise<{ api: ApiClient; userId: string }> {
    const email = uniqueEmail('genia');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    await api.post('/api/v1/auth/verify-email', {
      token: extractToken(await waitForEmail(email, 'Confirmez')),
    });
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    return { api, userId: user.id };
  }

  /** Lettre de motivation prête à générer ; `motivation` peut porter un marqueur du faux OpenAI. */
  async function coverLetter(api: ApiClient, motivation = 'Rejoindre une PME en croissance.') {
    const created = (
      await api.post('/api/v1/me/career-documents', {
        type: 'cover_letter',
        title: 'Motivation',
        language: 'fr',
      })
    ).body as CareerDocumentResponse<LetterContent>;
    const saved = await api.patch(`/api/v1/me/career-documents/${created.id}`, {
      version: created.version,
      brief: { jobTitle: 'Comptable', motivation, experience: 'Cinq ans en PME.' },
    });
    expect(saved.status).toBe(200);
    return created.id;
  }

  const balance = async (userId: string) =>
    (await prisma.creditAccount.findUnique({ where: { userId } }))?.balance ?? 0;
  const generate = (api: ApiClient, id: string, key = randomUUID()) =>
    api.post(`/api/v1/me/career-documents/${id}/ai/generate`, { idempotencyKey: key });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    await fake.start();
  });

  afterAll(async () => {
    await new Promise((resolve) => fake.server.close(resolve));
    await app.close();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('facture selon la grille du serveur, une seule fois par opération', async () => {
    const { api, userId } = await member();
    const id = await coverLetter(api);
    await givePaidCredits(prisma, userId, 10);

    const prices = (await api.get(`/api/v1/me/career-documents/${id}/ai/prices`))
      .body as AiPricesResponse;
    expect(prices).toEqual({ generate: 3, section: 1, improve: 1, balance: 10 });

    const key = randomUUID();
    const first = await generate(api, id, key);
    expect(first.status).toBe(200);
    const generation = first.body as AiGenerationResponse;
    expect(generation).toMatchObject({
      status: 'succeeded',
      credits: 3,
      refunded: false,
      balance: 7,
    });
    expect(generation.result).toMatchObject({ kind: 'document' });
    const content = (generation.result as { content: LetterContent }).content;
    expect(content.body).toBe('Premier paragraphe.\n\nSecond paragraphe.');
    // Les faits ne viennent jamais de l'IA : l'expéditeur est celui du compte.
    expect(content.sender.fullName).toBe('Awa Diallo');
    // Ni email ni téléphone transmis au modèle.
    expect(JSON.stringify(fake.calls.at(-1))).not.toContain('@');

    // Double clic (même clé) : même génération, aucun nouveau débit ni nouvel appel.
    const calls = fake.calls.length;
    const replay = (await generate(api, id, key)).body as AiGenerationResponse;
    expect(replay.id).toBe(generation.id);
    expect(fake.calls.length).toBe(calls);
    expect(await balance(userId)).toBe(7);

    // Nouvelle génération complète : nouveau débit. Section et amélioration : 1 crédit chacune.
    expect(((await generate(api, id)).body as AiGenerationResponse).balance).toBe(4);
    const section = (
      await api.post(`/api/v1/me/career-documents/${id}/ai/sections`, {
        idempotencyKey: randomUUID(),
        section: 'subject',
      })
    ).body as AiGenerationResponse;
    expect(section).toMatchObject({ status: 'succeeded', credits: 1, balance: 3 });
    expect(section.result).toEqual({
      kind: 'section',
      section: 'subject',
      text: 'Texte reformulé avec soin.',
    });
    const improved = (
      await api.post(`/api/v1/me/career-documents/${id}/ai/improve`, {
        idempotencyKey: randomUUID(),
        target: 'letter',
        text: 'Je suis motivée pour ce poste de comptable.',
      })
    ).body as AiGenerationResponse;
    expect(improved).toMatchObject({ status: 'succeeded', credits: 1, balance: 2 });

    // Un montant envoyé par le navigateur est refusé (le serveur fixe seul le tarif).
    const forged = await api.post(`/api/v1/me/career-documents/${id}/ai/generate`, {
      idempotencyKey: randomUUID(),
      credits: 0,
    });
    expect(forged.status).toBe(400);
    expect(await balance(userId)).toBe(2);

    // Journal d'usage : type, action, tokens et modèle, sans aucun texte.
    const logs = await prisma.aiRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((row) => row.feature)).toEqual([
      'studio.generate',
      'studio.generate',
      'studio.regenerate_section',
      'studio.improve',
    ]);
    expect(logs[0]).toMatchObject({
      documentType: 'cover_letter',
      model: 'test-model',
      inputTokens: 900,
      outputTokens: 350,
    });
    // Recette comptable distincte des exports et des déverrouillages.
    const revenue = await prisma.ledgerAccount.findFirst({
      where: { code: 'revenue_ai_generations' },
    });
    expect(revenue).not.toBeNull();
  });

  it('refuse sans débit : solde insuffisant ou informations manquantes', async () => {
    const { api, userId } = await member();
    const id = await coverLetter(api);

    const broke = await generate(api, id);
    expect(broke.status).toBe(422);
    expect((broke.body as { code: string }).code).toBe('INSUFFICIENT_CREDITS');
    expect(await prisma.aiGeneration.count({ where: { userId } })).toBe(0);

    await givePaidCredits(prisma, userId, 5);
    const empty = (
      await api.post('/api/v1/me/career-documents', {
        type: 'resignation_letter',
        title: 'Démission',
        language: 'fr',
      })
    ).body as CareerDocumentResponse;
    const incomplete = await generate(api, empty.id);
    expect((incomplete.body as { code: string }).code).toBe('AI_GENERATION_INCOMPLETE');
    expect(await balance(userId)).toBe(5);
    expect(fake.calls.filter((call) => call.messages[1]?.content.includes(empty.id))).toEqual([]);
  });

  it.each([
    ['une panne du fournisseur', 'PANNE', 1],
    ['un délai dépassé', 'LENT', 1],
    ['une réponse illisible', 'CASSE', 2],
    ['un chiffre inventé', 'INVENTE', 2],
  ])('rembourse automatiquement après %s', async (_label, marker, attempts) => {
    const { api, userId } = await member();
    const id = await coverLetter(api, `Motivation ${marker}`);
    await givePaidCredits(prisma, userId, 5);

    const before = fake.calls.length;
    const response = await generate(api, id);
    expect(response.status).toBe(200);
    expect(response.body as AiGenerationResponse).toMatchObject({
      status: 'failed',
      refunded: true,
      failureCode: 'AI_GENERATION_FAILED',
      result: null,
      balance: 5,
    });
    expect(fake.calls.length - before).toBe(attempts);

    const row = await prisma.aiGeneration.findFirstOrThrow({ where: { userId } });
    const movements = await prisma.creditMovement.findMany({
      where: { id: { in: [row.chargeMovementId, row.refundMovementId ?? ''] } },
    });
    expect(movements.map((movement) => movement.quantity).sort()).toEqual([-3, 3]);
    // Les crédits reviennent dans le lot d'origine.
    const lots = await prisma.creditLot.findMany({ where: { account: { userId } } });
    expect(lots.map((lot) => lot.creditsRemaining)).toEqual([5]);
  });

  it('ne lance jamais deux générations simultanées ni deux débits pour un même clic', async () => {
    const { api, userId } = await member();
    const id = await coverLetter(api, 'Motivation ATTENTE');
    await givePaidCredits(prisma, userId, 10);

    // Deux onglets : une seule génération en cours par document, l'autre est refusée sans débit.
    const [a, b] = await Promise.all([generate(api, id), generate(api, id)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const refused = a.status === 409 ? a : b;
    expect((refused.body as { code: string }).code).toBe('AI_GENERATION_IN_PROGRESS');
    expect(await balance(userId)).toBe(7);

    // Double clic simultané avec la même clé : une seule génération, un seul débit.
    const key = randomUUID();
    const [c, d] = await Promise.all([generate(api, id, key), generate(api, id, key)]);
    const ids = new Set(
      [c, d].filter((r) => r.status === 200).map((r) => (r.body as AiGenerationResponse).id),
    );
    expect(ids.size).toBe(1);
    expect(await balance(userId)).toBe(4);
    expect(await prisma.aiGeneration.count({ where: { userId } })).toBe(2);
  });

  it('rembourse une génération interrompue et permet d’en vérifier l’état', async () => {
    const { api, userId } = await member();
    const id = await coverLetter(api);
    await givePaidCredits(prisma, userId, 5);

    // Simule un arrêt du serveur pendant l'appel : débit effectué, génération restée en cours.
    const key = randomUUID();
    await prisma.$transaction(async (tx) => {
      const consumed = await app.get(CreditsService).consume(tx, {
        userId,
        service: 'ai_generate_cover_letter',
        credits: 3,
        idempotencyKey: `ai-generation:${userId}:${key}`,
        referenceType: 'ai_generation',
        referenceId: randomUUID(),
      });
      await tx.aiGeneration.create({
        data: {
          userId,
          documentId: id,
          documentType: 'cover_letter',
          action: 'generate',
          idempotencyKey: key,
          service: 'ai_generate_cover_letter',
          credits: 3,
          chargeMovementId: consumed.movementId,
          createdAt: new Date(Date.now() - 10 * 60_000),
        },
      });
    });
    expect(await balance(userId)).toBe(2);

    // Vérifier l'état avant de relancer : la génération est déclarée interrompue et remboursée.
    const status = (await api.get(`/api/v1/me/career-documents/${id}/ai/generations/${key}`))
      .body as AiGenerationResponse;
    expect(status).toMatchObject({ status: 'failed', refunded: true, balance: 5 });

    // La tâche planifiée ne rembourse jamais deux fois.
    expect(
      await app.get(StudioGenerationService).recoverStale(new Date(Date.now() + 3_600_000)),
    ).toBe(0);
    expect(await balance(userId)).toBe(5);
  });

  it('génère un CV sans rien inventer et refuse une compétence ajoutée', async () => {
    const { api, userId } = await member();
    await givePaidCredits(prisma, userId, 12);
    const created = (
      await api.post('/api/v1/me/career-documents', { type: 'cv', title: 'CV', language: 'fr' })
    ).body as CareerDocumentResponse<CvContent>;
    const content: CvContent = {
      ...created.content,
      experiences: [
        {
          id: 'e1',
          role: 'Comptable',
          organization: 'Logistique Ouest SA',
          location: 'Dakar',
          startDate: '2021-03',
          endDate: '',
          current: true,
          description: 'tenue de la comptabilité',
        },
      ],
      skills: ['Excel', 'SYSCOHADA'],
    };
    const saved = (
      await api.patch(`/api/v1/me/career-documents/${created.id}`, {
        version: created.version,
        content,
        brief: { targetRole: 'Comptable' },
      })
    ).body as CareerDocumentResponse<CvContent>;
    expect(saved.brief).toEqual({ targetRole: 'Comptable', jobOffer: '' });

    const result = (await generate(api, created.id)).body as AiGenerationResponse;
    expect(result).toMatchObject({ status: 'succeeded', credits: 5, balance: 7 });
    const cv = (result.result as { content: CvContent }).content;
    expect(cv.personal.summary).toBe('Comptable rigoureuse au service des PME.');
    expect(cv.experiences[0]).toMatchObject({
      organization: 'Logistique Ouest SA',
      description: '- tenue de la comptabilité',
    });
    expect(cv.skills).toEqual(['SYSCOHADA', 'Excel']);

    await api.patch(`/api/v1/me/career-documents/${created.id}`, {
      version: saved.version,
      brief: { targetRole: 'Comptable COMPETENCE' },
    });
    const rejected = (await generate(api, created.id)).body as AiGenerationResponse;
    expect(rejected).toMatchObject({ status: 'failed', refunded: true, balance: 7 });
  });

  it('présente à l’administration des agrégats, sans aucun contenu', async () => {
    const { api: user } = await member();
    expect((await user.get('/api/v1/admin/studio/ai-usage')).status).toBe(403);

    const { api: admin, userId } = await member();
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'super_admin' } });
    await prisma.userRole.create({ data: { userId, roleId: role.id } });
    const { secret } = (await admin.post('/api/v1/auth/mfa/totp/setup')).body as { secret: string };
    await admin.post('/api/v1/auth/mfa/totp/enable', { code: totp(secret) });

    const response = await admin.get('/api/v1/admin/studio/ai-usage?days=1');
    expect(response.status).toBe(200);
    const usage = response.body as AiUsageResponse;
    // Les scénarios précédents : réussites, échecs remboursés, tokens journalisés.
    expect(usage.generations.succeeded).toBeGreaterThanOrEqual(5);
    expect(usage.generations.failed).toBeGreaterThanOrEqual(5);
    expect(usage.credits.refunded).toBeGreaterThan(0);
    expect(usage.credits.net).toBe(usage.credits.charged - usage.credits.refunded);
    expect(Number(usage.credits.revenueUsd)).toBeGreaterThan(0);
    expect(usage.openai.inputTokens).toBeGreaterThan(0);
    // Tarifs OpenAI non configurés dans les tests : pas de coût inventé.
    expect(usage.openai.estimatedCostUsd).toBeNull();
    expect(usage.byDocumentType.map((row) => row.documentType)).toContain('cover_letter');
    const raw = JSON.stringify(usage);
    expect(raw).not.toContain('Premier paragraphe');
    expect(raw).not.toContain('Awa');
  });
});
