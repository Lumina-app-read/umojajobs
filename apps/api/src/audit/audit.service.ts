import { Injectable, Logger } from '@nestjs/common';
import { AUDIT_PAGE_SIZE, type AuditLogPage, type AuditResult } from '@opportinities/shared';
import { type NextFunction, type Response } from 'express';
import { type AppRequest, getClientInfo } from '../common/http/app-request';
import { type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { auditContext, type AuditChange } from './audit-context';
import { redact } from './redact';

const ADMIN_PREFIX = /^\/api\/v\d+(\/admin\/.*)$/;
/** Consultations journalisées : données personnelles ou financières d'un compte précis. */
const SENSITIVE_READS = [/^\/admin\/users\/[^/]+$/, /^\/admin\/withdrawals\/[^/]+$/];

const resultOf = (status: number): AuditResult =>
  status >= 500
    ? 'error'
    : status === 401 || status === 403
      ? 'denied'
      : status >= 400
        ? 'rejected'
        : 'success';

/**
 * Journal d'audit de l'administration. Chaque modification (et chaque consultation sensible) est
 * inscrite à la fin de la requête, qu'elle ait réussi ou non, avec les valeurs avant et après que
 * les services ont fournies pendant le traitement.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Middleware Express : ouvre le contexte d'audit, puis journalise à la fin de la réponse. */
  readonly middleware = (req: AppRequest, res: Response, next: NextFunction): void => {
    const match = ADMIN_PREFIX.exec(req.path);
    const path = match?.[1];
    if (!path) return next();
    const logged = req.method !== 'GET' || SENSITIVE_READS.some((pattern) => pattern.test(path));
    if (!logged) return next();
    const store = { changes: [] as AuditChange[] };
    res.on('finish', () => {
      void this.write(req, res.statusCode, path, store.changes).catch((error: unknown) => {
        this.logger.error(
          `Journal d'audit non écrit [${req.requestId}] : ${(error as Error).message}`,
        );
      });
    });
    auditContext.run(store, next);
  };

  async list(query: {
    before?: string;
    result?: AuditResult;
    actor?: string;
  }): Promise<AuditLogPage> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(query.before && { id: { lt: query.before } }),
        ...(query.result && { result: query.result }),
        ...(query.actor && {
          actor: { email: { contains: query.actor, mode: 'insensitive' } },
        }),
      },
      orderBy: { id: 'desc' },
      take: AUDIT_PAGE_SIZE + 1,
      include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    const items = rows.slice(0, AUDIT_PAGE_SIZE);
    return {
      next: rows.length > AUDIT_PAGE_SIZE ? (items.at(-1)?.id ?? null) : null,
      items: items.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        actor: row.actor
          ? {
              id: row.actor.id,
              name: `${row.actor.firstName} ${row.actor.lastName}`.trim(),
              email: row.actor.email,
            }
          : null,
        actorRoles: row.actorRoles,
        method: row.method,
        route: row.route,
        targetId: row.targetId,
        statusCode: row.statusCode,
        result: row.result,
        ip: row.ip,
        userAgent: row.userAgent,
        requestId: row.requestId,
        input: row.input,
        changes: row.changes as AuditLogPage['items'][number]['changes'],
      })),
    };
  }

  private async write(
    req: AppRequest,
    statusCode: number,
    path: string,
    changes: AuditChange[],
  ): Promise<void> {
    const client = getClientInfo(req);
    // Modèle de route Express (« /api/v1/admin/users/:id/suspend ») ; à défaut, le chemin réel.
    const pattern = (req.route as { path?: string } | undefined)?.path;
    const route = (pattern ? pattern.replace(/^\/api\/v\d+/, '') : path).slice(0, 200);
    const params = (req.params ?? {}) as Record<string, string | undefined>;
    const targetId =
      params.id ?? params.exportId ?? params.fileId ?? params.key ?? params.iso2 ?? null;
    const body = req.method === 'GET' ? null : redact(req.body);
    await this.prisma.auditLog.create({
      data: {
        actorId: req.auth?.user.id ?? null,
        actorRoles: req.auth ? [...req.auth.roles] : [],
        method: req.method.slice(0, 10),
        route,
        path: path.slice(0, 300),
        targetId: targetId?.slice(0, 100) ?? null,
        statusCode,
        result: resultOf(statusCode),
        ip: client.ip,
        userAgent: client.userAgent,
        requestId: client.requestId,
        ...(body !== null && body !== undefined && { input: body }),
        changes: redact(changes) as Prisma.InputJsonValue,
      },
    });
  }
}
