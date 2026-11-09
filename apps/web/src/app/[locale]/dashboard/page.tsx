import { AFRICAN_COUNTRIES, ROLE_CODES, type RoleCode } from '@opportinities/shared';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { LogoutButton } from '@/features/auth/logout-button';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.nav');
  return { title: t('dashboard'), robots: { index: false } };
}

function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}

/** Tableau de bord provisoire (phase 1d) : le tableau de bord complet arrive en phase 1e. */
export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations('common');
  const locale = await getLocale();
  const country = AFRICAN_COUNTRIES.find((entry) => entry.iso2 === user.countryIso2);
  const countryLabel = country
    ? locale === 'fr'
      ? country.nameFr
      : country.nameEn
    : user.countryIso2;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('dashboard.title', { firstName: user.firstName })}
          </h1>
          <p className="mt-1 text-sm text-muted">{t('dashboard.intro')}</p>
        </div>
        <LogoutButton />
      </div>
      <Card>
        <h2 className="text-base font-semibold text-foreground">{t('dashboard.account')}</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">{t('dashboard.email')}</dt>
            <dd className="mt-1 font-medium text-foreground">{user.email}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('dashboard.country')}</dt>
            <dd className="mt-1 font-medium text-foreground">{countryLabel}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('dashboard.roles')}</dt>
            <dd className="mt-1 font-medium text-foreground">
              {(user.roles as string[])
                .filter(isRoleCode)
                .map((role) => t(`roles.${role}`))
                .join(', ')}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t('dashboard.security')}</dt>
            <dd className="mt-1 flex items-center gap-2 font-medium text-foreground">
              {user.totpEnabled ? (
                <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              ) : (
                <ShieldOff className="size-4 text-muted" aria-hidden="true" />
              )}
              {user.totpEnabled ? t('dashboard.mfaEnabled') : t('dashboard.mfaDisabled')}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
