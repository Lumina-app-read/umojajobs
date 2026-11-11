'use client';

import { Bookmark, BookmarkCheck, LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/** Enregistrer une offre (ou la retirer). Un visiteur est invité à se connecter. */
export function SaveJobButton({
  offerId,
  initialSaved,
  signedIn,
}: {
  offerId: string;
  initialSaved: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations('jobs.public.detail');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <ButtonLink href="/login" variant="secondary" icon={LogIn} fullWidth>
        {t('loginToSave')}
      </ButtonLink>
    );
  }

  async function toggle() {
    setBusy(true);
    try {
      if (saved) {
        await api.delete(`/me/saved-jobs/${offerId}`);
        toast.success(t('removedToast'));
      } else {
        await api.put(`/me/saved-jobs/${offerId}`);
        toast.success(t('savedToast'));
      }
      setSaved(!saved);
      router.refresh();
    } catch (error) {
      toast.error(fromApiError(error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="secondary"
      fullWidth
      icon={saved ? BookmarkCheck : Bookmark}
      loading={busy}
      onClick={toggle}
      aria-pressed={saved}
    >
      {saved ? t('saved') : t('save')}
    </Button>
  );
}
