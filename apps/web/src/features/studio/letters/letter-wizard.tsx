'use client';

import {
  BRIEF_LIMITS,
  type CareerDocumentContent,
  type CareerDocumentResponse,
  type CareerDocumentSummary,
  type CountryResponse,
  type CvContent,
  LETTER_BRIEF_LONG_FIELDS,
  LETTER_REQUIRED_FIELDS,
  type LetterBrief,
  type LetterBriefField,
  type LetterContent,
  type LetterType,
} from '@opportinities/shared';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileUser,
  GraduationCap,
  Heart,
  type LucideIcon,
  MessageSquareText,
  Send,
  Sparkles,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextAreaField } from '@/components/ui/form-controls';
import { FieldError, FormField } from '@/components/ui/form-field';
import { SegmentedControl, Stepper } from '@/components/ui/navigation';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { useStudioAi } from '../ai-context';
import { Section } from '../form-section';
import { GenerateDialog } from '../generate-dialog';
import { type LetterIssue, RecipientFields, SenderFields } from './letter-form';

type FactStepKey =
  | 'post'
  | 'profile'
  | 'motivation'
  | 'studies'
  | 'internship'
  | 'candidate'
  | 'knowledge'
  | 'job'
  | 'departure'
  | 'initial'
  | 'thanks';

interface FactStep {
  key: FactStepKey;
  fields: LetterBriefField[];
  /** Les informations d'un CV du Studio peuvent pré-remplir cette étape. */
  importCv?: boolean;
}

/** Questionnaire de chaque lettre : seulement les faits utiles, regroupés en étapes courtes. */
const FACT_STEPS: Record<LetterType, FactStep[]> = {
  cover_letter: [
    { key: 'post', fields: ['jobTitle', 'offerText'] },
    {
      key: 'profile',
      fields: ['currentPosition', 'experience', 'skills', 'strengths'],
      importCv: true,
    },
    { key: 'motivation', fields: ['motivation', 'availability'] },
  ],
  application_letter: [
    { key: 'post', fields: ['jobTitle'] },
    { key: 'profile', fields: ['currentPosition', 'experience', 'skills'], importCv: true },
    { key: 'motivation', fields: ['motivation', 'availability'] },
  ],
  internship_request: [
    { key: 'studies', fields: ['school', 'studyField', 'studyLevel', 'skills'], importCv: true },
    {
      key: 'internship',
      fields: ['internshipDomain', 'internshipDuration', 'internshipGoals', 'availability'],
    },
  ],
  recommendation_draft: [
    { key: 'candidate', fields: ['candidateName', 'purpose'] },
    { key: 'knowledge', fields: ['recommenderRole', 'relationship', 'qualities', 'experience'] },
  ],
  resignation_letter: [
    { key: 'job', fields: ['position', 'startDate'] },
    { key: 'departure', fields: ['lastDay', 'notice', 'reason'] },
  ],
  follow_up_letter: [
    { key: 'initial', fields: ['jobTitle', 'initialSubject', 'initialDate', 'context'] },
  ],
  thank_you_letter: [{ key: 'thanks', fields: ['jobTitle', 'context', 'reason'] }],
};

const STEP_ICONS: Record<FactStepKey | 'sender' | 'signer' | 'recipient' | 'generate', LucideIcon> =
  {
    sender: UserRound,
    signer: UserRound,
    recipient: Send,
    post: Briefcase,
    profile: FileUser,
    motivation: Heart,
    studies: GraduationCap,
    internship: Target,
    candidate: UserRound,
    knowledge: ClipboardList,
    job: Briefcase,
    departure: CalendarDays,
    initial: Send,
    thanks: MessageSquareText,
    generate: Sparkles,
  };

const FIELD_ICONS: Partial<Record<LetterBriefField, LucideIcon>> = {
  jobTitle: Briefcase,
  currentPosition: BadgeCheck,
  school: GraduationCap,
  studyField: GraduationCap,
  studyLevel: GraduationCap,
  internshipDomain: Target,
  internshipDuration: CalendarDays,
  position: Briefcase,
  startDate: CalendarDays,
  lastDay: CalendarDays,
  notice: CalendarDays,
  candidateName: UserRound,
  recommenderRole: BadgeCheck,
  purpose: Target,
  initialSubject: Send,
  initialDate: CalendarDays,
  availability: CalendarDays,
};

type FieldText = { label: string; placeholder: string };

