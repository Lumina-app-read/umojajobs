import { type WithdrawalStatus } from '@opportinities/shared';
import { type BadgeTone } from '@/components/ui/badge';

/** Couleur du badge d'état d'un retrait (espace personnel et administration). */
export const WITHDRAWAL_TONE: Record<WithdrawalStatus, BadgeTone> = {
  pending: 'warning',
  under_review: 'warning',
  approved: 'primary',
  processing: 'primary',
  paid: 'success',
  rejected: 'danger',
};
