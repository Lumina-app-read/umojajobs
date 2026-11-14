'use client';

import { CONTRIBUTOR_TERMS_VERSION } from '@opportinities/shared';
import {
  BadgeCheck,
  Ban,
  CalendarCheck,
  CopyCheck,
  FileLock2,
  Gavel,
  HandCoins,
  type LucideIcon,
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/form-field';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

const RULES: { key: string; icon: LucideIcon }[] = [
  { key: 'authentic', icon: BadgeCheck },
  { key: 'valid', icon: CalendarCheck },
  { key: 'accurate', icon: CopyCheck },
  { key: 'rights', icon: FileLock2 },
  { key: 'free', icon: Ban },
  { key: 'lawful', icon: Gavel },
  { key: 'moderation', icon: ShieldCheck },
  { key: 'commissions', icon: HandCoins },
  { key: 'sanctions', icon: ShieldAlert },
];

type RuleKey =
  | 'authentic'
  | 'valid'
  | 'accurate'
  | 'rights'
  | 'free'
  | 'lawful'
  | 'moderation'
  | 'commissions'
  | 'sanctions';

/** Liste des règles de publication (écran d'acceptation et fenêtre de relecture). */
export function ContributorRules() {
  const t = useTranslations('jobs.terms.rules');
  return (
    <ol className="stagger grid gap-3 sm:grid-cols-2">
      {RULES.map(({ key, icon: Icon }) => (
        <li key={key} className="flex gap-3 rounded-lg border border-line bg-canvas p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">{t(`${key as RuleKey}.title`)}</p>
            <p className="mt-1 text-sm sm:text-[13px] leading-relaxed text-fg-muted">
              {t(`${key as RuleKey}.body`)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function VersionLine() {
  const t = useTranslations('jobs.terms');
  const format = useFormatter();
  return (
    <p className="text-xs text-fg-subtle">
      {t('version', {
        date: format.dateTime(new Date(`${CONTRIBUTOR_TERMS_VERSION}T12:00:00Z`), {
          dateStyle: 'long',
        }),
      })}
    </p>
  );
}

/**
 * Écran préalable à toute publication : lecture des conditions, double engagement, puis
 * enregistrement de l'acceptation sur le compte (version, date, IP) avant d'ouvrir le formulaire.
 */
export function ContributorTermsGate() {
  const t = useTranslations('jobs.terms');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [certified, setCertified] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showRequired, setShowRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function accept() {
    if (!certified || !accepted) {
      setShowRequired(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/auth/me/contributor-terms', { version: CONTRIBUTOR_TERMS_VERSION });
      router.refresh();
    } catch (failure) {
      setError(fromApiError(failure).message);
      setSaving(false);
    }
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-brand">
          <ScrollText className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            {t('title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{t('intro')}</p>
          <div className="mt-2">
            <VersionLine />
          </div>
        </div>
      </div>

      <ContributorRules />

      <section className="grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-xs sm:p-6">
        {error && <Alert tone="error">{error}</Alert>}
        <Checkbox
          name="certify"
          checked={certified}
          onChange={(event) => setCertified(event.target.checked)}
          label={t('certify')}
          error={showRequired && !certified ? t('required') : null}
        />
        <Checkbox
          name="accept"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          label={t.rich('accept', {
            terms: (chunks) => (
              <Link
                href="/terms"
                target="_blank"
                className="font-medium text-brand underline-offset-2 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
          error={showRequired && !accepted ? t('required') : null}
        />
        <div>
          <Button size="lg" icon={BadgeCheck} onClick={accept} loading={saving}>
            {t('submit')}
          </Button>
        </div>
      </section>
    </div>
  );
}

/** Lien « Relire les conditions de publication » ouvrant les règles dans une fenêtre. */
export function ContributorTermsReview() {
  const t = useTranslations('jobs.terms');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="link" icon={ScrollText} onClick={() => setOpen(true)}>
        {t('review')}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('title')}
        size="lg"
        footer={
          <Button variant="secondary" icon={X} onClick={() => setOpen(false)}>
            {t('close')}
          </Button>
        }
      >
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
          <VersionLine />
          <ContributorRules />
        </div>
      </Dialog>
    </>
  );
}
