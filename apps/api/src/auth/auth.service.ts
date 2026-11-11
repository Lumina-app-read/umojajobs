import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONTRIBUTOR_TERMS_VERSION, ERROR_CODES } from '@opportinities/shared';
import { sha256Hex } from '../common/crypto/tokens';
import { type ClientInfo } from '../common/http/app-request';
import { type EnvironmentVariables } from '../config/env.validation';
import { Prisma } from '../generated/prisma/client';
import {
  EMAIL_VERIFICATION_TTL_HOURS,
  EmailTemplatesService,
  PASSWORD_RESET_TTL_MINUTES,
} from '../mail/email-templates.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventsService } from '../security-events/security-events.service';
import { type AuthContext } from './auth-context';
import {
  type ChangePasswordDto,
  type LoginDto,
  type MeDto,
  type RegisterDto,
  type ResetPasswordDto,
  type UpdateProfileDto,
} from './auth.dto';
import { LoginThrottleService } from './login-throttle.service';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';
import { VerificationTokensService } from './verification-tokens.service';

const EMAIL_VERIFICATION_TTL_MS = EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = PASSWORD_RESET_TTL_MINUTES * 60 * 1000;

export interface LoginResult {
  sessionToken: string;
  sessionExpiresAt: Date;
  sessionId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly termsVersion: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly tokens: VerificationTokensService,
    private readonly loginThrottle: LoginThrottleService,
    private readonly securityEvents: SecurityEventsService,
    private readonly mail: MailService,
    private readonly templates: EmailTemplatesService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.termsVersion = config.get('TERMS_VERSION', { infer: true });
  }

  static toMe(auth: AuthContext): MeDto {
    return {
      id: auth.user.id,
      email: auth.user.email,
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
      countryIso2: auth.user.countryIso2,
      phoneE164: auth.user.phoneE164,
      locale: auth.user.locale,
      theme: auth.user.theme,
      roles: [...auth.roles].sort(),
      permissions: [...auth.permissions].sort(),
      mfaState: auth.mfaState,
      totpEnabled: auth.user.totpEnabled,
      contributorTermsAccepted: auth.user.contributorTermsVersion === CONTRIBUTOR_TERMS_VERSION,
    };
  }

  private assertPasswordsMatch(password: string, confirmation: string): void {
    if (password !== confirmation) {
      throw new BadRequestException({ code: ERROR_CODES.PASSWORD_MISMATCH });
    }
  }

  // --- Inscription -----------------------------------------------------------

  /**
   * Inscription. La réponse est identique que l'adresse soit libre ou déjà utilisée (pas
   * d'énumération des comptes) : le titulaire d'un compte existant reçoit un email d'information.
   */
  async register(dto: RegisterDto, client: ClientInfo): Promise<void> {
    this.assertPasswordsMatch(dto.password, dto.passwordConfirmation);
    this.passwords.assertStrong(dto.password, dto);

    const country = await this.prisma.country.findFirst({
      where: { iso2: dto.countryIso2, isActive: true },
      select: { id: true },
    });
    if (!country) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        details: [{ field: 'countryIso2', rules: ['isIn'] }],
      });
    }

    // Hachage avant tout branchement : temps de réponse comparable dans les deux cas.
    const passwordHash = await this.passwords.hash(dto.password);
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, firstName: true, locale: true },
    });
    if (existing) {
      await this.notifyExistingAccount(existing, client);
      return;
    }

    let user: { id: string; email: string; firstName: string; locale: 'fr' | 'en' };
    let token: string;
    try {
      ({ user, token } = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            countryId: country.id,
            locale: dto.locale ?? 'fr',
            termsAcceptedAt: new Date(),
            termsVersion: this.termsVersion,
            roles: { create: { role: { connect: { code: 'user' } } } },
          },
          select: { id: true, email: true, firstName: true, locale: true },
        });
        await this.securityEvents.record(
          {
            type: 'user_registered',
            userId: created.id,
            client,
            metadata: { termsVersion: this.termsVersion },
          },
          tx,
        );
        const verificationToken = await this.tokens.issue(
          created.id,
          'email_verification',
          EMAIL_VERIFICATION_TTL_MS,
          tx,
        );
        return { user: created, token: verificationToken };
      }));
    } catch (error) {
      // Inscription simultanée avec la même adresse : même réponse générique.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }

    await this.mail.send(this.templates.verifyEmail(user, token));
    await this.securityEvents.record({ type: 'email_verification_sent', userId: user.id, client });
  }

  private async notifyExistingAccount(
    user: { id: string; email: string; firstName: string; locale: 'fr' | 'en' },
    client: ClientInfo,
  ): Promise<void> {
    await this.securityEvents.record({
      type: 'registration_attempt_existing_email',
      userId: user.id,
      client,
    });
    await this.mail.send(this.templates.accountExists(user));
  }

  async verifyEmail(token: string, client: ClientInfo): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const userId = await this.tokens.consume(token, 'email_verification', tx);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { emailVerifiedAt: true },
      });
      if (user.emailVerifiedAt === null) {
        await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
        await this.securityEvents.record({ type: 'email_verified', userId, client }, tx);
      }
    });
  }

  /** Renvoie l'email de vérification. Réponse identique que le compte existe ou non. */
  async resendVerification(email: string, client: ClientInfo): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        locale: true,
        emailVerifiedAt: true,
        status: true,
      },
    });
    if (!user || user.emailVerifiedAt !== null || user.status !== 'active') {
      return;
    }
    const token = await this.tokens.issue(user.id, 'email_verification', EMAIL_VERIFICATION_TTL_MS);
    await this.mail.send(this.templates.verifyEmail(user, token));
    await this.securityEvents.record({ type: 'email_verification_sent', userId: user.id, client });
  }

  // --- Connexion -------------------------------------------------------------

  async login(dto: LoginDto, client: ClientInfo): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        emailVerifiedAt: true,
        failedLoginCount: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      return this.failUnknownEmail(dto, client);
    }

    const now = Date.now();
    if (user.lockedUntil && user.lockedUntil.getTime() > now) {
      await this.securityEvents.record({
        type: 'login_failed',
        userId: user.id,
        client,
        metadata: { reason: 'locked' },
      });
      throw this.loginThrottle.lockedException(user.lockedUntil.getTime() - now);
    }

    if (!(await this.passwords.verify(user.passwordHash, dto.password))) {
      await this.registerFailure(user.id, client, 'bad_password');
      throw new UnauthorizedException({ code: ERROR_CODES.INVALID_CREDENTIALS });
    }

    if (user.status !== 'active') {
      await this.securityEvents.record({
        type: 'login_failed',
        userId: user.id,
        client,
        metadata: { reason: 'suspended' },
      });
      throw new ForbiddenException({ code: ERROR_CODES.ACCOUNT_SUSPENDED });
    }
    if (user.emailVerifiedAt === null) {
      await this.securityEvents.record({
        type: 'login_failed',
        userId: user.id,
        client,
        metadata: { reason: 'email_not_verified' },
      });
      throw new ForbiddenException({ code: ERROR_CODES.EMAIL_NOT_VERIFIED });
    }

    const session = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
      });
      const created = await this.sessions.create(user.id, client, tx);
      await this.securityEvents.record(
        {
          type: 'login_succeeded',
          userId: user.id,
          client,
          metadata: { sessionId: created.sessionId },
        },
        tx,
      );
      return created;
    });

    return {
      sessionToken: session.token,
      sessionExpiresAt: session.expiresAt,
      sessionId: session.sessionId,
    };
  }

  private async failUnknownEmail(dto: LoginDto, client: ClientInfo): Promise<never> {
    const lockedFor = await this.loginThrottle.unknownEmailLockRemaining(dto.email);
    if (lockedFor > 0) {
      throw this.loginThrottle.lockedException(lockedFor);
    }
    await this.passwords.verifyDummy(dto.password);
    await this.loginThrottle.recordUnknownEmailFailure(dto.email);
    await this.securityEvents.record({
      type: 'login_failed',
      client,
      metadata: { reason: 'unknown_email', emailSha256: sha256Hex(dto.email) },
    });
    const lockedNow = await this.loginThrottle.unknownEmailLockRemaining(dto.email);
    if (lockedNow > 0) {
      throw this.loginThrottle.lockedException(lockedNow);
    }
    throw new UnauthorizedException({ code: ERROR_CODES.INVALID_CREDENTIALS });
  }

  /**
   * Compte un échec (mot de passe ou code TOTP). Au seuil, le compte est verrouillé
   * temporairement, ses sessions sont révoquées et l'appelant reçoit ACCOUNT_LOCKED.
   */
  async registerFailure(userId: string, client: ClientInfo, reason: string): Promise<void> {
    const { failedLoginCount } = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    await this.securityEvents.record({
      type: reason === 'bad_totp' ? 'mfa_failed' : 'login_failed',
      userId,
      client,
      metadata: { reason, failedCount: failedLoginCount },
    });

    if (failedLoginCount >= this.loginThrottle.maxFailures) {
      const lockedUntil = new Date(Date.now() + this.loginThrottle.lockoutMs);
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { failedLoginCount: 0, lockedUntil },
        });
        await this.sessions.revokeAll(userId, 'account_locked', undefined, tx);
        await this.securityEvents.record(
          {
            type: 'account_locked',
            userId,
            client,
            metadata: { until: lockedUntil.toISOString(), reason },
          },
          tx,
        );
      });
      throw this.loginThrottle.lockedException(this.loginThrottle.lockoutMs);
    }
  }

  async logout(auth: AuthContext, client: ClientInfo): Promise<void> {
    await this.sessions.revoke(auth.user.id, auth.sessionId, 'logout');
    await this.securityEvents.record({
      type: 'logout',
      userId: auth.user.id,
      client,
      metadata: { sessionId: auth.sessionId },
    });
  }

  async logoutAll(auth: AuthContext, client: ClientInfo): Promise<number> {
    const count = await this.sessions.revokeAll(auth.user.id, 'logout_all');
    await this.securityEvents.record({
      type: 'logout_all',
      userId: auth.user.id,
      client,
      metadata: { revokedSessions: count },
    });
    return count;
  }

  async revokeSession(auth: AuthContext, sessionId: string, client: ClientInfo): Promise<boolean> {
    const revoked = await this.sessions.revoke(auth.user.id, sessionId, 'revoked_by_user');
    if (revoked) {
      await this.securityEvents.record({
        type: 'session_revoked',
        userId: auth.user.id,
        client,
        metadata: { sessionId },
      });
    }
    return revoked;
  }

  // --- Mot de passe ----------------------------------------------------------

  /** Demande de réinitialisation. Réponse identique que le compte existe ou non. */
  async forgotPassword(email: string, client: ClientInfo): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, locale: true, status: true },
    });
    if (!user || user.status !== 'active') {
      return;
    }
    const token = await this.tokens.issue(user.id, 'password_reset', PASSWORD_RESET_TTL_MS);
    await this.mail.send(this.templates.passwordReset(user, token));
    await this.securityEvents.record({ type: 'password_reset_requested', userId: user.id, client });
  }

  /**
   * Réinitialisation par lien email : nouveau mot de passe, déverrouillage, confirmation de
   * l'adresse (le lien prouve sa possession) et révocation de toutes les sessions.
   */
  async resetPassword(dto: ResetPasswordDto, client: ClientInfo): Promise<void> {
    this.assertPasswordsMatch(dto.password, dto.passwordConfirmation);

    const user = await this.prisma.$transaction(async (tx) => {
      const userId = await this.tokens.consume(dto.token, 'password_reset', tx);
      const current = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          locale: true,
          emailVerifiedAt: true,
        },
      });
      this.passwords.assertStrong(dto.password, current);
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: await this.passwords.hash(dto.password),
          failedLoginCount: 0,
          lockedUntil: null,
          emailVerifiedAt: current.emailVerifiedAt ?? new Date(),
        },
      });
      const revoked = await this.sessions.revokeAll(userId, 'password_reset', undefined, tx);
      await this.securityEvents.record(
        {
          type: 'password_reset_completed',
          userId,
          client,
          metadata: { revokedSessions: revoked },
        },
        tx,
      );
      return current;
    });

    await this.mail.send(this.templates.passwordChanged(user));
  }

  /** Changement de mot de passe (session active) : les autres sessions sont révoquées. */
  /**
   * Mise à jour du profil et des préférences (langue, thème). Les changements d'identité
   * (nom, pays, téléphone) sont inscrits au journal de sécurité, sans les valeurs.
   */
  async updateProfile(
    auth: AuthContext,
    dto: UpdateProfileDto,
    client: ClientInfo,
  ): Promise<MeDto> {
    let countryId: string | undefined;
    if (dto.countryIso2 !== undefined && dto.countryIso2 !== auth.user.countryIso2) {
      const country = await this.prisma.country.findFirst({
        where: { iso2: dto.countryIso2, isActive: true },
        select: { id: true },
      });
      if (!country) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          details: [{ field: 'countryIso2', rules: ['isIn'] }],
        });
      }
      countryId = country.id;
    }

    const data: Prisma.UserUpdateInput = {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(countryId ? { country: { connect: { id: countryId } } } : {}),
      ...(dto.phoneE164 !== undefined ? { phoneE164: dto.phoneE164 } : {}),
      ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
      ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
    };
    const identityFields: string[] = (['firstName', 'lastName', 'phoneE164'] as const).filter(
      (field) => dto[field] !== undefined && dto[field] !== auth.user[field],
    );
    if (countryId) identityFields.push('countryIso2');

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: auth.user.id },
        data,
        select: {
          firstName: true,
          lastName: true,
          phoneE164: true,
          locale: true,
          theme: true,
          country: { select: { iso2: true } },
        },
      });
      if (identityFields.length > 0) {
        await this.securityEvents.record(
          {
            type: 'profile_updated',
            userId: auth.user.id,
            client,
            metadata: { fields: [...identityFields] },
          },
          tx,
        );
      }
      return user;
    });

    return AuthService.toMe({
      ...auth,
      user: {
        ...auth.user,
        firstName: updated.firstName,
        lastName: updated.lastName,
        countryIso2: updated.country.iso2,
        phoneE164: updated.phoneE164,
        locale: updated.locale,
        theme: updated.theme,
      },
    });
  }

  /**
   * Acceptation des conditions de publication des offres, dans leur version en vigueur.
   * Conservée sur le compte et inscrite au journal de sécurité (date, IP, navigateur) : preuve
   * de l'engagement du contributeur sur l'authenticité des offres qu'il partage.
   */
  async acceptContributorTerms(
    auth: AuthContext,
    version: string,
    client: ClientInfo,
  ): Promise<MeDto> {
    if (version !== CONTRIBUTOR_TERMS_VERSION) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        details: [{ field: 'version', rules: ['equals'] }],
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: auth.user.id },
        data: { contributorTermsVersion: version, contributorTermsAcceptedAt: new Date() },
      });
      await this.securityEvents.record(
        { type: 'contributor_terms_accepted', userId: auth.user.id, client, metadata: { version } },
        tx,
      );
    });
    return AuthService.toMe({ ...auth, user: { ...auth.user, contributorTermsVersion: version } });
  }

  async changePassword(
    auth: AuthContext,
    dto: ChangePasswordDto,
    client: ClientInfo,
  ): Promise<void> {
    this.assertPasswordsMatch(dto.newPassword, dto.newPasswordConfirmation);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.user.id },
      select: { passwordHash: true },
    });
    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      await this.registerFailure(auth.user.id, client, 'bad_current_password');
      throw new BadRequestException({ code: ERROR_CODES.INVALID_CREDENTIALS });
    }
    this.passwords.assertStrong(dto.newPassword, auth.user);

    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: auth.user.id },
        data: { passwordHash, failedLoginCount: 0 },
      });
      const revoked = await this.sessions.revokeAll(
        auth.user.id,
        'password_changed',
        auth.sessionId,
        tx,
      );
      await this.securityEvents.record(
        {
          type: 'password_changed',
          userId: auth.user.id,
          client,
          metadata: { revokedSessions: revoked },
        },
        tx,
      );
    });

    await this.mail.send(this.templates.passwordChanged(auth.user));
  }
}
