import { type RoleCode } from '@opportinities/shared';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { ROLE_TONE } from './tones';

/** Rôles d'équipe d'un compte ; « Utilisateur » seulement s'il n'en a aucun. */
export function RoleBadges({ roles }: { roles: readonly RoleCode[] }) {
  const t = useTranslations('common.admin.users.roles');
  const staff = roles.filter((role) => role !== 'user');
  return (
    <span className="inline-flex flex-wrap gap-1">
      {(staff.length > 0 ? staff : (['user'] as const)).map((role) => (
        <Badge key={role} tone={ROLE_TONE[role]}>
          {t(role)}
        </Badge>
      ))}
    </span>
  );
}
