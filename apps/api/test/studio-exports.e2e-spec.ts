import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import {
  type CareerDocumentResponse,
  type CvContent,
  type CareerExportDownloadResponse,
  type CareerExportRenderData,
  type CareerExportResponse,
  type CareerExportsResponse,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import request from 'supertest';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { PDF_RENDERER, type PdfRenderer } from '../src/studio/pdf-renderer';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';
import { givePaidCredits } from './support/paid-credits';

/**
 * Faux navigateur d'impression : se comporte comme la page web (lit l'instantané avec le jeton
 * reçu dans l'adresse), puis renvoie un PDF minimal. Peut simuler une panne.
 */
class FakeRenderer implements PdfRenderer {
  readonly enabled = true;
  app!: INestApplication;
  fail = false;
  readonly calls: { url: string; data: CareerExportRenderData }[] = [];

  async render(url: string): Promise<Buffer> {
    const parsed = new URL(url);
    const id = /\/print\/career-exports\/([0-9a-f-]{36})$/.exec(parsed.pathname)?.[1];
    const response = await request(this.app.getHttpServer())
      .get(`/api/v1/internal/career-exports/${id}/render-data`)
      .query({ token: parsed.searchParams.get('token') ?? '' });
    if (response.status !== 200) throw new Error(`render-data HTTP ${response.status}`);
    this.calls.push({ url, data: response.body as CareerExportRenderData });
    if (this.fail) throw new Error('navigateur indisponible');
    return Buffer.from('%PDF-1.7\n% faux PDF de test\n%%EOF\n');
  }
}

describe('Career Studio : export PDF payé en crédits (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  const renderer = new FakeRenderer();

  async function member(): Promise<{ api: ApiClient; userId: string }> {
    const email = uniqueEmail('export');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    await api.post('/api/v1/auth/verify-email', {
      token: extractToken(await waitForEmail(email, 'Confirmez')),
    });
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    return { api, userId: user.id };
  }

  async function cv(api: ApiClient): Promise<CareerDocumentResponse<CvContent>> {
    return (
      await api.post('/api/v1/me/career-documents', {
        type: 'cv',
        title: 'CV / comptable : 2026',
        language: 'fr',
      })
    ).body as CareerDocumentResponse<CvContent>;
  }

  const exportPath = (id: string) => `/api/v1/me/career-documents/${id}/exports`;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(PDF_RENDERER).useValue(renderer),
    );
    renderer.app = app;
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await redis.flushdb();
    renderer.fail = false;
  });

  it('débite une fois, rejoue un double clic et offre les ré-exports pendant la période', async () => {
    const { api, userId } = await member();
    const doc = await cv(api);

    const broke = await api.post(exportPath(doc.id), { idempotencyKey: randomUUID() });
    expect(broke.status).toBe(422);
    expect((broke.body as { code: string }).code).toBe('INSUFFICIENT_CREDITS');
    expect(await prisma.careerDocumentExport.count({ where: { documentId: doc.id } })).toBe(0);

    await givePaidCredits(prisma, userId, 40);
    const before = (await api.get(exportPath(doc.id))).body as CareerExportsResponse;
    expect(before).toMatchObject({
      cost: 15,
      balance: 40,
      coveredUntil: null,
      reexportWindowDays: 7,
      exports: [],
    });

    const key = randomUUID();
    const first = await api.post(exportPath(doc.id), { idempotencyKey: key });
    expect(first.status).toBe(200);
    const exported = first.body as CareerExportResponse;
    expect(exported).toMatchObject({ status: 'ready', charged: true, balance: 25 });
    const coveredDays = (Date.parse(exported.coveredUntil ?? '') - Date.now()) / 86_400_000;
    expect(coveredDays).toBeGreaterThan(6.9);
    expect(coveredDays).toBeLessThanOrEqual(7);

    // La page d'impression a lu l'instantané grâce au jeton signé.
    const call = renderer.calls.at(-1);
    expect(call?.url).toContain(`/fr/print/career-exports/${exported.id}?token=`);
    expect(call?.data).toMatchObject({ templateKey: 'classic', language: 'fr' });
    expect((call?.data.content as CvContent | undefined)?.personal.fullName).toBe('Awa Diallo');

    // Double clic : même export, aucun second débit ni second rendu.
    const callsBefore = renderer.calls.length;
    const replay = await api.post(exportPath(doc.id), { idempotencyKey: key });
    expect((replay.body as CareerExportResponse).id).toBe(exported.id);
    expect((replay.body as CareerExportResponse).balance).toBe(25);
    expect(renderer.calls.length).toBe(callsBefore);

    // Correction après paiement : ré-export gratuit dans la période.
    const latest = (await api.get(`/api/v1/me/career-documents/${doc.id}`))
      .body as CareerDocumentResponse<CvContent>;
    await api.patch(`/api/v1/me/career-documents/${doc.id}`, {
      version: latest.version,
      templateKey: 'executive',
    });
    const again = (await api.post(exportPath(doc.id), { idempotencyKey: randomUUID() }))
      .body as CareerExportResponse;
    expect(again).toMatchObject({
      status: 'ready',
      charged: false,
      balance: 25,
      templateKey: 'executive',
    });

    const movements = await prisma.creditMovement.count({
      where: { account: { userId }, type: 'consume' },
    });
    expect(movements).toBe(1);

    // Le PDF de l'utilisateur est téléchargeable par un lien signé ; l'instantané n'est plus lisible.
    const download = (await api.get(`/api/v1/me/career-exports/${exported.id}/download`))
      .body as CareerExportDownloadResponse;
    const pdf = await fetch(download.url);
    expect(pdf.headers.get('content-disposition')).toContain('CV%20comptable%202026.pdf');
    expect((await pdf.text()).startsWith('%PDF-')).toBe(true);
    const token = new URL(call?.url ?? 'http://x').searchParams.get('token') ?? '';
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/internal/career-exports/${exported.id}/render-data`)
          .query({ token })
      ).status,
    ).toBe(404);
  });

  it('ne fait jamais payer deux fois un export qui a échoué', async () => {
    const { api, userId } = await member();
    const doc = await cv(api);
    await givePaidCredits(prisma, userId, 20);

    renderer.fail = true;
    const failed = await api.post(exportPath(doc.id), { idempotencyKey: randomUUID() });
    expect(failed.status).toBe(503);
    expect((failed.body as { code: string }).code).toBe('CAREER_EXPORT_FAILED');

    renderer.fail = false;
    const retry = (await api.post(exportPath(doc.id), { idempotencyKey: randomUUID() }))
      .body as CareerExportResponse;
    expect(retry).toMatchObject({ status: 'ready', charged: false, balance: 5 });

    const list = (await api.get(exportPath(doc.id))).body as CareerExportsResponse;
    expect(list.exports.map((entry) => entry.status)).toEqual(['ready', 'failed']);
  });

  it('protège les exports et la page d’impression', async () => {
    const owner = await member();
    const other = await member();
    const doc = await cv(owner.api);
    await givePaidCredits(prisma, owner.userId, 15);
    const exported = (await owner.api.post(exportPath(doc.id), { idempotencyKey: randomUUID() }))
      .body as CareerExportResponse;

    expect((await other.api.get(`/api/v1/me/career-exports/${exported.id}/download`)).status).toBe(
      404,
    );
    expect((await other.api.get(exportPath(doc.id))).status).toBe(404);
    expect(
      (await other.api.post(exportPath(doc.id), { idempotencyKey: randomUUID() })).status,
    ).toBe(404);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/internal/career-exports/${exported.id}/render-data`)
          .query({ token: `${Date.now() + 60_000}.faux-jeton-signature` })
      ).status,
    ).toBe(404);

    // Nom complet obligatoire avant tout débit.
    const empty = await cv(owner.api);
    await owner.api.patch(`/api/v1/me/career-documents/${empty.id}`, {
      version: empty.version,
      content: { ...empty.content, personal: { ...empty.content.personal, fullName: '' } },
    });
    const incomplete = await owner.api.post(exportPath(empty.id), { idempotencyKey: randomUUID() });
    expect((incomplete.body as { code: string }).code).toBe('CAREER_EXPORT_INCOMPLETE');
  });

  it('recadre la photo du CV, la réserve au propriétaire et la fige dans l’export', async () => {
    const owner = await member();
    const other = await member();
    const doc = await cv(owner.api);
    const photoPath = `/api/v1/me/career-documents/${doc.id}/photo`;
    const canvas = createCanvas(900, 600);
    canvas.getContext('2d').fillRect(0, 0, 900, 600);
    const png = await canvas.encode('png');

    const uploaded = await owner.api.upload(photoPath, {
      buffer: png,
      filename: 'portrait.png',
      contentType: 'image/png',
    });
    expect(uploaded.status).toBe(200);
    const { version } = uploaded.body as { version: string };

    // Image ré-encodée : JPEG carré de 480 pixels, sans les métadonnées d'origine.
    const served = await owner.api.get(photoPath);
    expect(served.headers['content-type']).toBe('image/jpeg');
    const image = await loadImage(served.body as Buffer);
    expect([image.width, image.height]).toEqual([480, 480]);
    expect(
      ((await owner.api.get(`/api/v1/me/career-documents/${doc.id}`)).body as { photo: unknown })
        .photo,
    ).toEqual({ version });
    expect((await other.api.get(photoPath)).status).toBe(404);

    // Image piégée (dimensions démesurées) et autre contenu : refusés avant décodage.
    const bomb = Buffer.from(await createCanvas(2, 2).encode('png'));
    bomb.writeUInt32BE(100_000, 16);
    bomb.writeUInt32BE(100_000, 20);
    const refused = await owner.api.upload(photoPath, {
      buffer: bomb,
      filename: 'x.png',
      contentType: 'image/png',
    });
    expect((refused.body as { code: string }).code).toBe('CAREER_PHOTO_INVALID');
    const pdf = await owner.api.upload(photoPath, {
      buffer: Buffer.from('%PDF-1.7 pas une image du tout'),
      filename: 'x.png',
      contentType: 'image/png',
    });
    expect(pdf.status).toBe(400);

    // L'export emporte la photo ; la supprimer ensuite ne change pas le PDF déjà produit.
    await givePaidCredits(prisma, owner.userId, 15);
    await owner.api.post(exportPath(doc.id), { idempotencyKey: randomUUID() });
    expect(renderer.calls.at(-1)?.data.photo?.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect((await owner.api.delete(photoPath)).status).toBe(204);
    expect((await owner.api.get(photoPath)).status).toBe(404);
    const exported = await prisma.careerDocumentExport.findFirstOrThrow({
      where: { documentId: doc.id },
    });
    expect(exported.photoStorageKey).not.toBeNull();
  });
});
