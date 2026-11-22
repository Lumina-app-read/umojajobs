import { type CommissionStatus, type CreditOrderStatus } from '@opportinities/shared';
import { type BadgeTone } from '@/components/ui/badge';

export const ORDER_TONE: Record<CreditOrderStatus, BadgeTone> = {
  pending: 'warning',
  paid: 'success',
  failed: 'danger',
  abandoned: 'neutral',
  anomaly: 'danger',
};

export const COMMISSION_TONE: Record<CommissionStatus, BadgeTone> = {
  pending: 'warning',
  available: 'primary',
  paid: 'success',
  reversed: 'danger',
};
