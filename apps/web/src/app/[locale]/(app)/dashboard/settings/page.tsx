import { ROLE_CODES, type RoleCode } from '@opportinities/shared';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import { PreferenceControls } from '@/components/layout/preference-controls';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PasswordForm } from '@/features/settings/password-form';
import { ProfileForm } from '@/features/settings/profile-form';
import { SessionsList } from '@/features/settings/sessions-list';
import { getCountries, getSessions } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.app.nav');
  return { title: t('settings') };
}

function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}

/** Section de la page : titre, explication courte, contenu. */
function SettingsSection({
  id,
  title,
  hint,
  aside,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-line bg-surface p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id} className="text-base font-semibold text-fg">
            {title}
          </h2>
          {hint && <p className="mt-1 text-[13px] text-fg-muted">{hint}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Paramètres : profil, préférences synchronisées, mot de passe, double authentification, sessions. */
export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations('common');
  const tErrors = await getTranslations('errors');
  const [countries, sessions] = await Promise.all([
    getCountries().catch(() => null),
    getSessions(),
  ]);
  const roles = (user.roles as string[]).filter(isRoleCode);

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg">{t('app.nav.settings')}</h1>
        <p className="mt-1.5 text-sm text-fg-muted">{t('app.settings.intro')}</p>
      </div>

      <SettingsSection
        id="settings-profile"
        title={t('app.settings.profile')}
        hint={t('app.settings.profileHint')}
        aside={
          <span className="flex flex-wrap gap-1.5">
            {roles.map((role) => (
              <Badge key={role} tone="primary">
                {t(`roles.${role}`)}
              </Badge>
            ))}
          </span>
        }
      >
        {countries ? (
          <ProfileForm user={user} countries={countries} />
        ) : (
          <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>
        )}
      </SettingsSection>

      <SettingsSection
        id="settings-preferences"
        title={t('app.settings.preferences')}
        hint={t('app.settings.preferencesHint')}
      >
        <div className="max-w-sm">
          <PreferenceControls />
        </div>
      </SettingsSection>

      <SettingsSection
        id="settings-security"
        title={t('app.settings.security')}
        aside={
          <span className="flex items-center gap-2 text-[13px] font-medium text-fg-muted">
            {user.totpEnabled ? (
              <ShieldCheck className="size-4 text-success" aria-hidden="true" />
            ) : (
              <ShieldOff className="size-4 text-fg-subtle" aria-hidden="true" />
            )}
            {user.totpEnabled ? t('dashboard.mfaEnabled') : t('dashboard.mfaDisabled')}
          </span>
        }
      >
        <h3 className="text-sm font-semibold text-fg">{t('app.settings.passwordTitle')}</h3>
        <p className="mt-1 mb-4 text-[13px] text-fg-muted">{t('app.settings.passwordHint')}</p>
        <PasswordForm />
      </SettingsSection>

      <SettingsSection
        id="settings-sessions"
        title={t('app.settings.sessions')}
        hint={t('app.settings.sessionsHint')}
      >
        <SessionsList sessions={sessions} />
      </SettingsSection>
    </div>
  );
}
