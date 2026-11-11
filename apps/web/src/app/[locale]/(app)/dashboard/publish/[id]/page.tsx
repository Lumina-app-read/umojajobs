import { EDITABLE_JOB_STATUSES } from '@opportinities/shared';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { ContributorTermsGate } from '@/features/publish/contributor-terms';
import { JobOfferForm } from '@/features/publish/job-offer-form';
import { redirect } from '@/i18n/navigation';
import { getCountries, getJobCategories, getMyJobOffer } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.form');
  return { title: t('editTitle') };
}

const UUID = /^[0-9a-f-]{36}$/i;

/** Reprise d'un brouillon ou d'une offre dont la modération demande une correction. */
export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user.contributorTermsAccepted) return <ContributorTermsGate />;
  const { id } = await params;
  const locale = await getLocale();

  const [offer, countries, categories, tErrors] = await Promise.all([
    UUID.test(id) ? getMyJobOffer(id) : Promise.resolve(null),
    getCountries().catch(() => null),
    getJobCategories(),
    getTranslations('errors'),
  ]);
  if (!offer) notFound();
  // Une offre soumise ou publiée ne se modifie plus : retour à la liste des publications.
  if (!EDITABLE_JOB_STATUSES.includes(offer.status)) {
    return redirect({ href: '/dashboard/publications', locale });
  }
  if (!countries || categories.length === 0) {
    return <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>;
  }
  return (
    <JobOfferForm offer={offer} categories={categories} countries={countries} locale={locale} />
  );
}
