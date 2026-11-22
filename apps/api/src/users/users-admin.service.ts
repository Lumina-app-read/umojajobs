import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AdminRolesResponse,
  type AdminUserDetail,
  type AdminUserEvent,
  type AdminUserSummary,
  ERROR_CODES,
  type PermissionCode,
  PERMISSIONS,
  REGISTRY_PAGE_SIZE,
  type RoleCode,
  ROLE_CODES,
  type SecurityEventTypeCode,
  STAFF_ROLES,
  type UserFilter,
  type UserRegistryResponse,
  type UserRoleInput,
  type UserStatus,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { SessionsService } from '../auth/sessions.service';
import { type ClientInfo } from '../common/http/app-request';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventsService } from '../security-events/security-events.service';
import {
  rolesRefusal,
  statusRefusal,
  type UserAdminActor,
  type UserAdminRefusal,
} from './user-admin-rules';

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_SIZE = 20;
/** Verrou unique des actions sur les comptes : deux administrateurs n'agissent jamais en même temps. */
const ADMIN_LOCK = 4_610_221;
/** Actions d'administration : l'acteur est l'administrateur, la cible est dans les métadonnées. */
const ADMIN_EVENTS: SecurityEventTypeCode[] = [
  'user_suspended',
  'user_reactivated',
  'role_granted',
  'role_revoked',
];

const SUMMARY = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  status: true,
  emailVerifiedAt: true,
  totpEnabledAt: true,
  createdAt: true,
  lastLoginAt: true,
  country: { select: { iso2: true } },
  roles: { select: { role: { select: { code: true } } } },
} satisfies Prisma.UserSelect;

type SummaryRow = Prisma.UserGetPayload<{ select: typeof SUMMARY }>;

const roleCodes = (row: { roles: { role: { code: RoleCode } }[] }): RoleCode[] => {
  const codes = row.roles.map((entry) => entry.role.code);
  return ROLE_CODES.filter((code) => codes.includes(code));
};

const toSummary = (row: SummaryRow): AdminUserSummary => ({
  id: row.id,
  name: `${row.firstName} ${row.lastName}`.trim(),
  email: row.email,
  countryIso2: row.country.iso2,
  status: row.status,
  roles: roleCodes(row),
  emailVerified: row.emailVerifiedAt !== null,
  mfaEnabled: row.totpEnabledAt !== null,
  createdAt: row.createdAt.toISOString(),
  lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
});

const STAFF: Prisma.UserWhereInput = {
  roles: { some: { role: { code: { in: [...STAFF_ROLES] } } } },
};
const FILTERS: Record<UserFilter, Prisma.UserWhereInput> = {
  active: { status: 'active' },
  suspended: { status: 'suspended' },
  unverified: { emailVerifiedAt: null },
  staff: STAFF,
};

const text = (metadata: Prisma.JsonValue, key: string): string | null => {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return typeof value === 'string' ? value : null;
};

/**
 * Comptes vus par l'administration. Les actions (suspension, rôles) sont refusées sans motif,
 * vérifiées de nouveau en base sous verrou, journalisées, et ferment les sessions du compte visé.
 * Elles ne touchent ni aux crédits, ni aux commissions, ni aux retraits.
 */
