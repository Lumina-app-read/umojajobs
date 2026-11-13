'use client';

import {
  type CareerDocumentContent,
  type CareerDocumentResponse,
  type CountryResponse,
  type CvContent,
  type CvTemplate,
  ERROR_CODES,
  isLetterType,
  type LetterContent,
  STUDIO_LIMITS,
  templatesFor,
} from '@opportinities/shared';
import {
  AlignJustify,
  ArrowLeft,
  ChevronDown,
  CircleAlert,
  CloudCheck,
  Crown,
  Globe,
  GraduationCap,
  LayoutTemplate,
  LoaderCircle,
  type LucideIcon,
  PanelLeft,
  PencilLine,
  Rocket,
  RotateCw,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { countryName } from '@/components/forms/country-select';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { SegmentedControl } from '@/components/ui/navigation';
import { SelectMenu } from '@/components/ui/select-menu';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { type CvIssue, CvForm, validateCv } from './cv-form';
import { A4Preview } from './cv-preview';
import { documentCountry, StudioDocument, type StudioLabels } from './document-view';
import { ExportDialog } from './export-dialog';
import { type LetterIssue, LetterForm, validateLetter } from './letters/letter-form';

/** Icône de chaque modèle dans le sélecteur. */
const TEMPLATE_ICONS: Record<CvTemplate, LucideIcon> = {
  classic: AlignJustify,
  modern: PanelLeft,
  international: Globe,
  academic: GraduationCap,
  graduate: Rocket,
  executive: Crown,
};

type SaveState = 'saved' | 'dirty' | 'saving' | 'invalid' | 'conflict' | 'error';

/** Résultat du dernier enregistrement envoyé. */
type Outcome = 'ok' | 'invalid' | 'conflict' | 'error';

/** Délai sans frappe avant l'enregistrement automatique. */
const AUTOSAVE_DELAY_MS = 1_200;

interface Draft {
  title: string;
  templateKey: string;
  content: CareerDocumentContent;
}

function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations('studio.editor');
  const view = {
    saved: { icon: CloudCheck, text: t('saved'), tone: 'text-success' },
    saving: { icon: LoaderCircle, text: t('saving'), tone: 'text-fg-muted' },
    dirty: { icon: PencilLine, text: t('unsaved'), tone: 'text-fg-muted' },
    invalid: { icon: CircleAlert, text: t('invalid'), tone: 'text-warning' },
    error: { icon: CircleAlert, text: t('unsaved'), tone: 'text-danger' },
    conflict: { icon: CircleAlert, text: t('unsaved'), tone: 'text-danger' },
  }[state];
  const Icon = view.icon;
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-1.5 text-[13px] font-medium', view.tone)}
    >
      <Icon className={cn('size-4', state === 'saving' && 'animate-spin')} aria-hidden="true" />
      <span className="truncate">{view.text}</span>
    </p>
  );
}

/**
 * Éditeur d'un document du Studio (CV ou lettre) : formulaire à gauche, aperçu A4 à droite
 * (onglets sur mobile).
 * Enregistrement automatique après une courte pause, avec la version lue : si le document a été
 * modifié dans un autre onglet, l'écriture est refusée et l'utilisateur recharge.
 */
