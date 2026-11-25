import { type INestApplication } from '@nestjs/common';
import {
  ADMIN_OVERVIEW_DAYS,
  type AdminEmailsPage,
  type AdminOverview,
  type PlatformStatus,
  type RoleCode,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import { totp } from '../src/auth/totp/totp';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';

const URL = '/api/v1/admin/overview';

describe("Tableau de bord de l'administration (intégration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;

  async function account(role?: Exclude<RoleCode, 'user'>): Promise<ApiClient> {
    const email = uniqueEmail('overview');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    await api.post('/api/v1/auth/verify-email', {
      token: extractToken(await waitForEmail(email, 'Confirmez')),
    });
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    if (role) {
      const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
      const found = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: found.id } });
      if (role !== 'moderator') {
        const { secret } = (await api.post('/api/v1/auth/mfa/totp/setup')).body as {
          secret: string;
        };
        expect(
          (await api.post('/api/v1/auth/mfa/totp/enable', { code: totp(secret) })).status,
        ).toBe(200);
      }
    }
    return api;
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

  it("refuse l'accès sans session ou sans accès à l'administration", async () => {
    expect((await (await new ApiClient(app).init()).get(URL)).status).toBe(401);
    expect((await (await account()).get(URL)).status).toBe(403);
  });

  it('ne renvoie que les blocs permis à un modérateur', async () => {
    const response = await (await account('moderator')).get(URL);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    const body = response.body as AdminOverview;
    expect(body.jobs).not.toBeNull();
    expect(body.users).toBeNull();
    expect(body.finance).toBeNull();
    expect(body.security).toBeNull();
    expect(body.emails).toBeNull();
    expect(body.series).toHaveLength(ADMIN_OVERVIEW_DAYS);
    expect(body.series.every((point) => point.signups === null && point.revenueUsd === null)).toBe(
      true,
    );
    expect(body.series.every((point) => typeof point.published === 'number')).toBe(true);
  });

  it('donne à un administrateur des chiffres conformes à la base', async () => {
    const admin = await account('admin');
    const body = (await admin.get(URL)).body as AdminOverview;
    expect(body.emails).toBeNull(); // settings.manage : réservé au super_admin
    expect(body.users?.total).toBe(await prisma.user.count());
    expect(body.users?.suspended).toBe(await prisma.user.count({ where: { status: 'suspended' } }));
    expect(body.jobs?.pendingReview).toBe(
      await prisma.jobOffer.count({ where: { status: 'pending_review' } }),
    );
    expect(body.finance?.revenueUsd).toMatch(/^\d+\.\d{2}$/);
    expect(body.security).toEqual({
      loginFailed24h: expect.any(Number) as number,
      accountsLocked7d: expect.any(Number) as number,
      mfaFailed24h: expect.any(Number) as number,
    });

    // Les inscriptions du jour figurent dans le dernier point de la courbe.
    const today = body.series.at(-1)!;
    expect(today.date).toBe(new Date().toISOString().slice(0, 10));
    const midnight = new Date(`${today.date}T00:00:00.000Z`);
    expect(today.signups).toBe(
      await prisma.user.count({ where: { createdAt: { gte: midnight } } }),
    );
  });

  it('ajoute la file des emails pour un super administrateur', async () => {
    const body = (await (await account('super_admin')).get(URL)).body as AdminOverview;
    expect(body.emails).toEqual({
      failed: await prisma.notification.count({ where: { emailStatus: 'failed' } }),
      pending: expect.any(Number) as number,
    });
  });

  it('supervise la file des emails et relance un envoi en échec (super administrateur)', async () => {
    const admin = await account('admin');
    expect((await admin.get('/api/v1/admin/notifications/emails')).status).toBe(403);
    const owner = await account('super_admin');
    const user = await prisma.user.findFirstOrThrow({ select: { id: true, email: true } });
    const failed = await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'withdrawal_updated',
        dedupeKey: `test:overview:${Date.now()}`,
        emailStatus: 'failed',
        emailAttempts: 5,
      },
    });

    const page = (await owner.get('/api/v1/admin/notifications/emails?status=failed'))
      .body as AdminEmailsPage;
    const row = page.items.find((item) => item.id === failed.id);
    expect(row).toMatchObject({ status: 'failed', attempts: 5, type: 'withdrawal_updated' });
    expect(row?.recipient.email).toBe(user.email);
    expect(page.totals.failed).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(page)).not.toContain('dedupe');
    expect((await owner.get('/api/v1/admin/notifications/emails?status=bad')).status).toBe(400);

    const retried = await owner.post(`/api/v1/admin/notifications/emails/${failed.id}/retry`);
    expect(retried.status).toBe(200);
    expect(retried.body).toEqual({ requeued: 1 });
    expect(
      await prisma.notification.findUniqueOrThrow({
        where: { id: failed.id },
        select: { emailStatus: true, emailAttempts: true },
      }),
    ).toEqual({ emailStatus: 'pending', emailAttempts: 0 });
    // Déjà relancé : plus en échec, donc introuvable pour une relance.
    expect((await owner.post(`/api/v1/admin/notifications/emails/${failed.id}/retry`)).status).toBe(
      404,
    );
    await prisma.notification.delete({ where: { id: failed.id } });
  });

  it("donne l'état de la plateforme sans aucun secret", async () => {
    expect((await (await account('admin')).get('/api/v1/admin/platform/status')).status).toBe(403);
    const response = await (await account('super_admin')).get('/api/v1/admin/platform/status');
    expect(response.status).toBe(200);
    const body = response.body as PlatformStatus;
    const state = (key: string) => body.services.find((service) => service.key === key)?.state;
    expect(state('database')).toBe('up');
    expect(state('redis')).toBe('up');
    expect(body.tasks.map((task) => task.key)).toEqual([
      'job-offers',
      'notifications',
      'payments',
      'studio',
    ]);
    expect(body.migrations.count).toBeGreaterThan(0);
    const text = JSON.stringify(body);
    for (const name of [
      'CHARIOW_API_KEY',
      'OPENAI_API_KEY',
      'SMTP_PASSWORD',
      'S3_SECRET_ACCESS_KEY',
    ]) {
      const value = process.env[name];
      if (value) expect(text).not.toContain(value);
    }
    expect(text).not.toContain('postgresql://');
  });
});