@Injectable()
export class UsersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  async list(
    query: { q?: string; page: number },
    filter: UserFilter | undefined,
  ): Promise<UserRegistryResponse> {
    const contains = query.q ? { contains: query.q, mode: 'insensitive' as const } : null;
    const where: Prisma.UserWhereInput = {
      ...(filter && FILTERS[filter]),
      ...(contains && {
        OR: [{ email: contains }, { firstName: contains }, { lastName: contains }],
      }),
    };
    const [total, rows, all, newThisMonth, suspended, staff] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * REGISTRY_PAGE_SIZE,
        take: REGISTRY_PAGE_SIZE,
        select: SUMMARY,
      }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gt: new Date(Date.now() - 30 * DAY_MS) } } }),
      this.prisma.user.count({ where: { status: 'suspended' } }),
      this.prisma.user.count({ where: STAFF }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: REGISTRY_PAGE_SIZE,
      summary: { total: all, newThisMonth, suspended, staff },
      items: rows.map(toSummary),
    };
  }

  async get(auth: AuthContext, id: string): Promise<AdminUserDetail> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...SUMMARY,
        phoneE164: true,
        locale: true,
        creditAccount: { select: { balance: true } },
      },
    });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.USER_NOT_FOUND });
    const [publications, unlocks, documents, activeSessions, events] = await Promise.all([
      this.prisma.jobOffer.count({ where: { contributorId: id, status: { not: 'draft' } } }),
      this.prisma.jobUnlock.count({ where: { userId: id } }),
      this.prisma.careerDocument.count({ where: { userId: id, deletedAt: null } }),
      this.prisma.session.count({
        where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      auth.permissions.has(PERMISSIONS.SECURITY_EVENTS_READ) ? this.events(id) : null,
    ]);
    const summary = toSummary(row);
    const actor = actorOf(auth);
    const manageable = statusRefusal(actor, summary) === null;
    return {
      ...summary,
      phoneE164: row.phoneE164,
      locale: row.locale,
      activity: { publications, unlocks, documents, activeSessions },
      credits: auth.permissions.has(PERMISSIONS.FINANCE_READ)
        ? (row.creditAccount?.balance ?? 0)
        : null,
      events,
      can: {
        suspend: manageable && row.status === 'active',
        reactivate: manageable && row.status === 'suspended',
        manageRoles: rolesRefusal(actor, summary) === null,
      },
    };
  }

  /** Rôles, permissions de chacun (lues en base) et comptes de l'équipe. */
  async roles(): Promise<AdminRolesResponse> {
    const [roles, staff] = await Promise.all([
      this.prisma.role.findMany({
        select: {
          code: true,
          permissions: { select: { permission: { select: { code: true } } } },
          _count: { select: { users: true } },
        },
      }),
      this.prisma.user.findMany({
        where: STAFF,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: 200,
        select: SUMMARY,
      }),
    ]);
    return {
      roles: ROLE_CODES.flatMap((code) => {
        const role = roles.find((entry) => entry.code === code);
        return role
          ? [
              {
                code,
                permissions: role.permissions.map(
                  (entry) => entry.permission.code as PermissionCode,
                ),
                members: role._count.users,
              },
            ]
          : [];
      }),
      staff: staff.map(toSummary),
    };
  }

  async setStatus(
    auth: AuthContext,
    id: string,
    status: UserStatus,
    reason: string,
    client: ClientInfo,
  ): Promise<AdminUserDetail> {
    await this.prisma.$transaction(async (tx) => {
      const { actor, target } = await this.lockAndLoad(tx, auth, id);
      refuse(statusRefusal(actor, target));
      if (target.status === status) {
        throw new ConflictException({ code: ERROR_CODES.USER_STATE_CONFLICT });
      }
      if (status === 'suspended') await this.protectLastSuperAdmin(tx, target);
      await tx.user.update({ where: { id }, data: { status } });
      const revokedSessions =
        status === 'suspended' ? await this.sessions.revokeAll(id, 'suspended', undefined, tx) : 0;
      await this.securityEvents.record(
        {
          type: status === 'suspended' ? 'user_suspended' : 'user_reactivated',
          userId: actor.id,
          client,
          metadata: {
            targetId: id,
            actorRoles: [...actor.roles],
            reason,
            before: target.status,
            after: status,
            revokedSessions,
          },
        },
        tx,
      );
    });
    return this.get(auth, id);
  }

  async setRole(
    auth: AuthContext,
    id: string,
    input: UserRoleInput,
    client: ClientInfo,
  ): Promise<AdminUserDetail> {
    await this.prisma.$transaction(async (tx) => {
      const { actor, target } = await this.lockAndLoad(tx, auth, id);
      refuse(rolesRefusal(actor, target));
      if (target.roles.includes(input.role) === input.granted) {
        throw new ConflictException({ code: ERROR_CODES.USER_STATE_CONFLICT });
      }
      const role = await tx.role.findUniqueOrThrow({
        where: { code: input.role },
        select: { id: true },
      });
      if (input.granted) {
        // Un rôle d'équipe ne va qu'à un compte utilisable, dont l'adresse est vérifiée.
        if (target.status !== 'active' || !target.emailVerified) {
          throw new UnprocessableEntityException({ code: ERROR_CODES.USER_ROLE_INELIGIBLE });
        }
        await tx.userRole.create({
          data: { userId: id, roleId: role.id, assignedById: actor.id },
        });
      } else {
        if (input.role === 'super_admin') await this.protectLastSuperAdmin(tx, target);
        await tx.userRole.delete({ where: { userId_roleId: { userId: id, roleId: role.id } } });
      }
      // Changement de privilèges : nouvelle connexion exigée (double authentification comprise).
      const revokedSessions = await this.sessions.revokeAll(id, 'role_changed', undefined, tx);
      const after = input.granted
        ? ROLE_CODES.filter((code) => target.roles.includes(code) || code === input.role)
        : target.roles.filter((code) => code !== input.role);
      await this.securityEvents.record(
        {
          type: input.granted ? 'role_granted' : 'role_revoked',
          userId: actor.id,
          client,
          metadata: {
            targetId: id,
            actorRoles: [...actor.roles],
            role: input.role,
            reason: input.reason,
            before: [...target.roles],
            after: [...after],
            revokedSessions,
          },
        },
        tx,
      );
    });
    return this.get(auth, id);
  }

  /**
   * Verrou commun, puis relecture de l'acteur et de la cible : un administrateur suspendu ou
   * rétrogradé à l'instant ne peut plus agir, même avec une requête déjà en cours.
   */
  private async lockAndLoad(tx: Tx, auth: AuthContext, id: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
    const [actorRow, targetRow] = await Promise.all([
      tx.user.findUnique({
        where: { id: auth.user.id },
        select: {
          status: true,
          roles: {
            select: {
              role: {
                select: {
                  code: true,
                  permissions: { select: { permission: { select: { code: true } } } },
                },
              },
            },
          },
        },
      }),
      tx.user.findUnique({
        where: { id },
        select: { status: true, emailVerifiedAt: true, roles: SUMMARY.roles },
      }),
    ]);
    if (!actorRow || actorRow.status !== 'active') {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN });
    }
    if (!targetRow) throw new NotFoundException({ code: ERROR_CODES.USER_NOT_FOUND });
    const actor: UserAdminActor = {
      id: auth.user.id,
      roles: roleCodes(actorRow),
      permissions: new Set(
        actorRow.roles.flatMap((entry) =>
          entry.role.permissions.map((granted) => granted.permission.code),
        ),
      ),
    };
    return {
      actor,
      target: {
        id,
        status: targetRow.status,
        emailVerified: targetRow.emailVerifiedAt !== null,
        roles: roleCodes(targetRow),
      },
    };
  }

  /** La plateforme garde toujours au moins un super administrateur actif. */
  private async protectLastSuperAdmin(
    tx: Tx,
    target: { id: string; status: UserStatus; roles: RoleCode[] },
  ): Promise<void> {
    if (!target.roles.includes('super_admin')) return;
    const others = await tx.user.count({
      where: {
        id: { not: target.id },
        status: 'active',
        roles: { some: { role: { code: 'super_admin' } } },
      },
    });
    if (others === 0) throw new ConflictException({ code: ERROR_CODES.LAST_SUPER_ADMIN });
  }

  /** Événements du compte : les siens, et les actions d'administration qui le visent. */
  private async events(id: string): Promise<AdminUserEvent[]> {
    const rows = await this.prisma.securityEvent.findMany({
      where: {
        OR: [
          { userId: id, type: { notIn: ADMIN_EVENTS } },
          // Rôle attribué en ligne de commande : l'événement porte directement le compte visé.
          { userId: id, type: { in: ADMIN_EVENTS }, metadata: { path: ['via'], equals: 'cli' } },
          { type: { in: ADMIN_EVENTS }, metadata: { path: ['targetId'], equals: id } },
        ],
      },
      orderBy: { id: 'desc' },
      take: HISTORY_SIZE,
      select: {
        id: true,
        type: true,
        userId: true,
        metadata: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    return rows.map((row) => {
      const role = text(row.metadata, 'role');
      return {
        id: row.id,
        type: row.type,
        actor:
          row.userId !== null && row.userId !== id && row.user
            ? `${row.user.firstName} ${row.user.lastName}`.trim()
            : null,
        reason: ADMIN_EVENTS.includes(row.type) ? text(row.metadata, 'reason') : null,
        role: ROLE_CODES.find((code) => code === role) ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }
}

const actorOf = (auth: AuthContext): UserAdminActor => ({
  id: auth.user.id,
  roles: auth.roles,
  permissions: auth.permissions,
});

function refuse(refusal: UserAdminRefusal | null): void {
  if (refusal === 'self') {
    throw new ForbiddenException({ code: ERROR_CODES.USER_ACTION_SELF });
  }
  if (refusal === 'forbidden') {
    throw new ForbiddenException({ code: ERROR_CODES.USER_ACTION_FORBIDDEN });
  }
}
