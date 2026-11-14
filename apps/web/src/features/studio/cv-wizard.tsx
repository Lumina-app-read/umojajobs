'use client';

import {
  BRIEF_LIMITS,
  type CareerDocumentContent,
  type CountryResponse,
  type CvBrief,
  type CvContent,
} from '@opportinities/shared';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  GraduationCap,
  type LucideIcon,
  MessageSquareText,
  Sparkles,
  Target,
  UserRound,
  Wrench,
  FolderKanban,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/form-controls';
import { FieldError, FormField } from '@/components/ui/form-field';
import { SegmentedControl, Stepper } from '@/components/ui/navigation';
import { useStudioAi } from './ai-context';
import { CvForm, type CvSectionKey } from './cv-form';
import { type CvIssue } from './cv-validation';
import { Section } from './form-section';
import { GenerateDialog } from './generate-dialog';
import { PhotoField } from './photo-field';

type StepKey =
  'identity' | 'target' | 'experiences' | 'education' | 'skills' | 'extras' | 'generate';

const STEPS: { key: StepKey; icon: LucideIcon; sections?: CvSectionKey[] }[] = [
  { key: 'identity', icon: UserRound, sections: ['personal'] },
  { key: 'target', icon: Target },
  { key: 'experiences', icon: Briefcase, sections: ['experiences'] },
  { key: 'education', icon: GraduationCap, sections: ['education'] },
  { key: 'skills', icon: Wrench, sections: ['skills', 'languages', 'certifications'] },
  { key: 'extras', icon: FolderKanban, sections: ['projects', 'interests', 'references'] },
  { key: 'generate', icon: Sparkles },
];

/** Le CV contient-il déjà un texte rédigé (une génération le remplacerait) ? */
const hasWrittenText = (cv: CvContent) =>
  Boolean(cv.personal.summary.trim()) ||
  [...cv.experiences, ...cv.education, ...cv.projects].some((item) => item.description.trim());

/**
 * Questionnaire guidé du CV : les faits, étape par étape (des notes suffisent pour les
 * expériences), puis l'IA rédige le profil et les descriptions. Les faits restent ceux saisis.
 */
