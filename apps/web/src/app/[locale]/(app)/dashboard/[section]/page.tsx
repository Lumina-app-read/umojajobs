import { LayoutDashboard } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { type AppNavItem, UPCOMING_SECTIONS } from '@/features/app-shell/app-nav';

type Params = Promise<{ section: string }>;

function findSection(section: string): AppNavItem | undefined {
  return UPCOMING_SECTIONS.find((item) => item.href === `/dashboard/${section}`);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const item = findSection((await params).section);
  if (!item) return {};
  const t = await getTranslations('common.app.nav');
  return { title: t(item.key) };
}

/**
 * Rubriques prévues mais pas encore construites : la navigation est complète dès maintenant,
 * chaque rubrique annonce honnêtement le module qui la rendra fonctionnelle.
 */
export default async function UpcomingSectionPage({ params }: { params: Params }) {
  const item = findSection((await params).section);
  if (!item || item.phase === null) notFound();
  const t = await getTranslations('common.app');

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg">{t(`nav.${item.key}`)}</h1>
      <EmptyState
        icon={item.icon}
        title={t('soon.title')}
        description={t(`soon.phase${item.phase}`)}
        className="bg-surface py-16"
        action={
          <ButtonLink href="/dashboard" variant="secondary" icon={LayoutDashboard}>
            {t('soon.back')}
          </ButtonLink>
        }
      />
    </div>
  );
}
