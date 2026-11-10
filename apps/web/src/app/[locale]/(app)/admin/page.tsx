import { PERMISSIONS } from '@opportinities/shared';
import { ArrowRight, Layers, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  // Sans la permission, rien ne doit révéler l'existence de l'administration.
  if (!(await hasPermission(PERMISSIONS.ADMIN_ACCESS))) return {};
  const t = await getTranslations('common.admin.overview');
  return { title: t('title') };
}

/** Accueil de l'administration : ce qui est disponible selon les permissions, ce qui arrive. */
export default async function AdminOverviewPage() {
  const user = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  const t = await getTranslations('common.admin.overview');
  const canReadSecurity = user.permissions.includes(PERMISSIONS.SECURITY_EVENTS_READ);

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          {t('title')}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">{t('intro')}</p>
      </div>

      {canReadSecurity && (
        <section
          aria-labelledby="admin-security"
          className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-xs sm:flex-row sm:items-center"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-brand">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="admin-security"
              className="flex items-center gap-2 text-base font-semibold text-fg"
            >
              {t('securityTitle')}
              <Badge tone="success">{t('available')}</Badge>
            </h2>
            <p className="mt-1 text-sm text-fg-muted">{t('securityBody')}</p>
          </div>
          <ButtonLink href="/admin/security-events" variant="secondary" trailingIcon={ArrowRight}>
            {t('open')}
          </ButtonLink>
        </section>
      )}

      <EmptyState
        icon={Layers}
        title={t('modules')}
        description={t('modulesBody')}
        className="bg-surface py-12"
      />
    </div>
  );
}
