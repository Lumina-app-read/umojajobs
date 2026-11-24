import {
  EMAILED_NOTIFICATION_TYPES,
  type NotificationData,
  type NotificationType,
} from '@opportinities/shared';
import { type Prisma } from '../generated/prisma/client';

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  data?: NotificationData;
  link?: string | null;
  /** Identifiant de l'événement : la même clé ne crée jamais deux notifications. */
  key: string;
}

/**
 * Enregistre une notification dans la transaction de l'événement métier. Elle n'existe donc que si
 * l'événement est validé, et jamais en double (clé unique). L'email éventuel part plus tard.
 */
export async function notify(
  tx: Prisma.TransactionClient,
  input: NotificationInput,
): Promise<void> {
  await tx.notification.createMany({
    data: [
      {
        userId: input.userId,
        type: input.type,
        data: (input.data ?? {}) as Prisma.InputJsonObject,
        link: input.link ?? null,
        dedupeKey: `${input.type}:${input.key}`.slice(0, 200),
        emailStatus: EMAILED_NOTIFICATION_TYPES.includes(input.type) ? 'pending' : 'skipped',
      },
    ],
    skipDuplicates: true,
  });
}