export function CvWizard({
  documentId,
  content,
  brief,
  countries,
  issues,
  photoVersion,
  onPhoto,
  onContent,
  onBrief,
  onGenerated,
}: {
  documentId: string;
  content: CvContent;
  brief: CvBrief;
  countries: CountryResponse[];
  issues: Record<string, CvIssue>;
  photoVersion: string | null;
  onPhoto: (version: string | null) => void;
  onContent: (next: CvContent) => void;
  onBrief: (next: CvBrief) => void;
  onGenerated: (content: CareerDocumentContent) => void;
}) {
  const t = useTranslations('studio.cvWizard');
  const tWizard = useTranslations('studio.wizard');
  const { options, setOptions } = useStudioAi();
  const [index, setIndex] = useState(0);
  const [blocked, setBlocked] = useState<string | null>(null);
  const step = STEPS[index] as (typeof STEPS)[number];

  const hasFacts =
    content.experiences.length +
      content.education.length +
      content.skills.length +
      content.projects.length >
    0;
  const missing = [
    !content.personal.fullName.trim() ? t('missingName') : null,
    !hasFacts ? t('missingFacts') : null,
  ].filter((message): message is string => message !== null);

  function go(delta: 1 | -1) {
    if (delta === 1 && step.key === 'identity' && !content.personal.fullName.trim()) {
      setBlocked(t('missingName'));
      return;
    }
    setBlocked(null);
    setIndex((current) => Math.min(STEPS.length - 1, Math.max(0, current + delta)));
  }

  return (
    <div className="grid gap-4">
      <Stepper current={index + 1} total={STEPS.length} label={t(`steps.${step.key}`)} />

      <div key={step.key} className="grid animate-fade-up gap-4">
        {step.key !== 'identity' && step.key !== 'target' && step.key !== 'generate' ? (
          <>
            <p className="text-sm sm:text-[13px] text-fg-muted">{t(`stepHints.${step.key}`)}</p>
            <CvForm
              documentId={documentId}
              content={content}
              countries={countries}
              issues={issues}
              sections={step.sections}
              onChange={onContent}
            />
          </>
        ) : step.key === 'identity' ? (
          <>
            <p className="text-sm sm:text-[13px] text-fg-muted">{t('stepHints.identity')}</p>
            <CvForm
              documentId={documentId}
              content={content}
              countries={countries}
              issues={issues}
              sections={step.sections}
              onChange={onContent}
              photo={
                <PhotoField documentId={documentId} version={photoVersion} onChange={onPhoto} />
              }
            />
          </>
        ) : (
          <Section
            icon={step.icon}
            title={t(`steps.${step.key}`)}
            hint={t(`stepHints.${step.key}`)}
          >
            {step.key === 'target' && (
              <>
                <FormField
                  label={t('targetRole.label')}
                  name="brief.targetRole"
                  icon={Target}
                  placeholder={t('targetRole.placeholder')}
                  optionalLabel={tWizard('optional')}
                  maxLength={BRIEF_LIMITS.short}
                  value={brief.targetRole ?? ''}
                  onChange={(event) => onBrief({ ...brief, targetRole: event.target.value })}
                />
                <TextAreaField
                  label={t('jobOffer.label')}
                  name="brief.jobOffer"
                  icon={MessageSquareText}
                  placeholder={t('jobOffer.placeholder')}
                  optionalLabel={tWizard('optional')}
                  maxLength={BRIEF_LIMITS.offer}
                  rows={6}
                  value={brief.jobOffer ?? ''}
                  onChange={(event) => onBrief({ ...brief, jobOffer: event.target.value })}
                />
              </>
            )}
            {step.key === 'generate' && (
              <div className="grid gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <p className="text-sm sm:text-[13px] font-semibold text-fg">
                      {tWizard('tone')}
                    </p>
                    <SegmentedControl
                      label={tWizard('tone')}
                      value={options.tone}
                      onChange={(tone) => setOptions({ ...options, tone })}
                      options={(['formal', 'dynamic', 'sober'] as const).map((tone) => ({
                        value: tone,
                        label: tWizard(`tones.${tone}`),
                      }))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <p className="text-sm sm:text-[13px] font-semibold text-fg">
                      {tWizard('length')}
                    </p>
                    <SegmentedControl
                      label={tWizard('length')}
                      value={options.length}
                      onChange={(length) => setOptions({ ...options, length })}
                      options={(['short', 'standard', 'detailed'] as const).map((length) => ({
                        value: length,
                        label: tWizard(`lengths.${length}`),
                      }))}
                    />
                  </div>
                </div>
                {missing.length > 0 ? (
                  missing.map((message) => <FieldError key={message}>{message}</FieldError>)
                ) : (
                  <p className="text-sm sm:text-[13px] text-fg-muted">{tWizard('ready')}</p>
                )}
                <div>
                  <GenerateDialog
                    documentId={documentId}
                    label={content.personal.summary.trim() ? t('regenerateAll') : t('generate')}
                    overwrite={hasWrittenText(content)}
                    disabled={missing.length > 0}
                    onGenerated={onGenerated}
                  />
                </div>
              </div>
            )}
          </Section>
        )}
      </div>

      {blocked && <FieldError>{blocked}</FieldError>}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          icon={ArrowLeft}
          disabled={index === 0}
          onClick={() => go(-1)}
        >
          {tWizard('back')}
        </Button>
        {step.key !== 'generate' && (
          <Button type="button" trailingIcon={ArrowRight} onClick={() => go(1)}>
            {tWizard('next')}
          </Button>
        )}
      </div>
    </div>
  );
}
