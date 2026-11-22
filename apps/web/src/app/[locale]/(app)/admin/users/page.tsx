import { flagEmoji, PERMISSIONS, USER_FILTERS } from '@opportinities/shared';
import { Ban, ChevronRight, ShieldCheck, UserPlus, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/feedback';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { type SearchParams } from '@/features/jobs/routes';
import { readRegistryState } from '@/features/registry/query';
import { PersonCell, RegistryLayout } from '@/features/registry/registry-layout';
import { RoleBadges } from '@/features/users/role-badges';
import { USER_STATUS_TONE } from '@/features/users/tones';
import { Link } from '@/i18n/navigation';
import { getUserRegistry } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.USERS_READ))) return {};
  const t = await getTranslations('registry.users');
  return { title: t('title') };
}

/** Comptes de la plateforme : recherche, filtres et accès à chaque fiche. */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission(PERMISSIONS.USERS_READ);
  const state = readRegistryState(await searchParams, USER_FILTERS);
  const [t, tStatus, format, data] = await Promise.all([
    getTranslations('registry.users'),
    getTranslations('common.admin.users.status'),
    getFormatter(),
    getUserRegistry({ q: state.q, status: state.status ?? undefined, page: state.page }),
  ]);
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' });

  return (
    <RegistryLayout
      base="/admin/users"
      icon={Users}
      title={t('title')}
      intro={t('intro')}
      searchHint={t('searchHint')}
      state={state}
      statuses={USER_FILTERS.map((value) => ({ value, label: t(`filters.${value}`) }))}
      data={data}
      results={t('results', { count: data?.total ?? 0 })}
      empty={t('empty')}
      stats={
        data && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Users} label={t('total')} value={format.number(data.summary.total)} />
            <StatCard
              icon={UserPlus}
              label={t('new')}
              value={format.number(data.summary.newThisMonth)}
              hint={t('newHint')}
            />
            <StatCard
              icon={ShieldCheck}
              label={t('staff')}
              value={format.number(data.summary.staff)}
              hint={t('staffHint')}
            />
            <StatCard
              icon={Ban}
              label={t('suspended')}
              value={format.number(data.summary.suspended)}
            />
          </div>
        )
      }
    >
      <Table className="min-w-[860px]">
        <thead>
          <tr>
            <Th>{t('user')}</Th>
            <Th>{t('country')}</Th>
            <Th>{t('role')}</Th>
            <Th>{t('state')}</Th>
            <Th>{t('created')}</Th>
            <Th>{t('lastLogin')}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {data?.items.map((item) => (
            <Tr key={item.id}>
              <Td>
                <PersonCell person={item} />
              </Td>
              <Td className="whitespace-nowrap text-fg-muted">
                {flagEmoji(item.countryIso2)} {item.countryIso2}
              </Td>
              <Td>
                <RoleBadges roles={item.roles} />
              </Td>
              <Td>
                <span className="inline-flex flex-wrap gap-1">
                  <Badge tone={USER_STATUS_TONE[item.status]}>{tStatus(item.status)}</Badge>
                  {!item.emailVerified && <Badge tone="warning">{t('unverified')}</Badge>}
                </span>
              </Td>
              <Td className="whitespace-nowrap text-fg-muted">{date(item.createdAt)}</Td>
              <Td className="whitespace-nowrap text-fg-muted">
                {item.lastLoginAt ? date(item.lastLoginAt) : t('never')}
              </Td>
              <Td className="text-right">
                <Link
                  href={`/admin/users/${item.id}`}
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
    </RegistryLayout>
  );
}
