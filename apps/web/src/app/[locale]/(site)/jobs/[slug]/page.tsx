import { type ContractType, type PublicJobOfferDetail } from '@opportinities/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JobDetailView } from '@/features/jobs/job-detail-view';
import { getPublicJob } from '@/lib/api/server';
import { redirectSignedIn } from '@/lib/auth-guard';
import { isJobSlug } from '@/features/jobs/routes';
import { jsonLd, publicPageMetadata, SITE_URL } from '@/lib/seo';

type Params = Promise<{ slug: string; locale: string }>;
async function load(slug: string): Promise<PublicJobOfferDetail | null> {
  return isJobSlug(slug) ? getPublicJob(slug) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, locale } = await params;
  const offer = await load(slug);
  if (!offer) return {};
  const title = `${offer.title} · ${offer.companyName}`;
  const description = offer.description.replace(/\s+/g, ' ').slice(0, 160);
  return {
    ...publicPageMetadata({
      locale,
      path: `/jobs/${offer.slug}`,
      title,
      description,
      type: 'article',
    }),
    // Une offre expirée reste consultable mais ne doit plus être mise en avant par les moteurs.
    robots: offer.status === 'expired' ? { index: false, follow: true } : undefined,
  };
}

/** Correspondance avec le vocabulaire schema.org (JobPosting.employmentType). */
const EMPLOYMENT_TYPE: Record<ContractType, string> = {
  permanent: 'FULL_TIME',
  fixed_term: 'TEMPORARY',
  internship: 'INTERN',
  apprenticeship: 'INTERN',
  freelance: 'CONTRACTOR',
  consultancy: 'CONTRACTOR',
  temporary: 'TEMPORARY',
  volunteer: 'VOLUNTEER',
  other: 'OTHER',
};

/** Données structurées JobPosting, uniquement pour une offre active (jamais pour une expirée). */
function jobPostingJsonLd(offer: PublicJobOfferDetail, locale: string): string | null {
  // Double garde : jamais de JobPosting pour une offre expirée, même avant le passage planifié.
  if (offer.status !== 'active' || new Date(offer.endsAt) <= new Date()) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: offer.title,
    description: offer.description,
    datePosted: offer.publishedAt,
    validThrough: offer.endsAt,
    url: `${SITE_URL}/${locale}/jobs/${offer.slug}`,
    identifier: { '@type': 'PropertyValue', name: 'Umoja Jobs', value: offer.slug },
    // Candidature auprès de l'employeur, après déverrouillage : pas de candidature directe ici.
    directApply: false,
    employmentType: EMPLOYMENT_TYPE[offer.contractType],
    hiringOrganization: { '@type': 'Organization', name: offer.companyName },
    ...(offer.workMode === 'remote' ? { jobLocationType: 'TELECOMMUTE' } : {}),
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressCountry: offer.countryIso2,
        ...(offer.city ? { addressLocality: offer.city.name } : {}),
      },
    },
    ...(offer.salaryCurrency && (offer.salaryMin || offer.salaryMax)
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: offer.salaryCurrency,
            value: {
              '@type': 'QuantitativeValue',
              ...(offer.salaryMin ? { minValue: Number(offer.salaryMin) } : {}),
              ...(offer.salaryMax ? { maxValue: Number(offer.salaryMax) } : {}),
              ...(offer.salaryPeriod ? { unitText: offer.salaryPeriod.toUpperCase() } : {}),
            },
          },
        }
      : {}),
  };
  return jsonLd(data);
}

/** Fiche publique (visiteurs) : un utilisateur connecté consulte l'offre dans son espace. */
export default async function JobDetailPage({ params }: { params: Params }) {
  const { slug, locale } = await params;
  if (!isJobSlug(slug)) notFound();
  await redirectSignedIn(`/dashboard/jobs/${slug}`);
  const offer = await load(slug);
  if (!offer) notFound();
  const structured = jobPostingJsonLd(offer, locale);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      {structured && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structured }} />
      )}
      <JobDetailView offer={offer} base="/jobs" />
    </div>
  );
}
