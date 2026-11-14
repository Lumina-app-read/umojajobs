'use client';

import { ERROR_CODES } from '@opportinities/shared';
import { Check, RefreshCw, Undo2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/errors';
import { useFormErrors } from '@/lib/use-form-errors';
import { GenerationLostError, runAiOperation, useStudioAi } from './ai-context';

/**
 * Régénération d'une seule section par l'IA. Le prix est affiché ; le texte actuel n'est remplacé
 * qu'après confirmation, et peut être restauré juste après.
 */
export function SectionRegenerate({
  documentId,
  section,
  current,
  onApply,
}: {
  documentId: string;
  /** Section côté serveur : « subject », « body », « summary », « experience:<id> »… */
  section: string;
  current: string;
  onApply: (text: string) => void;
}) {
  const t = useTranslations('studio.section');
  const tGeneration = useTranslations('studio.generation');
  const { fromApiError } = useFormErrors();
  const { prices, setBalance, saved, options } = useStudioAi();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [previous, setPrevious] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const price = prices?.section ?? null;

  async function regenerate() {
    setPending(true);
    setError(null);
    try {
      const result = await runAiOperation(documentId, 'sections', { section, options });
      setBalance(result.balance);
      if (result.status === 'succeeded' && result.result?.kind === 'section') {
        setPrevious(current);
        onApply(result.result.text);
        toast.success(t('done'), tGeneration('charged', { count: result.credits }));
      } else {
        setError(tGeneration('failed'));
      }
    } catch (caught) {
      if (caught instanceof GenerationLostError) setError(tGeneration('lost'));
      else if (caught instanceof ApiError && caught.code === ERROR_CODES.INSUFFICIENT_CREDITS) {
        setError(tGeneration('insufficient'));
      } else setError(fromApiError(caught).message);
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-sm sm:text-[13px] text-fg-muted">
              {t('confirm', { count: price ?? 0 })}
            </span>
            <Button type="button" size="sm" icon={Check} loading={pending} onClick={regenerate}>
              {t('yes')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={X}
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              {t('no')}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={RefreshCw}
            disabled={!saved || price === null || !current.trim()}
            onClick={() => setConfirming(true)}
          >
            {t('regenerate')}
            {price !== null && (
              <span className="ml-1.5 font-normal text-fg-subtle">
                · {tGeneration('price', { count: price })}
              </span>
            )}
          </Button>
        )}
        {previous !== null && !confirming && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={Undo2}
            onClick={() => {
              onApply(previous);
              setPrevious(null);
            }}
          >
            {t('undo')}
          </Button>
        )}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
