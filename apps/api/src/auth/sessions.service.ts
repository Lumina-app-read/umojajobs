import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PERMISSIONS } from '@opportinities/shared';
import { generateToken, sha256Hex } from '../common/crypto/tokens';
import { type ClientInfo } from '../common/http/app-request';
import { type EnvironmentVariables } from '../config/env.validation';
import { type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type AuthContext } from './auth-context';
import { computeMfaState } from './rbac';
import { isSessionUsable, type SessionLimits } from './session-policy';

/**
 * La date de dernière activité n'est réécrite qu'au-delà de cet intervalle (évite une écriture par
 * requête). Plus court pour les sessions d'administration, dont le délai d'inactivité est de quelques
 * minutes : la précision reste d'une minute.
 */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const PRIVILEGED_TOUCH_INTERVAL_MS = 60 * 1000;

const SESSION_INCLUDE = {
  user: {
    include: {
      country: { select: { iso2: true } },
      roles: {
        include: {
          role: {
            include: { permissions: { include: { permission: { select: { code: true } } } } },
          },
        },
      },
    },
  },
} satisfies Prisma.SessionInclude;

export interface SessionSummary {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

/**
 * Sessions serveur opaques : le navigateur ne détient qu'un jeton aléatoire (cookie HttpOnly),
 * la base n'en conserve que l'empreinte. Une session est révocable à tout moment.
 */
@Injectable()
export class SessionsService {
  private readonly ttlMs: number;
  private readonly idleMs: number;
  /** Limites plus courtes pour les comptes ayant accès à l'administration. */
  private readonly privileged: SessionLimits;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.ttlMs = config.get('SESSION_TTL_DAYS', { infer: true }) * 24 * 60 * 60 * 1000;
    this.idleMs = config.get('SESSION_IDLE_TIMEOUT_HOURS', { infer: true }) * 60 * 60 * 1000;
    this.privileged = {
      maxAgeMs: config.get('PRIVILEGED_SESSION_TTL_HOURS', { infer: true }) * 60 * 60 * 1000,
      idleMs: config.get('PRIVILEGED_SESSION_IDLE_TIMEOUT_MINUTES', { infer: true }) * 60 * 1000,
    };
  }

  async create(
    userId: string,
    client: ClientInfo,
    tx?: Prisma.TransactionClient,
  ): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const session = await (tx ?? this.prisma).session.create({
      data: {
        userId,
        tokenHash: sha256Hex(token),
        ip: client.ip,
        userAgent: client.userAgent,
        expiresAt,
      },
      select: { id: true },
    });
    return { token, sessionId: session.id, expiresAt };
  }

  /**
   * Résout un jeton de session en contexte d'authentification. Renvoie null si la session est
   * inconnue, révoquée, expirée, inactive trop longtemps, ou si le compte n'est plus utilisable.
   */
  async resolve(token: string): Promise<AuthContext | null> {
    const now = Date.now();
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256Hex(token) },
      include: SESSION_INCLUDE,
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.user.status !== 'active' ||
      session.user.emailVerifiedAt === null
    ) {
      return null;
    }

    const { user } = session;
    const roles = user.roles.map((userRole) => userRole.role.code);
    const permissions = new Set(
      user.roles.flatMap((userRole) => userRole.role.permissions.map((rp) => rp.permission.code)),
    );
    const privileged = permissions.has(PERMISSIONS.ADMIN_ACCESS) ? this.privileged : null;
    if (!isSessionUsable(session, now, { maxAgeMs: this.ttlMs, idleMs: this.idleMs }, privileged)) {
      return null;
    }

    const touchInterval = privileged ? PRIVILEGED_TOUCH_INTERVAL_MS : TOUCH_INTERVAL_MS;
    if (now - session.lastSeenAt.getTime() > touchInterval) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now) },
      });
    }

    const totpEnabled = user.totpEnabledAt !== null;

    return {
      sessionId: session.id,
      roles,
      permissions,
      mfaState: computeMfaState(roles, totpEnabled, session.mfaVerifiedAt !== null),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        countryIso2: user.country.iso2,
        phoneE164: user.phoneE164,
        locale: user.locale,
        theme: user.theme,
        totpEnabled,
        contributorTermsVersion: user.contributorTermsVersion,
        candidateTermsVersion: user.candidateTermsVersion,
      },
    };
  }

  async markMfaVerified(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { mfaVerifiedAt: new Date() },
    });
  }

  async listActive(userId: string, currentSessionId: string): Promise<SessionSummary[]> {
    const now = new Date();
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        lastSeenAt: { gt: new Date(now.getTime() - this.idleMs) },
      },
      select: { id: true, createdAt: true, lastSeenAt: true, ip: true, userAgent: true },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map((session) => ({ ...session, current: session.id === currentSessionId }));
  }

  /** Révoque une session de l'utilisateur. Renvoie false si elle n'existe pas ou ne lui appartient pas. */
  async revoke(userId: string, sessionId: string, reason: string): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count === 1;
  }

  /** Révoque toutes les sessions d'un utilisateur, sauf éventuellement la session courante. */
  async revokeAll(
    userId: string,
    reason: string,
    exceptSessionId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await (tx ?? this.prisma).session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }
}
