'use client';

import {
  AI_LIMITS,
  type AiImproveInput,
  type AiImproveTarget,
  ERROR_CODES,
} from '@opportinities/shared';
import { Check, Coins, ShieldCheck, Sparkles, WandSparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { FieldError, FieldHint } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/errors';
import { useFormErrors } from '@/lib/use-form-errors';
import { GenerationLostError, runAiOperation, useStudioAi } from './ai-context';

/**
 * Amélioration d'un texte existant par l'IA (mode B), payée en crédits : le prix figure sur le
 * bouton, le montant est fixé par le serveur. La suggestion s'affiche à côté du texte d'origine
 * et n'est appliquée que si l'utilisateur la choisit. Un échec est remboursé automatiquement.
 */
export function AiAssist({
  documentId,
  target,
  text,
  context,
  onApply,
}: {
  documentId: string;
  target: AiImproveTarget;
  text: string;
  context?: AiImproveInput['context'];
  onApply: (suggestion: string) => void;
}) {
  const t = useTranslations('studio.editor.ai');
  const tGeneration = useTranslations('studio.generation');
  const { fromApiError } = useFormErrors();
  const { prices, setBalance } = useStudioAi();
  const [pending, setPending] = useState(false);
  const [suggestion, setSuggestion] = useState<{ text: string; charged: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);
  const tooShort = text.trim().length < AI_LIMITS.textMin;
  const price = prices?.improve ?? null;

  async function request() {
    setPending(true);
    setError(null);
    setInsufficient(false);
    setSuggestion(null);
    try {
      const input: Omit<AiImproveInput, 'idempotencyKey'> = { target, text: text.trim() };
      if (context?.title || context?.organization) {
        input.context = {
          title: context.title?.trim().slice(0, AI_LIMITS.contextMax) || undefined,
          organization: context.organization?.trim().slice(0, AI_LIMITS.contextMax) || undefined,
        };
      }
      // Clé unique par opération ; après une coupure, l'état est vérifié avant toute relance.
      const result = await runAiOperation(documentId, 'improve', { ...input });
      setBalance(result.balance);
      if (result.status === 'succeeded' && result.result?.kind === 'text') {
        setSuggestion({
          text: result.result.text,
          charged: t('charged', { count: result.credits, balance: result.balance }),
        });
      } else {
        setError(t('refunded'));
      }
    } catch (caught) {
      if (caught instanceof GenerationLostError) {
        setError(tGeneration('lost'));
      } else if (caught instanceof ApiError && caught.code === ERROR_CODES.INSUFFICIENT_CREDITS) {
        setInsufficient(true);
      } else {
        setError(fromApiError(caught).message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={WandSparkles}
          loading={pending}
          loadingLabel={t('improving')}
          disabled={tooShort || price === null}
          onClick={request}
        >
          {t('improve')}
          {price !== null && (
            <span className="ml-1.5 font-normal text-fg-subtle">
              · {t('price', { count: price })}
            </span>
          )}
        </Button>
        {tooShort && !suggestion && (
          <FieldHint>{t('tooShort', { min: AI_LIMITS.textMin })}</FieldHint>
        )}
      </div>
      {insufficient && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-warning">
          <span>{t('insufficient', { balance: prices?.balance ?? 0 })}</span>
          <ButtonLink href="/dashboard/credits" size="sm" variant="ghost" icon={Coins}>
            {t('topUp')}
          </ButtonLink>
        </div>
      )}
      {error && <FieldError>{error}</FieldError>}

      {suggestion && (
        <div
          role="region"
          aria-label={t('title')}
          className="animate-fade-up rounded-lg border border-primary/30 bg-primary-soft/40 p-3.5"
        >
          <p className="flex items-center gap-1.5 text-sm sm:text-[13px] font-semibold text-brand">
            <Sparkles className="size-4" aria-hidden="true" />
            {t('title')}
          </p>
          <p className="mt-2 text-sm leading-6 whitespace-pre-line text-fg">{suggestion.text}</p>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-fg-muted">
            <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {t('review')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              icon={Check}
              onClick={() => {
                onApply(suggestion.text);
                setSuggestion(null);
                toast.success(t('applied'));
              }}
            >
              {t('replace')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={X}
              onClick={() => setSuggestion(null)}
            >
              {t('dismiss')}
            </Button>
            <span className="text-xs text-fg-subtle sm:ml-auto">{suggestion.charged}</span>
          </div>
        </div>
      )}
      {!suggestion && !error && !insufficient && !tooShort && <FieldHint>{t('privacy')}</FieldHint>}
    </div>
  );
}
