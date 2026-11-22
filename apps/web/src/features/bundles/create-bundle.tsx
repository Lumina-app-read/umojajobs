'use client';

import { BUNDLE_LIMITS, type BundleResponse } from '@opportinities/shared';
import { FileStack, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/** Nouveau dossier : un titre, puis l'ajout des fichiers. */
export function CreateBundleButton() {
  const t = useTranslations('bundles');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const created = await api.post<BundleResponse>('/me/document-bundles', {
        title: title.trim() || t('defaultTitle'),
      });
      router.push(`/dashboard/bundles/${created.id}`);
    } catch (caught) {
      setError(fromApiError(caught).message);
      setPending(false);
    }
  }

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>
        {t('create')}
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t('create')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" icon={X} disabled={pending} onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" form="bundle-create-form" icon={Plus} loading={pending}>
              {t('createSubmit')}
            </Button>
          </>
        }
      >
        <form id="bundle-create-form" onSubmit={submit}>
          <FormField
            label={t('name')}
            name="title"
            icon={FileStack}
            placeholder={t('namePlaceholder')}
            hint={t('nameHint')}
            maxLength={BUNDLE_LIMITS.titleMax}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={error}
            autoFocus
          />
        </form>
      </Dialog>
    </>
  );
}
