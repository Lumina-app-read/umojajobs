'use client';

import { CANDIDATE_TERMS_VERSION } from '@opportinities/shared';
import {
  BadgeCheck,
  Coins,
  Handshake,
  type LucideIcon,
  PartyPopper,
  ShieldAlert,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

const RULES: {
  key: 'gateway' | 'noGuarantee' | 'credits' | 'noFees' | 'direct';
  icon: LucideIcon;
}[] = [
  { key: 'gateway', icon: Handshake },
  { key: 'noGuarantee', icon: UserRoundCheck },
  { key: 'credits', icon: Coins },
  { key: 'noFees', icon: ShieldAlert },
  { key: 'direct', icon: BadgeCheck },
];

/** Liste du règlement des candidats (réutilisée en rappel une fois accepté). */
export function CandidateRulesList({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('jobs.candidateRules');
  return (
    <ul className={compact ? 'grid gap-2' : 'grid gap-3'}>
      {RULES.map(({ key, icon: Icon }) => (
        <li
          key={key}
          className="flex items-start gap-2.5 text-sm sm:text-[13px] leading-relaxed text-fg-muted"
        >
          <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
          <span>{t(`items.${key}`)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Présenté juste après le paiement (jamais avant, pour ne pas freiner l'engagement) :
 * félicitations, puis règlement des candidats à accepter pour accéder aux coordonnées.
 */
export function CandidateRulesGate() {
  const t = useTranslations('jobs.candidateRules');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [accepted, setAccepted] = useState(false);
  const [showRequired, setShowRequired] = useState(false);
  const [busy, setBusy] = useState(false);

  async function accept() {
    if (!accepted) {
      setShowRequired(true);
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/me/candidate-terms', { version: CANDIDATE_TERMS_VERSION });
      toast.success(t('acceptedToast'));
      router.refresh();
    } catch (error) {
      toast.error(fromApiError(error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3 rounded-lg bg-success-soft p-3.5">
        <PartyPopper className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-fg">{t('congratsTitle')}</p>
          <p className="mt-0.5 text-sm sm:text-[13px] text-fg-muted">{t('congratsBody')}</p>
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-semibold text-fg">{t('title')}</p>
        <CandidateRulesList />
      </div>
      <Checkbox
        name="candidateRules"
        checked={accepted}
        onChange={(event) => setAccepted(event.target.checked)}
        label={t('accept')}
        error={showRequired && !accepted ? t('required') : null}
      />
      <Button icon={Sparkles} loading={busy} fullWidth onClick={accept}>
        {t('continue')}
      </Button>
    </div>
  );
}
