import { type CareerExportRenderData, type CountryResponse } from '@opportinities/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { studioLabels } from '@/features/studio/cv-labels';
import { documentCountry, StudioDocument } from '@/features/studio/document-view';
import { A4_WIDTH } from '@/features/studio/templates';
import { getCountries } from '@/lib/api/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
const UUID = /^[0-9a-f-]{36}$/i;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
};

/** Instantané de l'export, lu avec le jeton signé transmis par l'API (aucune session). */
async function renderData(id: string, token: string): Promise<CareerExportRenderData | null> {
  const response = await fetch(
    `${API_INTERNAL_URL}/api/v1/internal/career-exports/${id}/render-data?token=${encodeURIComponent(token)}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  ).catch(() => null);
  if (!response?.ok) return null;
  return (await response.json()) as CareerExportRenderData;
}

/**
 * Page d'impression d'un export PDF, ouverte uniquement par le Chromium de l'API. Elle affiche
 * le modèle à la taille A4 réelle, sans habillage du site, puis signale qu'elle est prête.
 */
export default async function CareerExportPrintPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!UUID.test(id) || !token) notFound();
  const data = await renderData(id, token);
  if (!data) notFound();

  const [labels, countries] = await Promise.all([
    studioLabels(data.language),
    getCountries().catch((): CountryResponse[] => []),
  ]);
  const countryIso2 = documentCountry(data.type, data.content);
  const country = countries.find((entry) => entry.iso2 === countryIso2);

  return (
    <>
      <style>{`@page { size: A4; margin: 0; }
html, body { background: #ffffff !important; color-scheme: light; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>
      <main
        data-print-ready="true"
        lang={data.language}
        className="bg-white"
        style={{ width: A4_WIDTH }}
      >
        <StudioDocument
          type={data.type}
          language={data.language}
          templateKey={data.templateKey}
          content={data.content}
          labels={labels}
          countryName={country ? (data.language === 'fr' ? country.nameFr : country.nameEn) : ''}
        />
      </main>
    </>
  );
}
