import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import {
  type BundleExportResponse,
  type BundleResponse,
  type BundleSummary,
  type CareerExportDownloadResponse,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import { PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { StorageService } from '../src/storage/storage.service';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';
import { givePaidCredits } from './support/paid-credits';

const BASE = '/api/v1/me/document-bundles';
const code = (response: { body: unknown }) => (response.body as { code: string }).code;

async function pdf(pages: number, change?: (document: PDFDocument) => void): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let page = 1; page <= pages; page += 1) {
    document.addPage([300, 400]).drawText(`Page ${page}`, { x: 20, y: 200, font });
  }
  change?.(document);
  return Buffer.from(await document.save());
}

const png = async (width: number, height: number) => createCanvas(width, height).encode('png');

describe('Dossiers rassemblés : fichiers réunis en un seul PDF (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let storage: StorageService;

  async function member(): Promise<{ api: ApiClient; userId: string }> {
    const email = uniqueEmail('bundle');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    await api.post('/api/v1/auth/verify-email', {
      token: extractToken(await waitForEmail(email, 'Confirmez')),
    });
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    return { api, userId: user.id };
  }

  const create = async (api: ApiClient) =>
    (await api.post(BASE, { title: 'Candidature : comptable' })).body as BundleResponse;
  const add = (api: ApiClient, id: string, buffer: Buffer, filename = 'fichier.pdf') =>
    api.upload(`${BASE}/${id}/files`, { buffer, filename, contentType: 'application/pdf' });
  const exportBundle = (api: ApiClient, id: string, key = randomUUID()) =>
    api.post(`${BASE}/${id}/exports`, { idempotencyKey: key });
  const output = async (api: ApiClient, id: string, exportId: string) => {
    const link = (await api.get(`${BASE}/${id}/exports/${exportId}/download`))
      .body as CareerExportDownloadResponse;
    const served = await fetch(link.url);
    return { served, content: Buffer.from(await served.arrayBuffer()) };
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    storage = app.get(StorageService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('réunit PDF et images dans l’ordre choisi et débite 30 crédits une seule fois', async () => {
    const { api, userId } = await member();
    const bundle = await create(api);
    expect(code(await exportBundle(api, bundle.id))).toBe('BUNDLE_TOO_FEW_FILES');

    expect((await add(api, bundle.id, await pdf(2), 'CV.pdf')).status).toBe(201);
    expect((await add(api, bundle.id, await png(1200, 800), 'carte.png')).status).toBe(201);
    const filled = (await add(api, bundle.id, await pdf(1), 'diplome.pdf')).body as BundleResponse;
    expect(filled.files.map((file) => [file.originalName, file.kind, file.pageCount])).toEqual([
      ['CV.pdf', 'pdf', 2],
      ['carte.jpg', 'image', 1],
      ['diplome.pdf', 'pdf', 1],
    ]);
    expect(filled).toMatchObject({ cost: 30, balance: 0, coveredUntil: null });
    expect(JSON.stringify(filled)).not.toContain('document-bundles/');

    // Nouvel ordre : image, diplôme, CV. Une liste incomplète ou étrangère est refusée.
    const [cv, card, diploma] = filled.files.map((file) => file.id) as [string, string, string];
    const order = [card, diploma, cv];
    expect(code(await api.patch(`${BASE}/${bundle.id}`, { fileIds: [card, cv] }))).toBe(
      'BUNDLE_ORDER_CONFLICT',
    );
    const ordered = (await api.patch(`${BASE}/${bundle.id}`, { fileIds: order }))
      .body as BundleResponse;
    expect(ordered.files.map((file) => file.id)).toEqual(order);

    expect(code(await exportBundle(api, bundle.id))).toBe('INSUFFICIENT_CREDITS');
    await givePaidCredits(prisma, userId, 50);
    const key = randomUUID();
    const [first, second] = await Promise.all([
      exportBundle(api, bundle.id, key),
      exportBundle(api, bundle.id, key),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    // Le second clic retrouve le même export, prêt ou encore en cours.
    const replies = [first.body, second.body] as BundleExportResponse[];
    const exported = replies.find((reply) => reply.status === 'ready') as BundleExportResponse;
    expect(replies.map((reply) => reply.id)).toEqual([exported.id, exported.id]);

    const { served, content } = await output(api, bundle.id, exported.id);
    expect(served.headers.get('content-disposition')).toContain('Candidature');
    const merged = await PDFDocument.load(content);
    // Image en page A4 paysage, puis le diplôme et les deux pages du CV.
    expect(merged.getPages().map((page) => Math.round(page.getWidth()))).toEqual([
      842, 300, 300, 300,
    ]);

    // Correction après paiement : ré-export gratuit, aucun second débit.
    const corrected = (await api.patch(`${BASE}/${bundle.id}`, { title: 'Candidature corrigée' }))
      .body as BundleResponse;
    expect(corrected.coveredUntil).not.toBeNull();
    const again = (await exportBundle(api, bundle.id)).body as BundleExportResponse;
    expect(again.bundle.balance).toBe(20);
    expect(again.bundle.exports.map((row) => row.charged)).toEqual([false, true]);
    expect(
      await prisma.creditMovement.count({ where: { account: { userId }, type: 'consume' } }),
    ).toBe(1);
    const entries = await prisma.ledgerEntry.findMany({
      where: { transaction: { referenceType: 'document_bundle_pass' }, debit: { equals: 0 } },
      include: { account: { select: { code: true } } },
    });
    expect(new Set(entries.map((entry) => entry.account.code))).toEqual(
      new Set(['revenue_documents']),
    );
  });

  it('retire les éléments actifs des PDF et garde ce qui est visible', async () => {
    const { api, userId } = await member();
    const bundle = await create(api);
    await givePaidCredits(prisma, userId, 30);
    const active = await pdf(1, (document) => {
      const { context } = document;
      const page = document.getPage(0);
      document.catalog.set(
        PDFName.of('OpenAction'),
        context.obj({ S: 'JavaScript', JS: 'app.alert(1)' }),
      );
      page.node.set(PDFName.of('AA'), context.obj({ O: { S: 'Launch', F: 'calc.exe' } }));
      const appearance = context.register(
        context.stream('0 0 1 rg 0 0 50 20 re f', {
          Type: 'XObject',
          Subtype: 'Form',
          BBox: [0, 0, 50, 20],
        }),
      );
      const annotation = (content: Record<string, unknown>) =>
        context.register(
          context.obj({ Type: 'Annot', Rect: [10, 10, 60, 30], ...content } as never),
        );
      page.node.set(
        PDFName.of('Annots'),
        context.obj([
          annotation({ Subtype: 'Link', A: { S: 'URI', URI: 'https://exemple.test' } }),
          annotation({ Subtype: 'Link', A: { S: 'JavaScript', JS: 'app.alert(2)' } }),
          annotation({ Subtype: 'FreeText', AP: { N: appearance } }),
        ]),
      );
    });
    expect((await add(api, bundle.id, active)).status).toBe(201);
    await add(api, bundle.id, await png(40, 80), 'photo.png');
    const exported = (await exportBundle(api, bundle.id)).body as BundleExportResponse;
    const { content } = await output(api, bundle.id, exported.id);

    const merged = await PDFDocument.load(content);
    expect(merged.catalog.has(PDFName.of('OpenAction'))).toBe(false);
    const page = merged.getPage(0);
    expect(page.node.has(PDFName.of('AA'))).toBe(false);
    expect(page.node.Annots()?.size()).toBe(1);
    // Le texte ajouté par annotation est devenu un élément dessiné dans la page.
    const xobjects = page.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict);
    expect(xobjects?.keys().length).toBe(1);
    const everything = merged.context
      .enumerateIndirectObjects()
      .map(([, object]) => object.toString())
      .join('\n');
    expect(everything).not.toMatch(/JavaScript|Launch|alert/);
  });

  it('refuse les fichiers illisibles, protégés, trop lourds ou hors format', async () => {
    const { api } = await member();
    const bundle = await create(api);
    expect(code(await add(api, bundle.id, Buffer.from('%PDF-1.7 rien du tout')))).toBe(
      'BUNDLE_PDF_UNREADABLE',
    );
    const locked = await pdf(1, (document) => {
      document.context.trailerInfo.Encrypt = document.context.register(
        document.context.obj({ Filter: 'Standard', V: 1 }),
      );
    });
    expect(code(await add(api, bundle.id, locked))).toBe('BUNDLE_PDF_PROTECTED');
    expect(code(await add(api, bundle.id, Buffer.from('MZ programme')))).toBe(
      'FILE_TYPE_NOT_ALLOWED',
    );
    expect((await add(api, bundle.id, Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413);
    expect(code(await add(api, bundle.id, await pdf(101)))).toBe('BUNDLE_FILES_LIMIT');
    expect(((await api.get(`${BASE}/${bundle.id}`)).body as BundleResponse).files).toEqual([]);
  });

  it('cloisonne les dossiers et efface réellement les fichiers supprimés', async () => {
    const owner = await member();
    const other = await member();
    const bundle = await create(owner.api);
    await givePaidCredits(prisma, owner.userId, 30);
    const one = (await add(owner.api, bundle.id, await pdf(1))).body as BundleResponse;
    const fileId = one.files[0]?.id as string;
    const url = `${BASE}/${bundle.id}`;

    expect((await other.api.get(url)).status).toBe(404);
    expect((await add(other.api, bundle.id, await pdf(1))).status).toBe(404);
    expect((await other.api.patch(url, { title: 'Pris' })).status).toBe(404);
    expect((await other.api.delete(`${url}/files/${fileId}`)).status).toBe(404);
    expect((await exportBundle(other.api, bundle.id)).status).toBe(404);
    expect((await other.api.delete(url)).status).toBe(404);

    // Retirer un fichier l'efface du stockage.
    const removed = await prisma.documentBundleFile.findUniqueOrThrow({ where: { id: fileId } });
    expect((await owner.api.delete(`${url}/files/${fileId}`)).status).toBe(200);
    await expect(storage.read(removed.storageKey)).rejects.toThrow();

    // Supprimer le dossier efface tout, mais garde la pièce comptable.
    await add(owner.api, bundle.id, await pdf(1));
    await add(owner.api, bundle.id, await pdf(1));
    const exported = (await exportBundle(owner.api, bundle.id)).body as BundleExportResponse;
    expect((await other.api.get(`${url}/exports/${exported.id}/download`)).status).toBe(404);
    const keys = [
      ...(await prisma.documentBundleFile.findMany({ where: { bundleId: bundle.id } })),
      ...(await prisma.documentBundleExport.findMany({ where: { bundleId: bundle.id } })),
    ].map((row) => row.storageKey as string);
    expect(keys).toHaveLength(3);
    expect((await owner.api.delete(url)).status).toBe(204);
    for (const key of keys) await expect(storage.read(key)).rejects.toThrow();
    expect((await owner.api.get(url)).status).toBe(404);
    expect((await owner.api.get(`${url}/exports/${exported.id}/download`)).status).toBe(404);
    expect((await owner.api.get(BASE)).body as BundleSummary[]).toEqual([]);
    expect(await prisma.documentBundlePass.count({ where: { bundleId: bundle.id } })).toBe(1);
  });

  it('ne fait jamais payer deux fois un assemblage qui a échoué', async () => {
    const { api, userId } = await member();
    const bundle = await create(api);
    await givePaidCredits(prisma, userId, 30);
    await add(api, bundle.id, await pdf(1));
    const filled = (await add(api, bundle.id, await pdf(1))).body as BundleResponse;
    const lost = await prisma.documentBundleFile.findUniqueOrThrow({
      where: { id: filled.files[0]?.id as string },
    });
    const content = await storage.read(lost.storageKey);
    await storage.remove(lost.storageKey);

    const failed = await exportBundle(api, bundle.id);
    expect(failed.status).toBe(503);
    expect(code(failed)).toBe('CAREER_EXPORT_FAILED');
    const { createHash } = await import('node:crypto');
    await storage.put(
      lost.storageKey,
      content,
      'application/pdf',
      createHash('sha256').update(content).digest('base64'),
    );
    const retry = (await exportBundle(api, bundle.id)).body as BundleExportResponse;
    expect(retry.status).toBe('ready');
    expect(retry.bundle.balance).toBe(0);
    expect(retry.bundle.exports.map((row) => [row.status, row.charged])).toEqual([
      ['ready', false],
      ['failed', true],
    ]);
  });
});