/** Faits d'un CV du Studio pour une lettre : seuls les champs encore vides sont remplis. */
function factsFromCv(cv: CvContent, locale: string, present: string): LetterBrief {
  // « 2021-03 » devient « mars 2021 » : la lettre ne reprend jamais un format numérique.
  const month = (value: string) =>
    /^\d{4}-\d{2}$/.test(value)
      ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
          new Date(`${value}-01T12:00:00Z`),
        )
      : value;
  const period = (start: string, end: string, current: boolean) =>
    [month(start), current ? present : month(end)].filter(Boolean).join(' - ');
  const experience = cv.experiences
    .map((item) => {
      const head = [item.role, item.organization].filter(Boolean).join(', ');
      const when = period(item.startDate, item.endDate, item.current);
      return [head + (when ? ` (${when})` : ''), item.description].filter(Boolean).join(' : ');
    })
    .join('\n');
  const current = cv.experiences.find((item) => item.current);
  const education = cv.education[0];
  return {
    experience: experience.slice(0, BRIEF_LIMITS.long),
    skills: cv.skills.join(', ').slice(0, BRIEF_LIMITS.long),
    currentPosition: current
      ? [current.role, current.organization].filter(Boolean).join(', ').slice(0, BRIEF_LIMITS.short)
      : '',
    school: education?.school.slice(0, BRIEF_LIMITS.short) ?? '',
    studyField: education?.degree.slice(0, BRIEF_LIMITS.short) ?? '',
  };
}

/**
 * Questionnaire guidé d'une lettre : l'utilisateur fournit des faits (des notes suffisent),
 * l'IA rédige. Les réponses sont enregistrées au fil de la saisie, comme le reste du document.
 */
