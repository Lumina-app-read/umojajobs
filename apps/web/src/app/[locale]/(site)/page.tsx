import { Hero } from '@/features/landing/hero';
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
export default function HomePage() {
  return (
    <>
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
