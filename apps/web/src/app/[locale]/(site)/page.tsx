import { APP_NAME } from '@opportinities/shared';
import { Hero } from '@/features/landing/hero';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { jsonLd, publicPageMetadata, SITE_URL } from '@/lib/seo';
import {
  Faq,
  FinalCta,
  HowItWorks,
  JobsSection,
  ShareSection,
  StudioSection,
  TrustBand,
} from '@/features/landing/sections';

/**
 * Page d'accueil (étape D4). Objectif : faire créer un compte. Les identifiants des sections
 * (`jobs`, `share`, `career-studio`, `how-it-works`) sont ceux de la navigation (`nav-items.ts`).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('common.meta');
  const metadata = publicPageMetadata({
    locale,
    path: '/',
    title: `${APP_NAME} · ${t('tagline')}`,
    description: t('description'),
  });
  // Titre complet : le modèle « … · Umoja Jobs » ne s'applique pas à l'accueil.
  return { ...metadata, title: { absolute: metadata.title } };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const structured = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: APP_NAME,
    url: `${SITE_URL}/${locale}`,
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/${locale}/jobs?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structured }} />
      <Hero />
      <TrustBand />
      <HowItWorks />
      <JobsSection />
      <StudioSection />
      <ShareSection />
      <Faq />
      <FinalCta />
    </>
  );
}
