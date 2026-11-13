'use client';

import {
  AI_LIMITS,
  type AiImproveInput,
  type AiImproveTarget,
  type AiSuggestionResponse,
} from '@opportinities/shared';
import { Check, ShieldCheck, Sparkles, WandSparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, FieldHint } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/**
 * Reformulation d'un texte par l'IA. La suggestion s'affiche à côté du texte d'origine et n'est
 * appliquée que si l'utilisateur la choisit. Rien n'est envoyé sans clic explicite.
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
  const { fromApiError } = useFormErrors();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AiSuggestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tooShort = text.trim().length < AI_LIMITS.textMin;

  async function request() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const input: AiImproveInput = { target, text: text.trim() };
      if (context?.title || context?.organization) {
        input.context = {
          title: context.title?.trim().slice(0, AI_LIMITS.contextMax) || undefined,
          organization: context.organization?.trim().slice(0, AI_LIMITS.contextMax) || undefined,
        };
      }
      setResult(
        await api.post<AiSuggestionResponse>(
          `/me/career-documents/${documentId}/ai/improve`,
          input,
        ),
      );
    } catch (caught) {
      setError(fromApiError(caught).message);
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
          disabled={tooShort}
          onClick={request}
        >
          {t('improve')}
        </Button>
        {tooShort && !result && <FieldHint>{t('tooShort', { min: AI_LIMITS.textMin })}</FieldHint>}
      </div>
      {error && <FieldError>{error}</FieldError>}

      {result && (
        <div
          role="region"
          aria-label={t('title')}
          className="animate-fade-up rounded-lg border border-primary/30 bg-primary-soft/40 p-3.5"
        >
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-brand">
            <Sparkles className="size-4" aria-hidden="true" />
            {t('title')}
          </p>
          <p className="mt-2 text-sm leading-6 whitespace-pre-line text-fg">{result.suggestion}</p>
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
                onApply(result.suggestion);
                setResult(null);
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
              onClick={() => setResult(null)}
            >
              {t('dismiss')}
            </Button>
            <span className="text-xs text-fg-subtle sm:ml-auto">
              {t('remaining', { count: result.remaining })}
            </span>
          </div>
        </div>
      )}
      {!result && !error && !tooShort && <FieldHint>{t('privacy')}</FieldHint>}
    </div>
  );
}
