/** Notifications internes (centre de notifications) et emails associés. */
export const NOTIFICATION_TYPES = [
  'offer_submitted',
  'offer_approved',
  'offer_correction_requested',
  'offer_rejected',
  'offer_suspended',
  'offer_unlocked',
  'commission_earned',
  'commission_available',
  'credits_purchased',
  'withdrawal_updated',
  'account_suspended',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Types envoyés aussi par email (CLAUDE.md §18). Une commission en attente n'en déclenche pas :
 * l'email part quand elle devient disponible, pour éviter un message à chaque déverrouillage.
 */
export const EMAILED_NOTIFICATION_TYPES: readonly NotificationType[] = NOTIFICATION_TYPES.filter(
  (type) => type !== 'commission_earned',
);

/** Paramètres affichés dans le texte (jamais de donnée sensible : ni coordonnées ni secrets). */
export interface NotificationData {
  offer?: string;
  reason?: string;
  credits?: number;
  amountUsd?: string;
  status?: string;
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  data: NotificationData;
  /** Page à ouvrir dans l'application (chemin sans langue), ou null. */
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsPage {
  items: NotificationResponse[];
  unread: number;
  /** Identifiant à passer en `before` pour la page suivante, ou null. */
  next: string | null;
}

export const NOTIFICATIONS_PAGE_SIZE = 20;

/** États d'envoi de l'email d'une notification. */
export const NOTIFICATION_EMAIL_STATUSES = [
  'pending',
  'sending',
  'sent',
  'failed',
  'skipped',
] as const;
export type NotificationEmailStatus = (typeof NOTIFICATION_EMAIL_STATUSES)[number];

/** Supervision des emails (administration) : une ligne par notification. */
export interface AdminEmailItem {
  id: string;
  type: NotificationType;
  recipient: { id: string; name: string; email: string };
  status: NotificationEmailStatus;
  attempts: number;
  createdAt: string;
  nextAttemptAt: string | null;
  sentAt: string | null;
}

export interface AdminEmailsPage {
  items: AdminEmailItem[];
  /** Curseur de la page suivante (dernier identifiant), null en fin de liste. */
  nextBefore: string | null;
  /** Nombre d'emails par état, sur tout l'historique. */
  totals: Record<NotificationEmailStatus, number>;
  /** Emails envoyés sur les 7 derniers jours. */
  sentLast7d: number;
  /** Notifications créées par type sur les 30 derniers jours. */
  byType: { type: NotificationType; count: number }[];
}

export const ADMIN_EMAILS_PAGE_SIZE = 50;

/** Nombre maximal d'emails en échec relancés d'un coup. */
export const ADMIN_EMAILS_RETRY_LIMIT = 500;
