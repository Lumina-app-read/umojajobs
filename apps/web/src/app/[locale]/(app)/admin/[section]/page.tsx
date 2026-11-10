import { LayoutDashboard } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { ADMIN_NAV_ITEMS, type AdminNavItem } from '@/features/app-shell/admin-nav';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

type Params = Promise<{ section: string }>;

function findSection(section: string): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((item) => item.phase !== null && item.href === `/admin/${section}`);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const item = findSection((await params).section);
  if (!item || !(await hasPermission(item.permission))) return {};
  const t = await getTranslations('common.admin.nav');
  return { title: t(item.key) };
}

/** Rubriques d'administration prévues : visibles avec la bonne permission, construites plus tard. */
export default async function AdminUpcomingPage({ params }: { params: Params }) {
  const item = findSection((await params).section);
  if (!item) notFound();
  await requirePermission(item.permission);
  const t = await getTranslations('common');
  const description =
    item.phase === 'next' || item.phase === null
      ? t('admin.soonNext')
      : t(`app.soon.phase${item.phase}`);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg">
        {t(`admin.nav.${item.key}`)}
      </h1>
      <EmptyState
        icon={item.icon}
        title={t('app.soon.title')}
        description={description}
        className="bg-surface py-16"
        action={
          <ButtonLink href="/admin" variant="secondary" icon={LayoutDashboard}>
            {t('admin.nav.overview')}
          </ButtonLink>
        }
      />
    </div>
  );
}
