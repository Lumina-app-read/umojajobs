import { AFRICAN_COUNTRIES, flagEmoji, ROLE_CODES, type RoleCode } from '@opportinities/shared';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { PreferenceControls } from '@/components/layout/preference-controls';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/feedback';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.app.nav');
  return { title: t('settings') };
}

function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}

/** Paramètres : informations du compte (lecture seule pour l'instant) et préférences d'affichage. */
export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations('common');
  const locale = await getLocale();
  const country = AFRICAN_COUNTRIES.find((entry) => entry.iso2 === user.countryIso2);
  const countryLabel = country
    ? locale === 'fr'
      ? country.nameFr
      : country.nameEn
    : user.countryIso2;
  const fullName = `${user.firstName} ${user.lastName}`;
  const roles = (user.roles as string[]).filter(isRoleCode);

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: t('dashboard.email'), value: user.email },
    {
      label: t('dashboard.country'),
      value: (
        <span className="flex items-center gap-2">
          <span aria-hidden="true">{flagEmoji(user.countryIso2)}</span>
          {countryLabel}
        </span>
      ),
    },
    {
      label: t('dashboard.roles'),
      value: (
        <span className="flex flex-wrap gap-1.5">
          {roles.map((role) => (
            <Badge key={role} tone="primary">
              {t(`roles.${role}`)}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      label: t('dashboard.security'),
      value: (
        <span className="flex items-center gap-2">
          {user.totpEnabled ? (
            <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          ) : (
            <ShieldOff className="size-4 text-fg-subtle" aria-hidden="true" />
          )}
          {user.totpEnabled ? t('dashboard.mfaEnabled') : t('dashboard.mfaDisabled')}
        </span>
      ),
    },
  ];

  return (
    <div className="grid max-w-3xl gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg">{t('app.nav.settings')}</h1>
        <p className="mt-1.5 text-sm text-fg-muted">{t('app.settings.intro')}</p>
      </div>

      <section
        aria-labelledby="settings-account"
        className="rounded-xl border border-line bg-surface shadow-xs"
      >
        <div className="flex items-center gap-4 border-b border-line p-5">
          <Avatar name={fullName} size="lg" />
          <div className="min-w-0">
            <h2 id="settings-account" className="truncate text-base font-semibold text-fg">
              {fullName}
            </h2>
            <p className="text-[13px] text-fg-muted">{t('app.settings.account')}</p>
          </div>
        </div>
        <dl className="divide-y divide-line">
          {rows.map(({ label, value }) => (
            <div key={label} className="grid gap-1 px-5 py-4 sm:grid-cols-[200px_1fr] sm:gap-4">
              <dt className="text-sm text-fg-muted">{label}</dt>
              <dd className="text-sm font-medium text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="settings-preferences"
        className="rounded-xl border border-line bg-surface p-5 shadow-xs"
      >
        <h2 id="settings-preferences" className="text-base font-semibold text-fg">
          {t('app.settings.preferences')}
        </h2>
        <p className="mt-1 text-[13px] text-fg-muted">{t('app.settings.preferencesHint')}</p>
        <div className="mt-5 max-w-sm">
          <PreferenceControls />
        </div>
      </section>
    </div>
  );
}
