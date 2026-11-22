import { type CareerExportDownloadResponse } from '@opportinities/shared';
import { api } from '@/lib/api/client';

/** Lance le téléchargement du PDF (lien signé de courte durée, servi en pièce jointe). */
export async function startDownload(exportId: string): Promise<void> {
  const { url } = await api.get<CareerExportDownloadResponse>(
    `/me/career-exports/${exportId}/download`,
  );
  window.location.assign(url);
}
