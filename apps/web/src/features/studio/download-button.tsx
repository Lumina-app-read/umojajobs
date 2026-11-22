'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useFormErrors } from '@/lib/use-form-errors';
import { startDownload } from './export-download';

/** Téléchargement d'un PDF déjà exporté. */
export function ExportDownloadButton({ exportId, title }: { exportId: string; title: string }) {
  const t = useTranslations('studio.export');
  const { fromApiError } = useFormErrors();
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      await startDownload(exportId);
    } catch (caught) {
      toast.error(fromApiError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="secondary"
      icon={Download}
      loading={pending}
      onClick={() => void download()}
      aria-label={`${t('download')} : ${title}`}
    >
      {t('download')}
    </Button>
  );
}