export function LetterWizard({
  documentId,
  type,
  content,
  brief,
  countries,
  issues,
  onContent,
  onBrief,
  onGenerated,
}: {
  documentId: string;
  type: LetterType;
  content: LetterContent;
  brief: LetterBrief;
  countries: CountryResponse[];
  issues: Record<string, LetterIssue>;
  onContent: (next: LetterContent) => void;
  onBrief: (next: LetterBrief) => void;
  onGenerated: (content: CareerDocumentContent) => void;
}) {
  const t = useTranslations('studio.wizard');
  const tStudio = useTranslations('studio');
  const locale = useLocale();
  const { options, setOptions } = useStudioAi();
  // Sous-arbres complets : `raw` attend une feuille dans le typage de next-intl.
  const raw = tStudio.raw as (key: string) => unknown;
  const fieldTexts = raw('briefFields') as Record<LetterBriefField, FieldText>;
  const overrides = (raw('briefOverrides') as Record<string, Record<string, FieldText>>)[type];
  const text = (field: LetterBriefField): FieldText => overrides?.[field] ?? fieldTexts[field];
  const required = LETTER_REQUIRED_FIELDS[type];

  const steps = [
    type === 'recommendation_draft' ? ('signer' as const) : ('sender' as const),
    'recipient' as const,
    ...FACT_STEPS[type].map((step) => step.key),
    'generate' as const,
  ];
  const [index, setIndex] = useState(0);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [cvs, setCvs] = useState<CareerDocumentSummary[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const stepKey = steps[index] as (typeof steps)[number];
  const factStep = FACT_STEPS[type].find((step) => step.key === stepKey);

  const value = (field: LetterBriefField) => brief[field] ?? '';
  const setField = (field: LetterBriefField, next: string) => onBrief({ ...brief, [field]: next });

  /** Champs obligatoires encore vides, pour l'étape donnée ou pour toute la lettre. */
  const missingIn = (fields: readonly string[]) =>
    fields.filter((field) =>
      field === 'sender.fullName'
        ? !content.sender.fullName.trim()
        : !value(field as LetterBriefField).trim(),
    );
  const stepRequired = (key: (typeof steps)[number]): string[] => {
    if (key === 'sender' || key === 'signer') return ['sender.fullName'];
    const step = FACT_STEPS[type].find((entry) => entry.key === key);
    return step ? step.fields.filter((field) => required.includes(field)) : [];
  };
  const allMissing = steps.flatMap((key) => missingIn(stepRequired(key)));
  const label = (field: string) =>
    field === 'sender.fullName'
      ? tStudio('letter.fields.fullName')
      : text(field as LetterBriefField).label;

  function go(delta: 1 | -1) {
    if (delta === 1) {
      const missing = missingIn(stepRequired(stepKey));
      if (missing.length > 0) {
        setBlocked(missing);
        return;
      }
    }
    setBlocked([]);
    setIndex((current) => Math.min(steps.length - 1, Math.max(0, current + delta)));
  }

  async function openImport() {
    setImportOpen(true);
    if (cvs === null) {
      const documents = await api
        .get<CareerDocumentSummary[]>('/me/career-documents')
        .catch(() => [] as CareerDocumentSummary[]);
      setCvs(documents.filter((document) => document.type === 'cv'));
    }
  }

  async function importCv(id: string) {
    const cv = await api.get<CareerDocumentResponse<CvContent>>(`/me/career-documents/${id}`);
    const facts = factsFromCv(cv.content, locale, tStudio('cv.present'));
    const next: LetterBrief = { ...brief };
    for (const [field, fact] of Object.entries(facts) as [LetterBriefField, string][]) {
      if (fact && !value(field).trim()) next[field] = fact;
    }
    onBrief(next);
    setImportOpen(false);
    toast.success(t('imported'));
  }

  const Icon = STEP_ICONS[stepKey];
  const hint =
    stepKey === 'sender' ||
    stepKey === 'signer' ||
    stepKey === 'recipient' ||
    stepKey === 'generate'
      ? t(`stepHints.${stepKey}`)
      : undefined;

  return (
    <div className="grid gap-4">
      <Stepper current={index + 1} total={steps.length} label={t(`steps.${stepKey}`)} />

      <div key={stepKey} className="animate-fade-up">
        <Section icon={Icon} title={t(`steps.${stepKey}`)} hint={hint}>
          {(stepKey === 'sender' || stepKey === 'signer') && (
            <SenderFields
              content={content}
              onChange={onContent}
              countries={countries}
              issues={issues}
            />
          )}
          {stepKey === 'recipient' && <RecipientFields content={content} onChange={onContent} />}

          {factStep && (
            <>
              {factStep.importCv && (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={FileUser}
                    onClick={openImport}
                  >
                    {t('importCv')}
                  </Button>
                </div>
              )}
              <div className="grid gap-4">
                {factStep.fields.map((field) => {
                  const optional = required.includes(field) ? undefined : t('optional');
                  const long = field === 'offerText' || LETTER_BRIEF_LONG_FIELDS.includes(field);
                  const max =
                    field === 'offerText'
                      ? BRIEF_LIMITS.offer
                      : long
                        ? BRIEF_LIMITS.long
                        : BRIEF_LIMITS.short;
                  return long ? (
                    <TextAreaField
                      key={field}
                      label={text(field).label}
                      name={`brief.${field}`}
                      icon={MessageSquareText}
                      placeholder={text(field).placeholder}
                      optionalLabel={optional}
                      hint={field === 'offerText' ? undefined : t('notesHint')}
                      maxLength={max}
                      rows={field === 'offerText' ? 6 : 3}
                      value={value(field)}
                      onChange={(event) => setField(field, event.target.value)}
                    />
                  ) : (
                    <FormField
                      key={field}
                      label={text(field).label}
                      name={`brief.${field}`}
                      icon={FIELD_ICONS[field] ?? MessageSquareText}
                      placeholder={text(field).placeholder}
                      optionalLabel={optional}
                      maxLength={max}
                      value={value(field)}
                      onChange={(event) => setField(field, event.target.value)}
                    />
                  );
                })}
              </div>
            </>
          )}

          {stepKey === 'generate' && (
            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <p className="text-[13px] font-semibold text-fg">{t('tone')}</p>
                  <SegmentedControl
                    label={t('tone')}
                    value={options.tone}
                    onChange={(tone) => setOptions({ ...options, tone })}
                    options={(['formal', 'dynamic', 'sober'] as const).map((tone) => ({
                      value: tone,
                      label: t(`tones.${tone}`),
                    }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <p className="text-[13px] font-semibold text-fg">{t('length')}</p>
                  <SegmentedControl
                    label={t('length')}
                    value={options.length}
                    onChange={(length) => setOptions({ ...options, length })}
                    options={(['short', 'standard', 'detailed'] as const).map((length) => ({
                      value: length,
                      label: t(`lengths.${length}`),
                    }))}
                  />
                </div>
              </div>
              {allMissing.length > 0 ? (
                <FieldError>
                  {t('missing', { fields: allMissing.map(label).join(', ') })}
                </FieldError>
              ) : (
                <p className="text-[13px] text-fg-muted">{t('ready')}</p>
              )}
              <div>
                <GenerateDialog
                  documentId={documentId}
                  label={content.body.trim() ? t('regenerateAll') : t('generate')}
                  overwrite={Boolean(content.body.trim())}
                  disabled={allMissing.length > 0}
                  onGenerated={onGenerated}
                />
              </div>
            </div>
          )}
        </Section>
      </div>

      {blocked.length > 0 && (
        <FieldError>{t('missing', { fields: blocked.map(label).join(', ') })}</FieldError>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          icon={ArrowLeft}
          disabled={index === 0}
          onClick={() => go(-1)}
        >
          {t('back')}
        </Button>
        {stepKey !== 'generate' && (
          <Button type="button" trailingIcon={ArrowRight} onClick={() => go(1)}>
            {t('next')}
          </Button>
        )}
      </div>

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={t('importCvTitle')}
        description={t('importCvBody')}
        footer={
          <Button variant="secondary" icon={X} onClick={() => setImportOpen(false)}>
            {t('importCancel')}
          </Button>
        }
      >
        {cvs !== null && cvs.length === 0 && <p>{t('noCv')}</p>}
        <ul className="grid gap-2">
          {(cvs ?? []).map((cv) => (
            <li key={cv.id}>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                icon={FileUser}
                onClick={() => void importCv(cv.id)}
              >
                {cv.title}
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
