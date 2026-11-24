import { type NotificationType } from '@opportinities/shared';
import {
  Ban,
  BadgeCheck,
  Coins,
  HandCoins,
  type LucideIcon,
  MessageSquareWarning,
  PauseCircle,
  Send,
  Unlock,
  Wallet,
  XCircle,
} from 'lucide-react';

export const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  offer_submitted: Send,
  offer_approved: BadgeCheck,
  offer_correction_requested: MessageSquareWarning,
  offer_rejected: XCircle,
  offer_suspended: PauseCircle,
  offer_unlocked: Unlock,
  commission_earned: HandCoins,
  commission_available: Wallet,
  credits_purchased: Coins,
  withdrawal_updated: Wallet,
  account_suspended: Ban,
};