export function DocumentEditor({
  document,
  countries,
  labels,
}: {
  document: CareerDocumentResponse;
  countries: CountryResponse[];
  labels: Record<'fr' | 'en', StudioLabels>;
}) {
  const t = useTranslations('studio.editor');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const [draft, setDraft] = useState<Draft>({
    title: document.title,
    templateKey: document.templateKey,
    content: document.content,
  });
  const [revision, setRevision] = useState(0);
  const [savedRevision, setSavedRevision] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>('ok');
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'form' | 'preview'>('form');
  const version = useRef(document.version);

  const letter = isLetterType(document.type);
  const issues = useMemo(
    () =>
      letter
        ? validateLetter(draft.content as LetterContent)
        : validateCv(draft.content as CvContent),
    [draft.content, letter],
  );
  const invalid = Object.keys(issues).length > 0;
  const blocked = outcome === 'conflict';
  const pendingChanges = revision !== savedRevision;
  const state: SaveState = blocked
    ? 'conflict'
    : saving
      ? 'saving'
      : invalid || (pendingChanges && outcome === 'invalid')
        ? 'invalid'
        : pendingChanges
          ? outcome === 'error'
            ? 'error'
            : 'dirty'
          : 'saved';

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setRevision((current) => current + 1);
  }, []);

  const save = useCallback(
    async (target: number, snapshot: Draft) => {
      setSaving(true);
      try {
        const saved = await api.patch<CareerDocumentResponse>(
          `/me/career-documents/${document.id}`,
          {
            version: version.current,
            title: snapshot.title.trim() || document.title,
            templateKey: snapshot.templateKey,
            content: snapshot.content,
          },
        );
        version.current = saved.version;
        setSavedRevision(target);
        setOutcome('ok');
      } catch (caught) {
        if (
          caught instanceof ApiError &&
          caught.code === ERROR_CODES.CAREER_DOCUMENT_VERSION_CONFLICT
        ) {
          setOutcome('conflict');
        } else if (caught instanceof ApiError && caught.code === ERROR_CODES.VALIDATION_FAILED) {
          setOutcome('invalid');
        } else {
          setOutcome('error');
        }
      } finally {
        setSaving(false);
      }
    },
    [document.id, document.title],
  );

  // Enregistrement automatique : une seule requête à la fois, la dernière saisie l'emporte.
  useEffect(() => {
    if (blocked || saving || invalid || revision === savedRevision) return undefined;
    const timer = window.setTimeout(() => void save(revision, draft), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [blocked, draft, invalid, revision, savedRevision, save, saving]);

  // Avertit avant de quitter la page tant qu'une modification n'est pas enregistrée.
  useEffect(() => {
    if (revision === savedRevision) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [revision, savedRevision]);

  const countryIso2 = documentCountry(document.type, draft.content);
  const country = countries.find((entry) => entry.iso2 === countryIso2);
  const preview = (
    <A4Preview label={t('previewTab')}>
      <StudioDocument
        type={document.type}
        templateKey={draft.templateKey}
        content={draft.content}
        labels={labels[document.language]}
        language={document.language}
        countryName={country ? countryName(country, document.language) : ''}
      />
    </A4Preview>
  );

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-col gap-3 lg:sticky lg:top-16 lg:z-20 lg:-mx-2 lg:flex-row lg:items-center lg:justify-between lg:bg-canvas/90 lg:px-2 lg:py-2.5 lg:backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          <ButtonLink href="/dashboard/studio" variant="ghost" size="sm" icon={ArrowLeft}>
            {t('back')}
          </ButtonLink>
          <label className="sr-only" htmlFor="studio-title">
            {t('titleLabel')}
          </label>
          <input
            id="studio-title"
            size={1}
            value={draft.title}
            maxLength={STUDIO_LIMITS.titleMax}
            disabled={blocked}
            onChange={(event) => update({ title: event.target.value })}
            className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-xl font-bold tracking-[-0.02em] text-fg outline-none hover:border-line focus:border-primary focus:ring-[3px] focus:ring-ring"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator state={state} />
          <SelectMenu
            label={t('template')}
            value={draft.templateKey}
            disabled={blocked}
            onChange={(templateKey) => update({ templateKey })}
            options={templatesFor(document.type).map((key) => ({
              value: key,
              label: t(`templates.${key as CvTemplate}`),
              icon: TEMPLATE_ICONS[key as CvTemplate],
            }))}
            triggerClassName={buttonClasses('secondary', 'md')}
            trigger={
              <>
                <LayoutTemplate className="size-4" aria-hidden="true" />
                <span className="text-fg-muted">{t('template')} :</span>
                <span>{t(`templates.${draft.templateKey as CvTemplate}`)}</span>
                <ChevronDown className="size-4 text-fg-subtle" aria-hidden="true" />
              </>
            }
          />
          <ExportDialog documentId={document.id} saved={state === 'saved'} disabled={blocked} />
        </div>
      </div>

      {blocked && (
        <Alert tone="error">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('conflict')}</span>
            <Button
              size="sm"
              variant="secondary"
              icon={RotateCw}
              onClick={() => window.location.reload()}
            >
              {t('reload')}
            </Button>
          </div>
        </Alert>
      )}
      {state === 'error' && <Alert tone="error">{tErrors('NETWORK')}</Alert>}

      <div className="lg:hidden">
        <SegmentedControl
          label={t('viewLabel')}
          value={view}
          onChange={setView}
          options={[
            { value: 'form', label: t('formTab') },
            { value: 'preview', label: t('previewTab') },
          ]}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <fieldset
          disabled={blocked}
          className={cn('min-w-0', view === 'preview' && 'hidden lg:block')}
          lang={locale}
        >
          {isLetterType(document.type) ? (
            <LetterForm
              documentId={document.id}
              type={document.type}
              content={draft.content as LetterContent}
              countries={countries}
              issues={issues as Record<string, LetterIssue>}
              onChange={(content) => update({ content })}
            />
          ) : (
            <CvForm
              documentId={document.id}
              content={draft.content as CvContent}
              countries={countries}
              issues={issues as Record<string, CvIssue>}
              onChange={(content) => update({ content })}
            />
          )}
        </fieldset>
        <div
          className={cn(
            'min-w-0 rounded-xl border border-line bg-surface-2 p-3 sm:p-5 lg:sticky lg:top-34 lg:max-h-[calc(100dvh-9.5rem)] lg:overflow-y-auto',
            view === 'form' && 'hidden lg:block',
          )}
          lang={document.language}
        >
          {preview}
        </div>
      </div>
    </div>
  );
}
