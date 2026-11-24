import { type INestApplication } from '@nestjs/common';
import {
  type AdminRolesResponse,
  type AdminUserDetail,
  type RoleCode,
  type UserRegistryResponse,
} from '@opportinities/shared';
import type Redis from 'ioredis';
import { totp } from '../src/auth/totp/totp';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';
import { givePaidCredits } from './support/paid-credits';

const BASE = '/api/v1/admin/users';
const REASON = 'Signalements répétés vérifiés';
const code = (response: { body: unknown }) => (response.body as { code: string }).code;

interface Account {
  id: string;
  email: string;
  api: ApiClient;
}

describe('Administration des utilisateurs et des rôles (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;

  async function account(role?: Exclude<RoleCode, 'user'>): Promise<Account> {
    const email = uniqueEmail('users');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    await api.post('/api/v1/auth/verify-email', {
      token: extractToken(await waitForEmail(email, 'Confirmez')),
    });
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    if (role) {
      const found = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: found.id } });
      if (role !== 'moderator') {
        const { secret } = (await api.post('/api/v1/auth/mfa/totp/setup')).body as {
          secret: string;
        };
        const enabled = await api.post('/api/v1/auth/mfa/totp/enable', { code: totp(secret) });
        expect(enabled.status).toBe(200);
      }
    }
    return { id: user.id, email, api };
  }

  const suspend = (by: Account, target: Account, reason = REASON) =>
    by.api.post(`${BASE}/${target.id}/suspend`, { reason });
  const reactivate = (by: Account, target: Account, reason = REASON) =>
    by.api.post(`${BASE}/${target.id}/reactivate`, { reason });
  const setRole = (by: Account, target: Account, role: string, granted: boolean) =>
    by.api.post(`${BASE}/${target.id}/roles`, { role, granted, reason: REASON });
  const login = async (target: Account) =>
    (await new ApiClient(app).init()).post('/api/v1/auth/login', {
      email: target.email,
      password: STRONG_PASSWORD,
    });

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

  it('réserve la consultation et les actions aux permissions prévues', async () => {
    const member = await account();
    const moderator = await account('moderator');
    const admin = await account('admin');
    for (const who of [member, moderator]) {
      expect((await who.api.get(BASE)).status).toBe(403);
      expect((await who.api.get(`${BASE}/${admin.id}`)).status).toBe(403);
      expect((await suspend(who, member)).status).toBe(403);
      expect((await who.api.get('/api/v1/admin/roles')).status).toBe(403);
    }
    expect((await admin.api.get(BASE)).status).toBe(200);
    expect((await admin.api.get('/api/v1/admin/roles')).status).toBe(403);
    expect((await setRole(admin, member, 'moderator', true)).status).toBe(403);
    expect((await admin.api.get(`${BASE}/pas-un-uuid`)).status).toBe(400);
    expect((await (await new ApiClient(app).init()).get(BASE)).status).toBe(401);
  });

  it('liste, recherche et filtre les comptes sans jamais exposer de secret', async () => {
    const admin = await account('admin');
    const member = await account();
    const found = (await admin.api.get(`${BASE}?q=${member.email.toUpperCase()}`))
      .body as UserRegistryResponse;
    expect(found.total).toBe(1);
    expect(found.items[0]).toMatchObject({
      id: member.id,
      status: 'active',
      roles: ['user'],
      emailVerified: true,
      mfaEnabled: false,
    });
    const staff = (await admin.api.get(`${BASE}?status=staff&q=${admin.email}`))
      .body as UserRegistryResponse;
    expect(staff.items.map((item) => item.id)).toEqual([admin.id]);
    expect((await admin.api.get(`${BASE}?status=autre`)).status).toBe(400);

    const detail = await admin.api.get(`${BASE}/${admin.id}`);
    const raw = JSON.stringify(detail.body);
    expect(raw).not.toMatch(/passwordHash|totpSecret|tokenHash|argon2/i);
    // Aucune action possible sur soi-même.
    expect((detail.body as AdminUserDetail).can).toEqual({
      suspend: false,
      reactivate: false,
      manageRoles: false,
    });
  });

  it('suspend : sessions fermées, connexion refusée, gains conservés, action journalisée', async () => {
    const admin = await account('admin');
    const member = await account();
    await givePaidCredits(prisma, member.id, 20);

    expect((await suspend(admin, member, 'Faux profil')).status).toBe(200);
    expect((await member.api.get('/api/v1/auth/me')).status).toBe(401);
    const refused = await login(member);
    expect(refused.status).toBe(403);
    expect(code(refused)).toBe('ACCOUNT_SUSPENDED');
    expect(code(await suspend(admin, member))).toBe('USER_STATE_CONFLICT');

    const detail = (await admin.api.get(`${BASE}/${member.id}`)).body as AdminUserDetail;
    expect(detail).toMatchObject({
      status: 'suspended',
      credits: 20,
      activity: { activeSessions: 0 },
      can: { suspend: false, reactivate: true, manageRoles: false },
    });
    const event = detail.events?.find((entry) => entry.type === 'user_suspended');
    expect(event).toMatchObject({ actor: 'Awa Diallo', reason: 'Faux profil' });
    const stored = await prisma.securityEvent.findFirstOrThrow({
      where: { type: 'user_suspended', userId: admin.id },
    });
    expect(stored.requestId).not.toBeNull();
    // L'avis de suspension part, sans le motif interne.
    const notice = await prisma.notification.findFirstOrThrow({
      where: { userId: member.id, type: 'account_suspended' },
    });
    expect(notice).toMatchObject({ emailStatus: 'pending', data: {} });
    expect(stored.metadata).toMatchObject({
      targetId: member.id,
      actorRoles: ['user', 'admin'],
      before: 'active',
      after: 'suspended',
      revokedSessions: 1,
    });

    // L'action sur un autre compte n'apparaît pas dans l'historique de l'administrateur.
    const own = (await admin.api.get(`${BASE}/${admin.id}`)).body as AdminUserDetail;
    expect(own.events?.some((entry) => entry.type === 'user_suspended')).toBe(false);

    expect((await reactivate(admin, member)).status).toBe(200);
    expect((await login(member)).status).toBe(200);
    // L'ancienne session reste fermée après la réactivation.
    expect((await member.api.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('exige un motif et un compte existant', async () => {
    const admin = await account('admin');
    const member = await account();
    expect((await suspend(admin, member, 'court')).status).toBe(400);
    expect((await admin.api.post(`${BASE}/${member.id}/suspend`, {})).status).toBe(400);
    const ghost = { ...member, id: '01a00000-0000-7000-8000-000000000000' };
    expect((await suspend(admin, ghost)).status).toBe(404);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).status).toBe(
      'active',
    );
  });

  it('un administrateur n’agit ni sur lui-même, ni sur un autre administrateur', async () => {
    const admin = await account('admin');
    const peer = await account('admin');
    const boss = await account('super_admin');
    const moderator = await account('moderator');
    expect(code(await suspend(admin, admin))).toBe('USER_ACTION_SELF');
    expect(code(await suspend(admin, peer))).toBe('USER_ACTION_FORBIDDEN');
    expect(code(await suspend(admin, boss))).toBe('USER_ACTION_FORBIDDEN');
    expect((await suspend(admin, moderator)).status).toBe(200);
    expect((await suspend(boss, peer)).status).toBe(200);
    expect(code(await reactivate(admin, peer))).toBe('USER_ACTION_FORBIDDEN');
    expect(code(await suspend(boss, boss))).toBe('USER_ACTION_SELF');
    // Un administrateur suspendu ne peut plus rien faire.
    expect((await peer.api.get(BASE)).status).toBe(401);
  });

  it('attribue et retire un rôle : super administrateur seulement, nouvelle connexion exigée', async () => {
    const boss = await account('super_admin');
    const member = await account();
    expect(code(await setRole(boss, boss, 'super_admin', false))).toBe('USER_ACTION_SELF');
    expect((await setRole(boss, member, 'user', true)).status).toBe(400);

    const granted = (await setRole(boss, member, 'moderator', true)).body as AdminUserDetail;
    expect(granted.roles).toEqual(['user', 'moderator']);
    expect((await member.api.get('/api/v1/auth/me')).status).toBe(401);
    expect(code(await setRole(boss, member, 'moderator', true))).toBe('USER_STATE_CONFLICT');
    const row = await prisma.userRole.findFirstOrThrow({
      where: { userId: member.id, role: { code: 'moderator' } },
    });
    expect(row.assignedById).toBe(boss.id);

    const revoked = (await setRole(boss, member, 'moderator', false)).body as AdminUserDetail;
    expect(revoked.roles).toEqual(['user']);
    expect(revoked.events?.slice(0, 2).map((event) => [event.type, event.role])).toEqual([
      ['role_revoked', 'moderator'],
      ['role_granted', 'moderator'],
    ]);

    // Ni compte suspendu, ni adresse non vérifiée.
    await suspend(boss, member);
    expect(code(await setRole(boss, member, 'admin', true))).toBe('USER_ROLE_INELIGIBLE');
    await reactivate(boss, member);
    await prisma.user.update({ where: { id: member.id }, data: { emailVerifiedAt: null } });
    expect(code(await setRole(boss, member, 'admin', true))).toBe('USER_ROLE_INELIGIBLE');

    const roles = (await boss.api.get('/api/v1/admin/roles')).body as AdminRolesResponse;
    expect(roles.roles.map((role) => role.code)).toEqual([
      'user',
      'moderator',
      'admin',
      'super_admin',
    ]);
    expect(roles.staff.some((user) => user.id === boss.id)).toBe(true);
    expect(roles.staff.some((user) => user.id === member.id)).toBe(false);
  });

  it('garde toujours un super administrateur actif, même avec deux actions croisées', async () => {
    const first = await account('super_admin');
    const second = await account('super_admin');
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'super_admin' } });
    // Les super administrateurs des autres scénarios sont écartés.
    await prisma.userRole.deleteMany({
      where: { roleId: role.id, userId: { notIn: [first.id, second.id] } },
    });

    const results = await Promise.all([suspend(first, second), suspend(second, first)]);
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    const active = await prisma.user.count({
      where: { status: 'active', roles: { some: { roleId: role.id } } },
    });
    expect(active).toBe(1);
  });
});
