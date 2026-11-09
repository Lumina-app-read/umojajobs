import { type INestApplication } from '@nestjs/common';
import type Redis from 'ioredis';
import { totp } from '../src/auth/totp/totp';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import { ApiClient, registrationPayload, STRONG_PASSWORD, uniqueEmail } from './support/api-client';
import { extractToken, waitForEmail } from './support/mailpit';

interface ErrorBody {
  code: string;
  meta?: { mfaState?: string };
}

describe('Rôles, permissions et double authentification (intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;

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

  async function loggedInUser(): Promise<{ email: string; userId: string; api: ApiClient }> {
    const email = uniqueEmail('admin');
    const api = await new ApiClient(app).init();
    await api.post('/api/v1/auth/register', registrationPayload(email));
    const token = extractToken(await waitForEmail(email, 'Confirmez'));
    await api.post('/api/v1/auth/verify-email', { token });
    api.adoptCsrfToken(await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }));
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    return { email, userId: user.id, api };
  }

  async function grantRole(userId: string, code: 'moderator' | 'admin' | 'super_admin') {
    const role = await prisma.role.findUniqueOrThrow({ where: { code } });
    await prisma.userRole.create({ data: { userId, roleId: role.id } });
  }

  it("refuse l'administration à un simple utilisateur (403 FORBIDDEN)", async () => {
    const { api } = await loggedInUser();
    const response = await api.get('/api/v1/admin/security-events');
    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe('FORBIDDEN');
  });

  it('un modérateur accède à l’espace admin mais pas au journal de sécurité', async () => {
    const { api, userId } = await loggedInUser();
    await grantRole(userId, 'moderator');
    const me = await api.get('/api/v1/auth/me');
    expect((me.body as { permissions: string[] }).permissions).toEqual([
      'admin.access',
      'jobs.moderate',
    ]);
    expect((await api.get('/api/v1/admin/security-events')).status).toBe(403);
  });

  it('administrateur : inscription TOTP obligatoire, puis vérification à chaque connexion', async () => {
    const { email, userId, api } = await loggedInUser();
    await grantRole(userId, 'admin');

    // 1. Le rôle s'applique immédiatement : la session existante doit inscrire un TOTP.
    const blocked = await api.get('/api/v1/admin/security-events');
    expect(blocked.status).toBe(403);
    expect((blocked.body as ErrorBody).code).toBe('MFA_ENROLLMENT_REQUIRED');
    const me = await api.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect((me.body as { mfaState: string }).mfaState).toBe('enrollment_required');

    // 2. Inscription : secret chiffré en base, jamais en clair.
    const setup = await api.post('/api/v1/auth/mfa/totp/setup');
    expect(setup.status).toBe(200);
    const { secret, otpauthUri } = setup.body as { secret: string; otpauthUri: string };
    expect(otpauthUri).toContain(`secret=${secret}`);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(stored.totpPendingSecretEncrypted).toMatch(/^v1\./);
    expect(stored.totpPendingSecretEncrypted).not.toContain(secret);

    const badCode = await api.post('/api/v1/auth/mfa/totp/enable', { code: '000000' });
    expect((badCode.body as ErrorBody).code).toBe('MFA_INVALID_CODE');

    const enableCode = totp(secret);
    const enabled = await api.post('/api/v1/auth/mfa/totp/enable', { code: enableCode });
    expect(enabled.status).toBe(200);
    const { recoveryCodes } = enabled.body as { recoveryCodes: string[] };
    expect(recoveryCodes).toHaveLength(10);
    expect(recoveryCodes[0]).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);

    // 3. La session courante est validée : accès au journal de sécurité.
    const events = await api.get('/api/v1/admin/security-events?limit=5');
    expect(events.status).toBe(200);
    expect((events.body as unknown[]).length).toBeGreaterThan(0);

    // 4. Nouvelle connexion : vérification exigée avant tout accès protégé.
    const fresh = await new ApiClient(app).init();
    const login = await fresh.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD });
    fresh.adoptCsrfToken(login);
    expect((login.body as { user: { mfaState: string } }).user.mfaState).toBe(
      'verification_required',
    );
    const pending = await fresh.get('/api/v1/auth/sessions');
    expect((pending.body as ErrorBody).code).toBe('MFA_REQUIRED');

    // Anti-rejeu : le code déjà utilisé pour l'activation est refusé.
    const replay = await fresh.post('/api/v1/auth/mfa/verify', { code: enableCode });
    expect((replay.body as ErrorBody).code).toBe('MFA_INVALID_CODE');

    // Code de secours : accepté une seule fois.
    const recovery = await fresh.post('/api/v1/auth/mfa/verify', {
      recoveryCode: recoveryCodes[0],
    });
    expect(recovery.status).toBe(204);
    expect((await fresh.get('/api/v1/admin/security-events')).status).toBe(200);

    const third = await new ApiClient(app).init();
    third.adoptCsrfToken(
      await third.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }),
    );
    const reusedRecovery = await third.post('/api/v1/auth/mfa/verify', {
      recoveryCode: recoveryCodes[0],
    });
    expect((reusedRecovery.body as ErrorBody).code).toBe('MFA_INVALID_CODE');

    // Code du pas de temps suivant (tolérance d'horloge) : accepté.
    const nextStep = await third.post('/api/v1/auth/mfa/verify', {
      code: totp(secret, Date.now() + 30_000),
    });
    expect(nextStep.status).toBe(204);
    expect((await third.get('/api/v1/admin/security-events')).status).toBe(200);

    const types = (
      await prisma.securityEvent.findMany({ where: { userId }, select: { type: true } })
    ).map((event) => event.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'mfa_enrollment_started',
        'mfa_enabled',
        'mfa_failed',
        'mfa_recovery_code_used',
        'mfa_verified',
      ]),
    );
  });

  it('verrouille le compte et révoque ses sessions après 5 codes TOTP erronés', async () => {
    const { userId, api } = await loggedInUser();
    await grantRole(userId, 'admin');
    const { secret } = (await api.post('/api/v1/auth/mfa/totp/setup')).body as { secret: string };
    await api.post('/api/v1/auth/mfa/totp/enable', { code: totp(secret) });

    const other = await new ApiClient(app).init();
    const { email } = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    other.adoptCsrfToken(
      await other.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }),
    );

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await redis.flushdb(); // isole le verrouillage du compte de la limite par IP
      statuses.push((await other.post('/api/v1/auth/mfa/verify', { code: '000000' })).status);
    }
    expect(statuses).toEqual([400, 400, 400, 400, 429]);
    expect((await api.get('/api/v1/auth/me')).status).toBe(401);
  });
});
