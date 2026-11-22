import { PERMISSIONS } from '@opportinities/shared';
import { Check, ChevronRight, KeyRound, Minus } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { PersonCell } from '@/features/registry/registry-layout';
import { RoleBadges } from '@/features/users/role-badges';
import { USER_STATUS_TONE } from '@/features/users/tones';
import { Link } from '@/i18n/navigation';
import { getAdminRoles } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.ROLES_MANAGE))) return {};
  const t = await getTranslations('registry.roles');
  return { title: t('title') };
}

/** Permissions de chaque rôle et membres de l'équipe. Les rôles s'attribuent depuis une fiche. */
export default async function AdminRolesPage() {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const [t, tUsers, tErrors, format, data] = await Promise.all([
    getTranslations('registry.roles'),
    getTranslations('common.admin.users'),
    getTranslations('errors'),
    getFormatter(),
    getAdminRoles(),
  ]);
  const permissions = Object.values(PERMISSIONS);

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          <KeyRound className="size-6 text-brand" aria-hidden="true" />
          {t('title')}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{t('intro')}</p>
      </div>

      {data === null ? (
        <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>
      ) : (
        <>
          <section aria-labelledby="roles-staff" className="grid gap-3">
            <h2 id="roles-staff" className="text-[15px] font-semibold text-fg">
              {t('staff')}
            </h2>
            <Table className="min-w-[680px]">
              <thead>
                <tr>
                  <Th>{t('member')}</Th>
                  <Th>{t('role')}</Th>
                  <Th>{t('state')}</Th>
                  <Th>{t('mfa')}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {data.staff.map((user) => (
                  <Tr key={user.id}>
                    <Td>
                      <PersonCell person={user} />
                    </Td>
                    <Td>
                      <RoleBadges roles={user.roles} />
                    </Td>
                    <Td>
                      <Badge tone={USER_STATUS_TONE[user.status]}>
                        {tUsers(`status.${user.status}`)}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={user.mfaEnabled ? 'success' : 'warning'}>
                        {t(user.mfaEnabled ? 'mfaOn' : 'mfaOff')}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline sm:text-[13px]"
                      >
                        {t('open')}
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </section>

          <section aria-labelledby="roles-matrix" className="grid gap-3">
            <div>
              <h2 id="roles-matrix" className="text-[15px] font-semibold text-fg">
                {t('matrix')}
              </h2>
              <p className="mt-0.5 text-sm text-fg-muted sm:text-[13px]">{t('matrixHint')}</p>
            </div>
            <Table className="min-w-[680px]">
              <thead>
                <tr>
                  <Th>{t('permission')}</Th>
                  {data.roles.map((role) => (
                    <Th key={role.code} className="text-center">
                      <span className="block">{tUsers(`roles.${role.code}`)}</span>
                      <span className="block font-normal">
                        {t('members', { count: role.members, value: format.number(role.members) })}
                      </span>
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((permission) => (
                  <Tr key={permission}>
                    <Td>{t(`permissions.${permission.replace('.', '_') as PermissionKey}`)}</Td>
                    {data.roles.map((role) => {
                      const granted = role.permissions.includes(permission);
                      const Icon = granted ? Check : Minus;
                      return (
                        <Td key={role.code} className="text-center">
                          <Icon
                            className={
                              granted
                                ? 'mx-auto size-4 text-success'
                                : 'mx-auto size-4 text-fg-subtle/50'
                            }
                            aria-hidden="true"
                          />
                          <span className="sr-only">{t(granted ? 'yes' : 'no')}</span>
                        </Td>
                      );
                    })}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </section>
        </>
      )}
    </div>
  );
}

type PermissionKey =
  | 'admin_access'
  | 'users_read'
  | 'users_manage'
  | 'roles_manage'
  | 'jobs_moderate'
  | 'security_events_read'
  | 'audit_logs_read'
  | 'settings_manage'
  | 'finance_read'
  | 'finance_manage';
