import { PERMISSIONS } from '@opportinities/shared';
import { Globe2 } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { SegmentedLinks } from '@/features/admin/segmented-links';
import { CategoryManager } from '@/features/catalog/category-manager';
import { CountryManager } from '@/features/catalog/country-manager';
import { getAdminCatalog } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.SETTINGS_MANAGE))) return {};
  const t = await getTranslations('common.admin.nav');
  return { title: t('catalog') };
}

/** Catégories d'offres et pays proposés par la plateforme. */
export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const tab = (await searchParams).tab === 'countries' ? 'countries' : 'categories';
  const [t, tErrors, catalog] = await Promise.all([
    getTranslations('common.admin'),
    getTranslations('errors'),
    getAdminCatalog(),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          <Globe2 className="size-6 text-brand" aria-hidden="true" />
          {t('nav.catalog')}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{t('catalog.intro')}</p>
      </div>
      <div>
        <SegmentedLinks
          label={t('nav.catalog')}
          current={tab}
          options={[
            { value: 'categories', label: t('catalog.categories'), href: '/admin/catalog' },
            {
              value: 'countries',
              label: t('catalog.countries'),
              href: '/admin/catalog?tab=countries',
            },
          ]}
        />
      </div>
      {catalog === null ? (
        <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>
      ) : tab === 'categories' ? (
        <CategoryManager initial={catalog.categories} />
      ) : (
        <CountryManager initial={catalog.countries} />
      )}
    </div>
  );
}
