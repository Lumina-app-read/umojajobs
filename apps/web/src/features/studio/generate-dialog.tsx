'use client';

import { type CareerDocumentContent, ERROR_CODES } from '@opportinities/shared';
import { Coins, Sparkles, Wallet, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Dialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api/errors';
import { useFormErrors } from '@/lib/use-form-errors';
import { GenerationLostError, runAiOperation, useStudioAi } from './ai-context';

/**
 * Génération complète d'un document par l'IA. Avant tout appel : prix (fixé par le serveur),
 * solde, et avertissement si un texte existant sera remplacé. Aucun paiement Chariow n'est
 * déclenché ici : un solde insuffisant renvoie vers la page de recharge.
 */
export function GenerateDialog({
  documentId,
  label,
  overwrite,
  disabled,
  onGenerated,
}: {
  documentId: string;
  /** Libellé du bouton, par exemple « Générer ma lettre ». */
  label: string;
  /** Un texte existe déjà : il sera remplacé (annulable). */
  overwrite: boolean;
  disabled: boolean;
  onGenerated: (content: CareerDocumentContent) => void;
}) {
  const t = useTranslations('studio.generation');
  const { fromApiError } = useFormErrors();
  const { prices, setBalance, saved, options } = useStudioAi();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = prices?.generate ?? null;
  const balance = prices?.balance ?? 0;
  const insufficient = price !== null && balance < price;

  async function generate() {
    setPending(true);
    setChecking(false);
    setError(null);
    try {
      const result = await runAiOperation(documentId, 'generate', { options }, () =>
        setChecking(true),
      );
      setBalance(result.balance);
      if (result.status === 'succeeded' && result.result?.kind === 'document') {
        onGenerated(result.result.content);
        setOpen(false);
      } else {
        setError(t('failed'));
      }
    } catch (caught) {
      if (caught instanceof GenerationLostError) setError(t('lost'));
      else if (caught instanceof ApiError && caught.code === ERROR_CODES.INSUFFICIENT_CREDITS) {
        setError(t('insufficient'));
      } else setError(fromApiError(caught).message);
    } finally {
      setPending(false);
      setChecking(false);
    }
  }

  return (
    <>
      <Button
        size="lg"
        icon={Sparkles}
        disabled={disabled || price === null}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {label}
        {price !== null && (
          <span className="ml-1.5 font-normal opacity-80">· {t('price', { count: price })}</span>
        )}
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t('title')}
        footer={
          pending ? undefined : (
            <>
              <Button variant="secondary" icon={X} onClick={() => setOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                icon={Sparkles}
                disabled={price === null || insufficient || !saved}
                onClick={generate}
              >
                {t('confirm', { count: price ?? 0 })}
              </Button>
            </>
          )
        }
      >
        {pending ? (
          <div className="grid justify-items-center gap-3 py-6 text-center" role="status">
            <Spinner className="size-7 text-brand" />
            <p className="font-semibold text-fg">{checking ? t('checking') : t('working')}</p>
            <p className="max-w-sm text-sm sm:text-[13px]">{t('workingHint')}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {price === null ? (
              <Alert tone="warning">{t('priceMissing')}</Alert>
            ) : (
              <div className="grid gap-2 rounded-lg border border-line bg-surface-2/50 p-3.5">
                <p className="flex items-center gap-2 font-semibold text-fg">
                  <Coins className="size-4 text-brand" aria-hidden="true" />
                  {t('cost', { count: price })}
                </p>
                <p className="flex items-center gap-2">
                  <Wallet className="size-4 text-fg-subtle" aria-hidden="true" />
                  {t('balance', { count: balance })}
                </p>
              </div>
            )}
            {overwrite && <p className="text-sm sm:text-[13px]">{t('overwrite')}</p>}
            {insufficient && (
              <Alert tone="warning">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>{t('insufficient')}</span>
                  <ButtonLink href="/dashboard/credits" size="sm" variant="secondary" icon={Coins}>
                    {t('topUp')}
                  </ButtonLink>
                </div>
              </Alert>
            )}
            {!saved && <p className="text-sm sm:text-[13px] text-warning">{t('waitSave')}</p>}
            {error && <Alert tone="error">{error}</Alert>}
          </div>
        )}
      </Dialog>
    </>
  );
}
