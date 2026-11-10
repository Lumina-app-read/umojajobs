import { type INestApplication } from '@nestjs/common';
import {
  type FileDownloadResponse,
  type JobOfferResponse,
  type ModerationJobOfferResponse,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';

interface ErrorBody {
  code: string;
}

const day = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** PDF minimal valide, rendu unique par un commentaire. */
const pdf = (marker: string, extra = ''): Buffer =>
  Buffer.from(
    `%PDF-1.4\n% ${marker}\n1 0 obj << /Type /Catalog /Pages 2 0 R ${extra}>> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`,
  );

const asPdf = (buffer: Buffer, filename = 'annonce.pdf') => ({
  buffer,
  filename,
  contentType: 'application/pdf',
});

describe('Documents des offres : stockage privé et liens signés (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let categoryId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    categoryId = (await prisma.jobCategory.findUniqueOrThrow({ where: { slug: 'legal' } })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  async function loggedInUser(role?: 'moderator'): Promise<{ userId: string; api: ApiClient }> {
    const email = uniqueEmail('files');
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

  async function draft(api: ApiClient, title = 'Juriste d’entreprise'): Promise<JobOfferResponse> {
    return (
      await api.post('/api/v1/me/job-offers', {
        title,
        companyName: 'Cabinet Ndiaye',
        countryIso2: 'SN',
        categoryId,
        contractType: 'permanent',
        workMode: 'hybrid',
        description: 'Conseil juridique et rédaction de contrats.',
        startDate: day(0),
        endDate: day(20),
        sourceType: 'newspaper',
        applicationInstructions: 'Envoyer CV et lettre au service RH.',
      })
    ).body as JobOfferResponse;
  }

  const upload = (api: ApiClient, offerId: string, buffer: Buffer, kind = 'original') =>
    api.upload(`/api/v1/me/job-offers/${offerId}/files`, asPdf(buffer), { kind });

  it('dépose une annonce PDF et n’expose ni clé de stockage ni URL permanente', async () => {
    const { api } = await loggedInUser();
    const offer = await draft(api);
    const response = await upload(api, offer.id, pdf('dépôt'));
    expect(response.status).toBe(201);
    const updated = response.body as JobOfferResponse;
    expect(updated.files).toHaveLength(1);
    expect(updated.files[0]).toMatchObject({ kind: 'original', originalName: 'annonce.pdf' });
    expect(updated.files[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(updated)).not.toContain('job-offers/');
  });

  it('refuse un faux PDF, un PDF actif, un fichier trop lourd et un second original', async () => {
    const { api } = await loggedInUser();
    const offer = await draft(api);

    const fake = await api.upload(
      `/api/v1/me/job-offers/${offer.id}/files`,
      { buffer: Buffer.from('MZ binaire'), filename: 'offre.pdf', contentType: 'application/pdf' },
      { kind: 'original' },
    );
    expect((fake.body as ErrorBody).code).toBe('FILE_TYPE_NOT_ALLOWED');

    const active = await upload(api, offer.id, pdf('actif', '/OpenAction 3 0 R '));
    expect((active.body as ErrorBody).code).toBe('FILE_UNSAFE');

    const heavy = await upload(
      api,
      offer.id,
      Buffer.concat([pdf('lourd'), Buffer.alloc(1_100_000)]),
    );
    expect(heavy.status).toBe(413);
    expect((heavy.body as ErrorBody).code).toBe('FILE_TOO_LARGE');

    expect((await upload(api, offer.id, pdf('premier'))).status).toBe(201);
    const second = await upload(api, offer.id, pdf('second'));
    expect(second.status).toBe(409);
    expect((second.body as ErrorBody).code).toBe('FILE_LIMIT_REACHED');
  });

  it('ne laisse ni déposer ni télécharger sur l’offre d’un autre (404)', async () => {
    const owner = await loggedInUser();
    const other = await loggedInUser();
    const offer = await draft(owner.api);
    const withFile = (await upload(owner.api, offer.id, pdf('privé'))).body as JobOfferResponse;
    const fileId = withFile.files[0]?.id as string;

    expect((await upload(other.api, offer.id, pdf('intrus'))).status).toBe(404);
    const download = await other.api.post(
      `/api/v1/me/job-offers/${offer.id}/files/${fileId}/download`,
    );
    expect(download.status).toBe(404);
  });

  it('sert le document par un lien signé de courte durée et journalise le téléchargement', async () => {
    const { api, userId } = await loggedInUser();
    const offer = await draft(api);
    const content = pdf('lien-signé');
    const withFile = (await upload(api, offer.id, content)).body as JobOfferResponse;
    const fileId = withFile.files[0]?.id as string;

    const response = await api.post(`/api/v1/me/job-offers/${offer.id}/files/${fileId}/download`);
    expect(response.status).toBe(200);
    const link = response.body as FileDownloadResponse;
    expect(Date.parse(link.expiresAt) - Date.now()).toBeLessThanOrEqual(60_000);

    const signed = await fetch(link.url);
    expect(signed.status).toBe(200);
    expect(Buffer.from(await signed.arrayBuffer()).equals(content)).toBe(true);
    // Sans signature, le stockage refuse l'accès : connaître l'adresse ne suffit pas.
    const unsigned = await fetch(link.url.split('?')[0] as string);
    expect(unsigned.status).toBe(403);

    expect(
      await prisma.fileDownloadLog.count({ where: { fileId, userId, purpose: 'owner' } }),
    ).toBe(1);
  });

  it('la modération voit les documents, y compris retirés, et repère un PDF déjà déposé ailleurs', async () => {
    const contributor = await loggedInUser();
    const moderator = await loggedInUser('moderator');
    const shared = pdf('même-document');

    const first = await draft(contributor.api, 'Assistant juridique');
    await upload(contributor.api, first.id, shared);
    const second = await draft(contributor.api, 'Clerc de notaire');
    const secondWithFiles = (await upload(contributor.api, second.id, shared))
      .body as JobOfferResponse;
    const attachment = (await upload(contributor.api, second.id, pdf('annexe'), 'attachment'))
      .body as JobOfferResponse;
    const attachmentId = attachment.files.find((file) => file.kind === 'attachment')?.id as string;
    const afterRemoval = (
      await contributor.api.delete(`/api/v1/me/job-offers/${second.id}/files/${attachmentId}`)
    ).body as JobOfferResponse;
    expect(afterRemoval.files.map((file) => file.kind)).toEqual(['original']);

    for (const offer of [first, secondWithFiles]) {
      const current = (await contributor.api.get(`/api/v1/me/job-offers/${offer.id}`))
        .body as JobOfferResponse;
      await contributor.api.post(`/api/v1/me/job-offers/${offer.id}/submit`, {
        version: current.version,
        declarationAccepted: true,
      });
    }

    const view = (await moderator.api.get(`/api/v1/admin/job-offers/${second.id}`))
      .body as ModerationJobOfferResponse;
    expect(view.duplicates.map((offer) => offer.id)).toContain(first.id);
    const removed = view.files.find((file) => file.id === attachmentId);
    expect(removed?.deletedAt).not.toBeNull();

    const review = await moderator.api.post(
      `/api/v1/admin/job-offers/${second.id}/files/${attachmentId}/download`,
    );
    expect(review.status).toBe(200);
    expect(
      await prisma.fileDownloadLog.count({
        where: { fileId: attachmentId, userId: moderator.userId, purpose: 'moderation' },
      }),
    ).toBe(1);

    // Après soumission, le contributeur ne peut plus modifier les documents.
    const late = await upload(contributor.api, second.id, pdf('tardif'), 'attachment');
    expect((late.body as ErrorBody).code).toBe('JOB_OFFER_NOT_EDITABLE');
  });
});
