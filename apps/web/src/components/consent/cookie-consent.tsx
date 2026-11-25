'use client';

import { Switch } from '@headlessui/react';
import {
  ChartColumn,
  Check,
  Cookie,
  type LucideIcon,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Link } from '@/i18n/navigation';
import {
  allCategories,
  CONSENT_CATEGORIES,
  type ConsentCategory,
  type ConsentRecord,
  getConsentSnapshot,
  OPEN_COOKIE_PREFERENCES_EVENT,
  saveConsent,
  subscribeConsent,
} from '@/lib/consent';
import { cn } from '@/lib/cn';

const CATEGORY_ICON: Record<ConsentCategory, LucideIcon> = {
  functional: SlidersHorizontal,
  analytics: ChartColumn,
};

/** Côté serveur, le choix est inconnu : rien n'est affiché avant l'hydratation. */
const UNKNOWN: unique symbol = Symbol('unknown');
const serverSnapshot = (): typeof UNKNOWN => UNKNOWN;

/**
 * Consentement aux cookies : fenêtre discrète au premier passage (panneau montant du bas sur
 * mobile, carte en bas à droite sur ordinateur) et panneau de préférences, rouvrable à tout moment
 * depuis le lien « Préférences des cookies ». Fermer le panneau n'enregistre aucun choix.
 */
export function CookieConsent() {
  const t = useTranslations('common.cookies');
  const record = useSyncExternalStore<ConsentRecord | null | typeof UNKNOWN>(
    subscribeConsent,
    getConsentSnapshot,
    serverSnapshot,
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const open = () => setPreferencesOpen(true);
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, open);
  }, []);

  const decide = (categories: Record<ConsentCategory, boolean>) => {
    saveConsent(categories);
    setPreferencesOpen(false);
  };
  const current = record === UNKNOWN ? null : record;
  const showBanner = record === null && !preferencesOpen;

  return (
    <>
      {showBanner && (
        <section
          aria-labelledby="cookie-banner-title"
          aria-describedby="cookie-banner-body"
          className={cn(
            'fixed inset-x-0 bottom-0 z-40 animate-sheet-up border-t border-line bg-surface-raised p-5 shadow-lg',
            'rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]',
            'sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[26rem] sm:rounded-xl sm:border sm:pb-5',
          )}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
              <Cookie className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="cookie-banner-title" className="text-base font-semibold text-fg">
                {t('title')}
              </h2>
              <p id="cookie-banner-body" className="mt-1 text-sm leading-relaxed text-fg-muted">
                {t.rich('body', {
                  privacy: (chunks) => (
                    <Link href="/privacy" className="font-medium text-brand hover:underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={X} onClick={() => decide(allCategories(false))}>
              {t('rejectAll')}
            </Button>
            <Button icon={Check} onClick={() => decide(allCategories(true))}>
              {t('acceptAll')}
            </Button>
            <Button
              variant="ghost"
              icon={SlidersHorizontal}
              className="col-span-2"
              onClick={() => setPreferencesOpen(true)}
            >
              {t('customize')}
            </Button>
          </div>
        </section>
      )}

      <CookiePreferences
        open={preferencesOpen}
        record={current}
        onClose={() => setPreferencesOpen(false)}
        onDecide={decide}
      />
    </>
  );
}

function CookiePreferences({
  open,
  record,
  onClose,
  onDecide,
}: {
  open: boolean;
  record: ConsentRecord | null;
  onClose: () => void;
  onDecide: (categories: Record<ConsentCategory, boolean>) => void;
}) {
  const t = useTranslations('common.cookies');
  const format = useFormatter();
  const [choices, setChoices] = useState(() => record?.categories ?? allCategories(false));

  // À chaque ouverture, le panneau repart du choix enregistré (rien de coché par défaut).
  const [openedWith, setOpenedWith] = useState<boolean>(open);
  if (open !== openedWith) {
    setOpenedWith(open);
    if (open) setChoices(record?.categories ?? allCategories(false));
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('preferencesTitle')}
      description={t('preferencesIntro')}
      footer={
        <>
          <Button variant="secondary" icon={X} onClick={() => onDecide(allCategories(false))}>
            {t('rejectAll')}
          </Button>
          <Button variant="secondary" icon={Check} onClick={() => onDecide(choices)}>
            {t('save')}
          </Button>
          <Button icon={Check} onClick={() => onDecide(allCategories(true))}>
            {t('acceptAll')}
          </Button>
        </>
      }
    >
      <ul className="grid gap-3">
        <CategoryRow
          icon={ShieldCheck}
          title={t('categories.necessary.title')}
          description={t('categories.necessary.body')}
          aside={<Badge tone="success">{t('alwaysActive')}</Badge>}
        />
        {CONSENT_CATEGORIES.map((category) => (
          <CategoryRow
            key={category}
            icon={CATEGORY_ICON[category]}
            title={t(`categories.${category}.title`)}
            description={t(`categories.${category}.body`)}
            aside={
              <Switch
                checked={choices[category]}
                onChange={(checked) =>
                  setChoices((currentChoices) => ({ ...currentChoices, [category]: checked }))
                }
                aria-label={t(`categories.${category}.title`)}
                className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-line-strong transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring data-checked:bg-primary"
              >
                <span
                  aria-hidden="true"
                  className="size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-emphasized group-data-checked:translate-x-[1.375rem]"
                />
              </Switch>
            }
          />
        ))}
      </ul>
      {record && (
        <p className="mt-4 text-xs text-fg-subtle">
          {t('lastChoice', {
            date: format.dateTime(new Date(record.decidedAt), {
              dateStyle: 'long',
              timeStyle: 'short',
            }),
            version: record.version,
          })}
        </p>
      )}
    </Dialog>
  );
}

function CategoryRow({
  icon: Icon,
  title,
  description,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  aside: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-lg border border-line bg-surface p-3.5">
      <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-fg">{title}</p>
          {aside}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{description}</p>
      </div>
    </li>
  );
}
