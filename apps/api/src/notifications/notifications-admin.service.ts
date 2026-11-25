import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ADMIN_EMAILS_PAGE_SIZE,
  ADMIN_EMAILS_RETRY_LIMIT,
  type AdminEmailsPage,
  ERROR_CODES,
  NOTIFICATION_EMAIL_STATUSES,
  type NotificationEmailStatus,
} from '@opportinities/shared';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Supervision des emails de notification (administration) : état de la file d'envoi et relance
 * des emails abandonnés. Le contenu des notifications n'est pas exposé, seulement leur type.
 */
@Injectable()
export class NotificationsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: { status?: NotificationEmailStatus; before?: string },
    now = new Date(),
  ): Promise<AdminEmailsPage> {
    const [rows, totals, sentLast7d, byType] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          ...(query.status && { emailStatus: query.status }),
          ...(query.before && { id: { lt: query.before } }),
        },
        orderBy: { id: 'desc' },
        take: ADMIN_EMAILS_PAGE_SIZE + 1,
        select: {
          id: true,
          type: true,
          emailStatus: true,
          emailAttempts: true,
          emailNextAt: true,
          emailSentAt: true,
          createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.notification.groupBy({ by: ['emailStatus'], _count: true }),
      this.prisma.notification.count({
        where: { emailStatus: 'sent', emailSentAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
      }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
        _count: true,
        orderBy: { _count: { type: 'desc' } },
      }),
    ]);
    const page = rows.slice(0, ADMIN_EMAILS_PAGE_SIZE);
    const waiting = (status: string) => status === 'pending' || status === 'sending';
    return {
      items: page.map((row) => ({
        id: row.id,
        type: row.type,
        recipient: {
          id: row.user.id,
          name: `${row.user.firstName} ${row.user.lastName}`.trim(),
          email: row.user.email,
        },
        status: row.emailStatus,
        attempts: row.emailAttempts,
        createdAt: row.createdAt.toISOString(),
        nextAttemptAt: waiting(row.emailStatus) ? row.emailNextAt.toISOString() : null,
        sentAt: row.emailSentAt?.toISOString() ?? null,
      })),
      nextBefore: rows.length > ADMIN_EMAILS_PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
      totals: Object.fromEntries(
        NOTIFICATION_EMAIL_STATUSES.map((status) => [
          status,
          totals.find((row) => row.emailStatus === status)?._count ?? 0,
        ]),
      ) as Record<NotificationEmailStatus, number>,
      sentLast7d,
      byType: byType.map((row) => ({ type: row.type, count: row._count })),
    };
  }

  /**
   * Remet en file un email abandonné (ou tous, dans la limite prévue) : nouvelles tentatives
   * immédiates, avec le même plafond. Seuls les emails en échec sont concernés. L'action est
   * tracée par le journal d'audit de l'administration.
   */
  async retry(id: string | null): Promise<{ requeued: number }> {
    const where = { emailStatus: 'failed' as const, ...(id && { id }) };
    if (id && !(await this.prisma.notification.findFirst({ where, select: { id: true } }))) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND });
    }
    const targets = await this.prisma.notification.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      take: ADMIN_EMAILS_RETRY_LIMIT,
    });
    const { count } = await this.prisma.notification.updateMany({
      where: { id: { in: targets.map((row) => row.id) }, emailStatus: 'failed' },
      data: { emailStatus: 'pending', emailAttempts: 0, emailNextAt: new Date() },
    });
    return { requeued: count };
  }
}
