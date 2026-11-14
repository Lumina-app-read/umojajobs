'use client';

import { PHOTO_LIMITS } from '@opportinities/shared';
import { ImagePlus, RefreshCw, Trash2, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, FieldHint } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { api, API_BASE, apiUpload } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/** Adresse privée de la photo (réservée au propriétaire), avec sa version pour le cache. */
export const photoUrl = (documentId: string, version: string) =>
  `${API_BASE}/me/career-documents/${documentId}/photo?v=${version}`;

/**
 * Photo facultative du CV. Le serveur la recadre, la ré-encode et la stocke en privé ; elle n'est
 * jamais envoyée à l'IA et n'apparaît que dans les modèles qui prévoient une photo.
 */
export function PhotoField({
  documentId,
  version,
  onChange,
}: {
  documentId: string;
  version: string | null;
  onChange: (version: string | null) => void;
}) {
  const t = useTranslations('studio.photo');
  const { fromApiError } = useFormErrors();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await apiUpload<{ version: string }>(
        `/me/career-documents/${documentId}/photo`,
        form,
      );
      onChange(result.version);
      toast.success(t('saved'));
    } catch (caught) {
      setError(fromApiError(caught).message);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await api.delete(`/me/career-documents/${documentId}/photo`);
      onChange(null);
      toast.success(t('removed'));
    } catch (caught) {
      setError(fromApiError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm sm:text-[13px] font-semibold text-fg">
        {t('label')} <span className="font-normal text-fg-subtle">{t('optional')}</span>
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {version ? (
          // eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API
          <img
            src={photoUrl(documentId, version)}
            alt={t('alt')}
            className="size-16 rounded-full object-cover ring-1 ring-line"
          />
        ) : (
          <span className="grid size-16 place-items-center rounded-full bg-surface-2 text-fg-subtle">
            <UserRound className="size-7" aria-hidden="true" />
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={version ? RefreshCw : ImagePlus}
            loading={pending}
            loadingLabel={t('uploading')}
            onClick={() => input.current?.click()}
          >
            {version ? t('replace') : t('add')}
          </Button>
          {version && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={Trash2}
              disabled={pending}
              onClick={() => void remove()}
            >
              {t('remove')}
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={PHOTO_LIMITS.types.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => void upload(event)}
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : <FieldHint>{t('hint')}</FieldHint>}
    </div>
  );
}
