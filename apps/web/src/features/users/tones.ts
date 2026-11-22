import { type RoleCode, type UserStatus } from '@opportinities/shared';
import { type BadgeTone } from '@/components/ui/badge';

export const USER_STATUS_TONE: Record<UserStatus, BadgeTone> = {
  active: 'success',
  suspended: 'danger',
};

export const ROLE_TONE: Record<RoleCode, BadgeTone> = {
  user: 'neutral',
  moderator: 'primary',
  admin: 'warning',
  super_admin: 'danger',
};
