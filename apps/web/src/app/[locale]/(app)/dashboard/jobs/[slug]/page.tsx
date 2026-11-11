import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JobDetailView } from '@/features/jobs/job-detail-view';
import { isJobSlug } from '@/features/jobs/routes';
import { getPublicJob } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const offer = isJobSlug(slug) ? await getPublicJob(slug) : null;
  return offer ? { title: `${offer.title} · ${offer.companyName}` } : {};
}

/** Fiche d'une offre dans l'espace personnel : l'utilisateur peut l'enregistrer directement. */
export default async function DashboardJobPage({ params }: { params: Params }) {
  await requireUser();
  const { slug } = await params;
  const offer = isJobSlug(slug) ? await getPublicJob(slug) : null;
  if (!offer) notFound();
  return <JobDetailView offer={offer} base="/dashboard/jobs" />;
}
