'use client';

import {
  EDITABLE_JOB_STATUSES,
  type FileDownloadResponse,
  JOB_LIMITS,
  type JobFileKind,
  type JobOfferResponse,
} from '@opportinities/shared';
import { Download, FilePlus2, FileText, Paperclip, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { api, apiUpload } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/**
 * Documents privés de l'offre : annonce originale et compléments (PDF). Le téléchargement passe
 * par un lien signé de courte durée, demandé au moment du clic.
 */
export function OfferDocuments({
  offer,
  onChange,
}: {
  offer: JobOfferResponse;
  onChange: (offer: JobOfferResponse) => void;
}) {
  const t = useTranslations('jobs.form.upload');
  const format = useFormatter();
  const { fromApiError } = useFormErrors();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<JobFileKind>('original');
  const [busy, setBusy] = useState<string | null>(null);

  const editable = EDITABLE_JOB_STATUSES.includes(offer.status);
  const hasOriginal = offer.files.some((file) => file.kind === 'original');
  const attachments = offer.files.filter((file) => file.kind === 'attachment').length;

  function pick(target: JobFileKind) {
    setKind(target);
    input.current?.click();
  }

  async function upload(file: File) {
    setBusy('upload');
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      onChange(await apiUpload<JobOfferResponse>(`/me/job-offers/${offer.id}/files`, form));
      toast.success(t('done'));
    } catch (error) {
      toast.error(fromApiError(error).message);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function remove(fileId: string) {
    setBusy(fileId);
    try {
      onChange(await api.delete<JobOfferResponse>(`/me/job-offers/${offer.id}/files/${fileId}`));
      toast.success(t('removed'));
    } catch (error) {
      toast.error(fromApiError(error).message);
    } finally {
      setBusy(null);
    }
  }

  async function download(fileId: string) {
    try {
      const link = await api.post<FileDownloadResponse>(
        `/me/job-offers/${offer.id}/files/${fileId}/download`,
      );
      window.location.assign(link.url);
    } catch (error) {
      toast.error(fromApiError(error).message);
    }
  }

  return (
    <div className="grid gap-4">
      {offer.files.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {offer.files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-3.5 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
                {file.kind === 'original' ? (
                  <FileText className="size-[18px]" aria-hidden="true" />
                ) : (
                  <Paperclip className="size-[18px]" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{file.originalName}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-fg-muted">
                  <Badge tone={file.kind === 'original' ? 'primary' : 'neutral'}>
                    {file.kind === 'original' ? t('originalLabel') : t('attachmentLabel')}
                  </Badge>
                  {t('size', {
                    size: format.number(file.sizeBytes / 1024 / 1024, { maximumFractionDigits: 1 }),
                  })}
                </p>
              </div>
              <IconButton
                icon={Download}
                label={file.originalName}
                onClick={() => download(file.id)}
              />
              {editable && (
                <IconButton
                  icon={Trash2}
                  label={t('remove')}
                  loading={busy === file.id}
                  onClick={() => remove(file.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="flex flex-wrap gap-2">
          {!hasOriginal && (
            <Button
              variant="secondary"
              icon={FileText}
              onClick={() => pick('original')}
              loading={busy === 'upload' && kind === 'original'}
              loadingLabel={t('uploading')}
            >
              {t('original')}
            </Button>
          )}
          {attachments < JOB_LIMITS.attachmentsMax && (
            <Button
              variant="secondary"
              icon={FilePlus2}
              onClick={() => pick('attachment')}
              loading={busy === 'upload' && kind === 'attachment'}
              loadingLabel={t('uploading')}
            >
              {t('attachment')}
            </Button>
          )}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
