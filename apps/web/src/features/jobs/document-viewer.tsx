'use client';

import { type DocumentPagesResponse, type UnlockedFile } from '@opportinities/shared';
import { Eye, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { API_BASE, api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/**
 * Consultation des documents dans le site : les pages arrivent en images rendues par le serveur,
 * avec la mention « Publiée par … sur Umoja Jobs » incrustée. Aucun bouton ni lien de
 * téléchargement ; le fichier d'origine n'est jamais transmis au navigateur.
 */
export function DocumentViewer({
  jobOfferId,
  files,
}: {
  jobOfferId: string;
  files: UnlockedFile[];
}) {
  const t = useTranslations('jobs.unlock');
  const { fromApiError } = useFormErrors();
  const [open, setOpen] = useState<{ file: UnlockedFile; pages: number } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function view(file: UnlockedFile) {
    setLoading(file.id);
    try {
      const result = await api.get<DocumentPagesResponse>(
        `/me/unlocks/${jobOfferId}/files/${file.id}`,
      );
      setOpen({ file, pages: result.pageCount });
    } catch (error) {
      toast.error(fromApiError(error).message);
    } finally {
      setLoading(null);
    }
  }

  const title = (file: UnlockedFile) =>
    file.kind === 'original' ? t('original') : t('attachment');

  return (
    <>
      <ul className="grid gap-2 border-t border-line pt-4">
        {files.map((file) => (
          <li key={file.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-fg">
              <FileText className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
              <span className="truncate">{title(file)}</span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={Eye}
              loading={loading === file.id}
              onClick={() => view(file)}
            >
              {t('view')}
            </Button>
          </li>
        ))}
      </ul>
      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? title(open.file) : ''}
        description={t('viewerNote')}
        size="lg"
      >
        {open && (
          <div
            className="-mx-1 grid max-h-[70vh] gap-3 overflow-y-auto px-1 select-none"
            onContextMenu={(event) => event.preventDefault()}
          >
            {Array.from({ length: open.pages }, (_, index) => (
              <DocumentPage
                key={index}
                src={`${API_BASE}/me/unlocks/${jobOfferId}/files/${open.file.id}/pages/${index + 1}`}
                alt={t('page', { page: index + 1, pages: open.pages })}
              />
            ))}
          </div>
        )}
      </Dialog>
    </>
  );
}

function DocumentPage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative min-h-40 overflow-hidden rounded-md border border-line bg-white">
      {!loaded && (
        <div className="absolute inset-0 grid place-items-center">
          <Spinner />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, non optimisable */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className="pointer-events-none block h-auto w-full"
      />
    </div>
  );
}
