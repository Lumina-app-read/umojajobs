import { type INestApplication } from '@nestjs/common';
import type Redis from 'ioredis';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createTestApp } from './create-test-app';
import {
  ApiClient,
  APP_ORIGIN,
  OTHER_STRONG_PASSWORD,
  registrationPayload,
  STRONG_PASSWORD,
  uniqueEmail,
} from './support/api-client';
import { extractToken, listMessagesTo, waitForEmail } from './support/mailpit';

interface ErrorBody {
  statusCode: number;
  code: string;
  requestId: string;
  details?: { field: string; rules: string[] }[];
  meta?: Record<string, unknown>;
}

describe('Authentification (intégration)', () => {
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

  // Les limites de débit sont partagées par IP : on repart de zéro à chaque test.
  beforeEach(async () => {
    await redis.flushdb();
  });

  const client = (): Promise<ApiClient> => new ApiClient(app).init();

  /** Inscrit puis vérifie un compte, et renvoie un client connecté. */
  async function registerVerifiedUser(
    email = uniqueEmail(),
  ): Promise<{ email: string; api: ApiClient }> {
    const api = await client();
    await api.post('/api/v1/auth/register', registrationPayload(email)).then((r) => {
      expect(r.status).toBe(202);
    });
    const token = extractToken(await waitForEmail(email, 'Confirmez votre adresse email'));
    expect((await api.post('/api/v1/auth/verify-email', { token })).status).toBe(204);
    const login = await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD });
    expect(login.status).toBe(200);
    api.adoptCsrfToken(login);
    return { email, api };
  }

  describe('protection CSRF', () => {
    it('refuse une requête sans jeton CSRF', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', APP_ORIGIN)
        .send({ email: uniqueEmail(), password: 'x' });
      expect(response.status).toBe(403);
      expect((response.body as ErrorBody).code).toBe('CSRF_INVALID');
    });

    it("refuse une requête venant d'une autre origine, même avec un jeton valide", async () => {
      const api = await client();
      const response = await api.agent
        .post('/api/v1/auth/login')
        .set('Origin', 'https://site-malveillant.example')
        .set('X-CSRF-Token', 'x'.repeat(43))
        .send({ email: uniqueEmail(), password: 'x' });
      expect(response.status).toBe(403);
      expect((response.body as ErrorBody).code).toBe('CSRF_INVALID');
    });

    it('pose un cookie CSRF lisible et un cookie de session HttpOnly, SameSite=Lax', async () => {
      const email = uniqueEmail();
      const api = await client();
      await api.post('/api/v1/auth/register', registrationPayload(email));
      const token = extractToken(await waitForEmail(email, 'Confirmez'));
      await api.post('/api/v1/auth/verify-email', { token });
      const login = await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD });

      const cookies = ([] as string[]).concat(login.headers['set-cookie'] ?? []);
      const session = cookies.find((cookie) => cookie.startsWith('oppo_session='));
      const csrf = cookies.find((cookie) => cookie.startsWith('oppo_csrf='));
      expect(session).toMatch(/HttpOnly/i);
      expect(session).toMatch(/SameSite=Lax/i);
      expect(session).toMatch(/Path=\//);
      expect(csrf).not.toMatch(/HttpOnly/i);
    });
  });

  describe('format des erreurs', () => {
    it('renvoie statusCode, code, requestId et le détail des champs, sans message technique', async () => {
      const api = await client();
      const response = await api.post('/api/v1/auth/register', { email: 'pas-un-email' });
      const body = response.body as ErrorBody;

      expect(response.status).toBe(400);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.requestId).toBe(response.headers['x-request-id']);
      expect(body.details?.map((d) => d.field)).toEqual(
        expect.arrayContaining(['firstName', 'email', 'countryIso2', 'password', 'acceptTerms']),
      );
      expect(body).not.toHaveProperty('message');
    });

    it('exige une session sur les routes protégées (401 UNAUTHENTICATED)', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');
      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).code).toBe('UNAUTHENTICATED');
    });
  });

  describe('inscription et vérification de l’email', () => {
    it.each([
      ['pays hors Afrique', { countryIso2: 'FR' }, 'VALIDATION_FAILED'],
      ['conditions non acceptées', { acceptTerms: false }, 'VALIDATION_FAILED'],
      ['champ inconnu', { role: 'admin' }, 'VALIDATION_FAILED'],
      [
        'confirmation différente',
        { passwordConfirmation: OTHER_STRONG_PASSWORD },
        'PASSWORD_MISMATCH',
      ],
      [
        'mot de passe trop faible',
        { password: 'Password1234', passwordConfirmation: 'Password1234' },
        'PASSWORD_TOO_WEAK',
      ],
    ])('refuse : %s', async (_label, overrides, code) => {
      const api = await client();
      const response = await api.post(
        '/api/v1/auth/register',
        registrationPayload(uniqueEmail(), overrides),
      );
      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).code).toBe(code);
    });

    it('parcours complet : inscription, email, vérification, connexion, profil', async () => {
      const email = uniqueEmail('parcours');
      const api = await client();

      const registered = await api.post('/api/v1/auth/register', {
        ...registrationPayload(email),
        email: `  ${email.toUpperCase()}  `,
      });
      expect(registered.status).toBe(202);
      expect(registered.body).toEqual({ status: 'accepted' });

      const user = await prisma.user.findUniqueOrThrow({
        where: { email },
        include: { roles: { include: { role: true } }, country: true },
      });
      expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(user.emailVerifiedAt).toBeNull();
      expect(user.termsVersion).toBe('2026-11-09');
      expect(user.country.iso2).toBe('SN');
      expect(user.roles.map((r) => r.role.code)).toEqual(['user']);

      const blocked = await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD });
      expect(blocked.status).toBe(403);
      expect((blocked.body as ErrorBody).code).toBe('EMAIL_NOT_VERIFIED');

      const message = await waitForEmail(email, 'Confirmez votre adresse email');
      expect(message.Text).toContain('Bonjour Awa,');
      expect(message.Text).toContain('http://localhost:3000/fr/verify-email#token=');
      const token = extractToken(message);
      expect(await prisma.verificationToken.count({ where: { tokenHash: token } })).toBe(0);

      expect((await api.post('/api/v1/auth/verify-email', { token })).status).toBe(204);
      const reused = await api.post('/api/v1/auth/verify-email', { token });
      expect(reused.status).toBe(400);
      expect((reused.body as ErrorBody).code).toBe('TOKEN_INVALID');

      const login = await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body).toEqual(
        expect.objectContaining({
          csrfToken: expect.any(String) as string,
          user: expect.objectContaining({
            email,
            firstName: 'Awa',
            countryIso2: 'SN',
            locale: 'fr',
            roles: ['user'],
            permissions: [],
            mfaState: 'not_required',
          }) as object,
        }),
      );

      const me = await api.get('/api/v1/auth/me');
      expect(me.status).toBe(200);
      expect((me.body as { email: string }).email).toBe(email);

      const events = await prisma.securityEvent.findMany({
        where: { userId: user.id },
        orderBy: { id: 'asc' },
      });
      expect(events.map((event) => event.type)).toEqual([
        'user_registered',
        'email_verification_sent',
        'login_failed',
        'email_verified',
        'login_succeeded',
      ]);
      expect(events.every((event) => event.requestId !== null)).toBe(true);
    });

    it('envoie l’email dans la langue choisie', async () => {
      const email = uniqueEmail('english');
      const api = await client();
      await api.post('/api/v1/auth/register', registrationPayload(email, { locale: 'en' }));
      const message = await waitForEmail(email, 'Confirm your email address');
      expect(message.Text).toContain('Hello Awa,');
      expect(message.Text).toContain('/en/verify-email#token=');
    });

    it('ne révèle pas qu’une adresse est déjà inscrite', async () => {
      const { email } = await registerVerifiedUser();
      const api = await client();
      const second = await api.post(
        '/api/v1/auth/register',
        registrationPayload(email, { firstName: 'Intrus' }),
      );

      expect(second.status).toBe(202);
      expect(second.body).toEqual({ status: 'accepted' });
      expect(await prisma.user.count({ where: { email } })).toBe(1);
      await waitForEmail(email, "Tentative d'inscription");
    });

    it('renvoie l’email de vérification sans révéler l’existence du compte', async () => {
      const api = await client();
      const unknown = await api.post('/api/v1/auth/verify-email/resend', { email: uniqueEmail() });
      expect(unknown.status).toBe(202);

      const email = uniqueEmail('resend');
      await api.post('/api/v1/auth/register', registrationPayload(email));
      await waitForEmail(email, 'Confirmez');
      expect((await api.post('/api/v1/auth/verify-email/resend', { email })).status).toBe(202);
      await new Promise((r) => setTimeout(r, 500));
      expect((await listMessagesTo(email)).length).toBe(2);
    });
  });

  describe('connexion et verrouillage', () => {
    it('renvoie la même erreur pour un email inconnu et un mauvais mot de passe', async () => {
      const { email } = await registerVerifiedUser();
      const api = await client();
      const wrong = await api.post('/api/v1/auth/login', {
        email,
        password: OTHER_STRONG_PASSWORD,
      });
      const unknown = await api.post('/api/v1/auth/login', {
        email: uniqueEmail(),
        password: OTHER_STRONG_PASSWORD,
      });

      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect((wrong.body as ErrorBody).code).toBe('INVALID_CREDENTIALS');
      expect((unknown.body as ErrorBody).code).toBe('INVALID_CREDENTIALS');
    });

    it('verrouille temporairement après 5 échecs, même avec le bon mot de passe ensuite', async () => {
      const { email } = await registerVerifiedUser();
      const api = await client();
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        statuses.push(
          (await api.post('/api/v1/auth/login', { email, password: 'mauvais' })).status,
        );
      }
      expect(statuses).toEqual([401, 401, 401, 401, 429]);

      const locked = await api.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD });
      expect(locked.status).toBe(429);
      expect((locked.body as ErrorBody).code).toBe('ACCOUNT_LOCKED');
      expect((locked.body as ErrorBody).meta?.retryAfterSeconds).toBeGreaterThan(0);

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
      expect(
        await prisma.securityEvent.count({ where: { userId: user.id, type: 'account_locked' } }),
      ).toBe(1);
    });

    it('applique le même verrouillage à une adresse inconnue (pas d’énumération)', async () => {
      const email = uniqueEmail('inconnu');
      const api = await client();
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        statuses.push(
          (await api.post('/api/v1/auth/login', { email, password: 'mauvais' })).status,
        );
      }
      expect(statuses).toEqual([401, 401, 401, 401, 429, 429]);
    });

    it('limite le nombre de tentatives par IP (429 RATE_LIMITED)', async () => {
      const api = await client();
      let last = await api.post('/api/v1/auth/login', { email: uniqueEmail(), password: 'x' });
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        last = await api.post('/api/v1/auth/login', { email: uniqueEmail(), password: 'x' });
      }
      expect(last.status).toBe(429);
      expect((last.body as ErrorBody).code).toBe('RATE_LIMITED');
      expect(Number(last.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('sessions', () => {
    it('liste, révoque une autre session, puis déconnecte partout', async () => {
      const { email, api: first } = await registerVerifiedUser();
      const second = await client();
      second.adoptCsrfToken(
        await second.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD }),
      );

      const list = await first.get('/api/v1/auth/sessions');
      const sessions = list.body as { id: string; current: boolean }[];
      expect(sessions).toHaveLength(2);
      expect(sessions.filter((s) => s.current)).toHaveLength(1);

      const other = sessions.find((s) => !s.current);
      expect((await first.delete(`/api/v1/auth/sessions/${other?.id}`)).status).toBe(204);
      expect((await second.get('/api/v1/auth/me')).status).toBe(401);
      expect((await first.get('/api/v1/auth/me')).status).toBe(200);

      const unknownSession = await first.delete(
        '/api/v1/auth/sessions/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      );
      expect(unknownSession.status).toBe(404);
      expect((unknownSession.body as ErrorBody).code).toBe('SESSION_NOT_FOUND');

      expect((await first.post('/api/v1/auth/logout-all')).status).toBe(204);
      expect((await first.get('/api/v1/auth/me')).status).toBe(401);
    });

    it('la déconnexion révoque la session côté serveur', async () => {
      const { email, api } = await registerVerifiedUser();
      expect((await api.post('/api/v1/auth/logout')).status).toBe(204);
      expect((await api.get('/api/v1/auth/me')).status).toBe(401);

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const sessions = await prisma.session.findMany({ where: { userId: user.id } });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.revokedReason).toBe('logout');
    });
  });

  describe('mot de passe', () => {
    it('réinitialisation : lien à usage unique, sessions révoquées, email de confirmation', async () => {
      const { email, api: session } = await registerVerifiedUser();
      const anonymous = await client();

      expect((await anonymous.post('/api/v1/auth/password/forgot', { email })).status).toBe(202);
      const token = extractToken(
        await waitForEmail(email, 'Réinitialisation de votre mot de passe'),
      );

      const weak = await anonymous.post('/api/v1/auth/password/reset', {
        token,
        password: 'Password1234',
        passwordConfirmation: 'Password1234',
      });
      expect((weak.body as ErrorBody).code).toBe('PASSWORD_TOO_WEAK');

      const reset = await anonymous.post('/api/v1/auth/password/reset', {
        token,
        password: OTHER_STRONG_PASSWORD,
        passwordConfirmation: OTHER_STRONG_PASSWORD,
      });
      expect(reset.status).toBe(204);
      expect((await session.get('/api/v1/auth/me')).status).toBe(401);

      const reused = await anonymous.post('/api/v1/auth/password/reset', {
        token,
        password: OTHER_STRONG_PASSWORD,
        passwordConfirmation: OTHER_STRONG_PASSWORD,
      });
      expect((reused.body as ErrorBody).code).toBe('TOKEN_INVALID');

      const oldPassword = await anonymous.post('/api/v1/auth/login', {
        email,
        password: STRONG_PASSWORD,
      });
      expect(oldPassword.status).toBe(401);
      const newPassword = await anonymous.post('/api/v1/auth/login', {
        email,
        password: OTHER_STRONG_PASSWORD,
      });
      expect(newPassword.status).toBe(200);
      await waitForEmail(email, 'Votre mot de passe a été modifié');
    });

    it('demande de réinitialisation pour une adresse inconnue : même réponse, aucun email', async () => {
      const email = uniqueEmail('fantome');
      const api = await client();
      expect((await api.post('/api/v1/auth/password/forgot', { email })).status).toBe(202);
      await new Promise((r) => setTimeout(r, 500));
      expect(await listMessagesTo(email)).toHaveLength(0);
    });

    it('changement : mot de passe actuel exigé, autres sessions révoquées', async () => {
      const { email, api: current } = await registerVerifiedUser();
      const other = await client();
      await other.post('/api/v1/auth/login', { email, password: STRONG_PASSWORD });

      const wrong = await current.post('/api/v1/auth/password/change', {
        currentPassword: 'mauvais',
        newPassword: OTHER_STRONG_PASSWORD,
        newPasswordConfirmation: OTHER_STRONG_PASSWORD,
      });
      expect((wrong.body as ErrorBody).code).toBe('INVALID_CREDENTIALS');

      const changed = await current.post('/api/v1/auth/password/change', {
        currentPassword: STRONG_PASSWORD,
        newPassword: OTHER_STRONG_PASSWORD,
        newPasswordConfirmation: OTHER_STRONG_PASSWORD,
      });
      expect(changed.status).toBe(204);
      expect((await current.get('/api/v1/auth/me')).status).toBe(200);
      expect((await other.get('/api/v1/auth/me')).status).toBe(401);
    });
  });

  describe('journal de sécurité', () => {
    it('est en ajout seul : modification et suppression refusées par la base', async () => {
      await registerVerifiedUser();
      await expect(prisma.securityEvent.updateMany({ data: { ip: '0.0.0.0' } })).rejects.toThrow(
        /ajout seul/,
      );
      await expect(prisma.securityEvent.deleteMany({})).rejects.toThrow(/ajout seul/);
    });
  });
});
