'use client';

import {
  type FileDownloadResponse,
  JOB_LIMITS,
  type JobOfferStatus,
  type ModerationJobOfferResponse,
} from '@opportinities/shared';
import {
  Ban,
  BadgeCheck,
  Download,
  MessageSquareWarning,
  PauseCircle,
  ScrollText,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/form-controls';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

type Action = 'approve' | 'request-correction' | 'reject' | 'suspend';

/** Décisions possibles selon le statut (mêmes règles que l'API, qui reste seule juge). */
const ACTIONS: Partial<Record<JobOfferStatus, Action[]>> = {
  pending_review: ['approve', 'request-correction', 'reject'],
  scheduled: ['suspend'],
  active: ['suspend'],
};

/**
 * Panneau de décision : valider, demander une correction, refuser ou suspendre. Un motif d'au
 * moins dix caractères est exigé pour toute décision autre que la validation.
 */
export function DecisionPanel({
  offer,
  isOwnOffer,
}: {
  offer: ModerationJobOfferResponse;
  isOwnOffer: boolean;
}) {
  const t = useTranslations('jobs.moderation');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const actions = ACTIONS[offer.status] ?? [];

  async function decide(action: Action) {
    if (action !== 'approve' && reason.trim().length < JOB_LIMITS.reasonMin) {
      setReasonError(t('reasonRequired'));
      return;
    }
    setBusy(action);
    setError(null);
    try {
      await api.post(`/admin/job-offers/${offer.id}/${action}`, {
        version: offer.version,
        ...(action === 'approve' ? {} : { reason: reason.trim() }),
      });
      const done = {
        approve: t('approved'),
        'request-correction': t('corrected'),
        reject: t('rejected'),
        suspend: t('suspended'),
      }[action];
      toast.success(done);
      setReason('');
      router.refresh();
    } catch (failure) {
      setError(fromApiError(failure).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-xs">
      <div>
        <h2 className="text-base font-semibold text-fg">{t('decision')}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{t('decisionHint')}</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {isOwnOffer ? (
        <Alert tone="warning">{t('ownOffer')}</Alert>
      ) : actions.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noAction')}</p>
      ) : (
        <>
          {actions.some((action) => action !== 'approve') && (
            <TextAreaField
              label={t('reason')}
              name="reason"
              icon={ScrollText}
              placeholder={t('reasonPlaceholder')}
              rows={3}
              maxLength={JOB_LIMITS.reasonMax}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError(null);
              }}
              error={reasonError}
            />
          )}
          <div className="grid gap-2">
            {actions.includes('approve') && (
              <Button
                icon={BadgeCheck}
                loading={busy === 'approve'}
                disabled={busy !== null}
                onClick={() => decide('approve')}
              >
                {t('approve')}
              </Button>
            )}
            {actions.includes('request-correction') && (
              <Button
                variant="secondary"
                icon={MessageSquareWarning}
                loading={busy === 'request-correction'}
                disabled={busy !== null}
                onClick={() => decide('request-correction')}
              >
                {t('requestCorrection')}
              </Button>
            )}
            {actions.includes('reject') && (
              <Button
                variant="danger"
                icon={Ban}
                loading={busy === 'reject'}
                disabled={busy !== null}
                onClick={() => decide('reject')}
              >
                {t('reject')}
              </Button>
            )}
            {actions.includes('suspend') && (
              <Button
                variant="danger"
                icon={PauseCircle}
                loading={busy === 'suspend'}
                disabled={busy !== null}
                onClick={() => decide('suspend')}
              >
                {t('suspend')}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Téléchargement d'un document par la modération (lien signé, téléchargement journalisé). */
export function ModerationDownload({
  offerId,
  fileId,
  label,
}: {
  offerId: string;
  fileId: string;
  label: string;
}) {
  const { fromApiError } = useFormErrors();
  return (
    <IconButton
      icon={Download}
      label={label}
      onClick={async () => {
        try {
          const link = await api.post<FileDownloadResponse>(
            `/admin/job-offers/${offerId}/files/${fileId}/download`,
          );
          window.location.assign(link.url);
        } catch (error) {
          toast.error(fromApiError(error).message);
        }
      }}
    />
  );
}
