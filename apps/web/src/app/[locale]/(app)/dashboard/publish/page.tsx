import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { ContributorTermsGate } from '@/features/publish/contributor-terms';
import { JobOfferForm } from '@/features/publish/job-offer-form';
import { getCountries, getJobCategories } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.form');
  return { title: t('newTitle') };
}

/**
 * Publier une offre : les conditions de publication sont lues et acceptées une première fois
 * (acceptation enregistrée sur le compte), puis le formulaire s'ouvre.
 */
export default async function PublishPage() {
  const user = await requireUser();
  if (!user.contributorTermsAccepted) return <ContributorTermsGate />;

  const [countries, categories, locale, tErrors] = await Promise.all([
    getCountries().catch(() => null),
    getJobCategories(),
    getLocale(),
    getTranslations('errors'),
  ]);
  if (!countries || categories.length === 0) {
    return <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>;
  }
  return (
    <JobOfferForm offer={null} categories={categories} countries={countries} locale={locale} />
  );
}
