import { Injectable, Logger } from '@nestjs/common';
import {
  type NotificationData,
  NOTIFICATIONS_PAGE_SIZE,
  type NotificationsPage,
} from '@opportinities/shared';
import { Prisma } from '../generated/prisma/client';
import { EmailTemplatesService } from '../mail/email-templates.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const BATCH = 50;
const MAX_ATTEMPTS = 5;
/** Un envoi interrompu (arrêt du serveur) est repris après ce délai. */
const STALE_SENDING_MS = 10 * 60_000;

/**
 * Centre de notifications et file d'envoi des emails. Chaque email est pris par une seule
 * exécution (verrou de ligne), renvoyé avec un délai croissant en cas d'échec, puis abandonné
 * après cinq tentatives ; la notification interne reste visible dans tous les cas.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly templates: EmailTemplatesService,
  ) {}

  async list(userId: string, before: string | undefined): Promise<NotificationsPage> {
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, ...(before && { id: { lt: before } }) },
        orderBy: { id: 'desc' },
        take: NOTIFICATIONS_PAGE_SIZE + 1,
        select: { id: true, type: true, data: true, link: true, readAt: true, createdAt: true },
      }),
      this.unread(userId),
    ]);
    const items = rows.slice(0, NOTIFICATIONS_PAGE_SIZE);
    return {
      unread,
      next: rows.length > NOTIFICATIONS_PAGE_SIZE ? (items.at(-1)?.id ?? null) : null,
      items: items.map((row) => ({
        id: row.id,
        type: row.type,
        data: row.data as NotificationData,
        link: row.link,
        read: row.readAt !== null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  unread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** Marque comme lues les notifications indiquées, ou toutes ; seulement celles du compte. */
  async markRead(userId: string, ids: string[] | undefined): Promise<number> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids && { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
    return this.unread(userId);
  }

  /** Envoie les emails en attente ; renvoie le nombre d'emails partis. */
  async dispatch(now: Date = new Date()): Promise<number> {
    await this.prisma.notification.updateMany({
      where: {
        emailStatus: 'sending',
        emailNextAt: { lt: new Date(now.getTime() - STALE_SENDING_MS) },
      },
      data: { emailStatus: 'pending' },
    });
    const claimed = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE "notifications" SET "email_status" = 'sending', "email_next_at" = ${now},
        "email_attempts" = "email_attempts" + 1
      WHERE "id" IN (
        SELECT "id" FROM "notifications"
        WHERE "email_status" = 'pending' AND "email_next_at" <= ${now}
        ORDER BY "id" LIMIT ${BATCH} FOR UPDATE SKIP LOCKED
      )
      RETURNING "id"`;
    if (claimed.length === 0) return 0;
    const rows = await this.prisma.notification.findMany({
      where: { id: { in: claimed.map((row) => row.id) } },
      select: {
        id: true,
        type: true,
        data: true,
        link: true,
        emailAttempts: true,
        user: {
          select: {
            email: true,
            firstName: true,
            locale: true,
            emailVerifiedAt: true,
            status: true,
          },
        },
      },
    });
    let sent = 0;
    for (const row of rows) {
      const { user } = row;
      // Adresse non vérifiée : rien n'est envoyé. Compte suspendu : seul l'avis de suspension part.
      const deliverable =
        user.emailVerifiedAt !== null &&
        (user.status === 'active' || row.type === 'account_suspended');
      if (!deliverable) {
        await this.finish(row.id, 'skipped');
        continue;
      }
      const ok = await this.mail.send(
        this.templates.notification(
          { email: user.email, firstName: user.firstName, locale: user.locale },
          row.type,
          row.data as NotificationData,
          row.link,
        ),
      );
      if (ok) {
        sent += 1;
        await this.finish(row.id, 'sent');
      } else if (row.emailAttempts >= MAX_ATTEMPTS) {
        this.logger.error(
          `Notification ${row.id} : email abandonné après ${MAX_ATTEMPTS} tentatives`,
        );
        await this.finish(row.id, 'failed');
      } else {
        // Reprise après 2, 4, 8 puis 16 minutes.
        await this.prisma.notification.update({
          where: { id: row.id },
          data: {
            emailStatus: 'pending',
            emailNextAt: new Date(now.getTime() + 2 ** row.emailAttempts * 60_000),
          },
        });
      }
    }
    return sent;
  }

  private finish(id: string, status: 'sent' | 'failed' | 'skipped') {
    return this.prisma.notification.update({
      where: { id },
      data: {
        emailStatus: status,
        ...(status === 'sent' && { emailSentAt: new Date() }),
      } satisfies Prisma.NotificationUpdateInput,
    });
  }
}
