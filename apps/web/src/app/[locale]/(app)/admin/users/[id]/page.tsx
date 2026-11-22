import { flagEmoji, PERMISSIONS } from '@opportinities/shared';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { RoleBadges } from '@/features/users/role-badges';
import { USER_STATUS_TONE } from '@/features/users/tones';
import { UserActions } from '@/features/users/user-actions';
import { getAdminUser } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.USERS_READ))) return {};
  const t = await getTranslations('registry.users');
  return { title: t('title') };
}

/** Fiche d'un compte : identité, activité, historique et actions permises. */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.USERS_READ);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getAdminUser(id);
  if (!user) notFound();
  const [t, tAdmin, format] = await Promise.all([
    getTranslations('registry.users'),
    getTranslations('common.admin'),
    getFormatter(),
  ]);
  const when = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });

  const identity: [string, string][] = [
    [t('email'), user.email],
    [t('phone'), user.phoneE164 ?? t('notProvided')],
    [t('country'), `${flagEmoji(user.countryIso2)} ${user.countryIso2}`],
    [t('language'), t(`languages.${user.locale}`)],
    [t('created'), when(user.createdAt)],
    [t('lastLogin'), user.lastLoginAt ? when(user.lastLoginAt) : t('never')],
    [t('emailState'), t(user.emailVerified ? 'verified' : 'unverified')],
    [t('mfa'), t(user.mfaEnabled ? 'enabled' : 'disabled')],
  ];
  const activity: [string, number][] = [
    [t('publications'), user.activity.publications],
    [t('unlocks'), user.activity.unlocks],
    [t('documents'), user.activity.documents],
    [t('sessions'), user.activity.activeSessions],
    ...(user.credits === null ? [] : ([[t('credits'), user.credits]] as [string, number][])),
  ];

  return (
    <div className="grid gap-6">
      <div>
        <ButtonLink href="/admin/users" variant="ghost" size="sm" icon={ArrowLeft}>
          {t('back')}
        </ButtonLink>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-[-0.02em] break-words text-fg sm:text-[28px]">
            {user.name}
          </h1>
          <Badge tone={USER_STATUS_TONE[user.status]}>
            {tAdmin(`users.status.${user.status}`)}
          </Badge>
          <RoleBadges roles={user.roles} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="grid gap-6">
          <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <h2 className="mb-4 text-base font-semibold text-fg">{t('identity')}</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {identity.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-fg-subtle">{label}</dt>
                  <dd className="text-sm font-medium break-all text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <h2 className="mb-4 text-base font-semibold text-fg">{t('activity')}</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {activity.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-fg-subtle">{label}</dt>
                  <dd className="text-lg font-bold text-fg tabular-nums">{format.number(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
          {user.events && (
            <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
              <h2 className="mb-4 text-base font-semibold text-fg">{t('history')}</h2>
              {user.events.length === 0 ? (
                <p className="text-sm text-fg-muted">{t('noHistory')}</p>
              ) : (
                <ol className="grid gap-3">
                  {user.events.map((event) => (
                    <li key={event.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-fg">
                          {tAdmin(`events.${event.type}`)}
                          {event.role && ` : ${tAdmin(`users.roles.${event.role}`)}`}
                        </p>
                        {(event.actor ?? event.reason) && (
                          <p className="mt-0.5 text-sm break-words text-fg-muted sm:text-[13px]">
                            {[event.actor && t('by', { name: event.actor }), event.reason]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="text-xs whitespace-nowrap text-fg-subtle">
                        {when(event.createdAt)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
        <div className="grid gap-6">
          <UserActions user={user} />
        </div>
      </div>
    </div>
  );
}
