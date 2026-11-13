'use client';

import {
  type CountryResponse,
  type CvContent,
  type CvPersonal,
  LANGUAGE_LEVELS,
  type LanguageLevel,
  STUDIO_LIMITS,
} from '@opportinities/shared';
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  FolderKanban,
  GraduationCap,
  Home,
  Languages,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  School,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, type ReactNode, useState } from 'react';
import { CountrySelect } from '@/components/forms/country-select';
import { Button, IconButton } from '@/components/ui/button';
import { FormSelect, TextAreaField } from '@/components/ui/form-controls';
import { Checkbox, FormField } from '@/components/ui/form-field';
import { AiAssist } from './ai-assist';
import { Section } from './form-section';
import { type CvIssue } from './cv-validation';

export { type CvIssue, validateCv } from './cv-validation';

type ListKey =
  'experiences' | 'education' | 'languages' | 'certifications' | 'projects' | 'references';
type Item<K extends ListKey> = CvContent[K][number];

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const FACTORIES: { [K in ListKey]: () => Item<K> } = {
  experiences: () => ({
    id: newId(),
    role: '',
    organization: '',
    location: '',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
  }),
  education: () => ({
    id: newId(),
    degree: '',
    school: '',
    location: '',
    startDate: '',
    endDate: '',
    description: '',
  }),
  languages: () => ({ id: newId(), name: '', level: 'intermediate' as LanguageLevel }),
  certifications: () => ({ id: newId(), name: '', issuer: '', date: '' }),
  projects: () => ({ id: newId(), name: '', description: '', url: '' }),
  references: () => ({ id: newId(), name: '', role: '', organization: '', contact: '' }),
};

/** Formulaire complet du CV. Chaque modification remonte un nouveau contenu (immuable). */
export function CvForm({
  documentId,
  content,
  onChange,
  countries,
  issues,
}: {
  content: CvContent;
  onChange: (next: CvContent) => void;
  countries: CountryResponse[];
  issues: Record<string, CvIssue>;
  /** Document concerné par les suggestions de l'IA. */
  documentId: string;
}) {
  const t = useTranslations('studio.editor');
  const [skillDraft, setSkillDraft] = useState('');
  const { shortText: S, mediumText: M, summaryMax, descriptionMax: D } = STUDIO_LIMITS;

  const error = (path: string): string | null => {
    const issue = issues[path];
    return issue ? t(`errors.${issue}`) : null;
  };

  const setPersonal = (key: keyof CvPersonal, value: string) =>
    onChange({ ...content, personal: { ...content.personal, [key]: value } });

  function setItem<K extends ListKey>(key: K, index: number, patch: Partial<Item<K>>) {
    const list = [...content[key]] as Item<K>[];
    list[index] = { ...list[index], ...patch } as Item<K>;
    onChange({ ...content, [key]: list });
  }
  function addItem<K extends ListKey>(key: K) {
    if (content[key].length >= STUDIO_LIMITS.itemsMax) return;
    onChange({ ...content, [key]: [...content[key], FACTORIES[key]()] });
  }
  function removeItem<K extends ListKey>(key: K, index: number) {
    onChange({ ...content, [key]: content[key].filter((_, position) => position !== index) });
  }
  function moveItem<K extends ListKey>(key: K, index: number, delta: -1 | 1) {
    const list = [...content[key]] as Item<K>[];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target] as Item<K>, list[index] as Item<K>];
    onChange({ ...content, [key]: list });
  }

  /** Cadre d'un élément de liste : réordonner ou retirer. */
  const itemFrame = <K extends ListKey>(key: K, index: number, children: ReactNode) => (
    <div
      key={content[key][index]?.id}
      className="rounded-lg border border-line bg-surface-2/40 p-3.5"
    >
      <div className="mb-3 flex items-center justify-end gap-1">
        <IconButton
          icon={ArrowUp}
          size="sm"
          label={t('moveUp')}
          disabled={index === 0}
          onClick={() => moveItem(key, index, -1)}
        />
        <IconButton
          icon={ArrowDown}
          size="sm"
          label={t('moveDown')}
          disabled={index === content[key].length - 1}
          onClick={() => moveItem(key, index, 1)}
        />
        <IconButton
          icon={Trash2}
          size="sm"
          label={t('remove')}
          onClick={() => removeItem(key, index)}
        />
      </div>
      <div className="grid gap-4">{children}</div>
    </div>
  );

  const addButton = (key: ListKey) => (
    <Button
      type="button"
      variant="secondary"
      icon={Plus}
      disabled={content[key].length >= STUDIO_LIMITS.itemsMax}
      onClick={() => addItem(key)}
    >
      {t('add')}
    </Button>
  );

  const monthField = (
    path: string,
    label: string,
    value: string,
    onValue: (value: string) => void,
    disabled = false,
  ) => (
    <FormField
      label={label}
      name={path}
      icon={CalendarDays}
      placeholder={t('placeholders.month')}
      inputMode="numeric"
      maxLength={7}
      value={value}
      disabled={disabled}
      onChange={(event) => onValue(event.target.value)}
      error={error(path)}
    />
  );

  function addSkills(raw: string) {
    const additions = raw
      .split(',')
      .map((skill) => skill.trim().slice(0, STUDIO_LIMITS.skillMax))
      .filter(Boolean);
    if (additions.length === 0) return;
    const skills = [...content.skills];
    for (const skill of additions) {
      const exists = skills.some((entry) => entry.toLowerCase() === skill.toLowerCase());
      if (!exists && skills.length < STUDIO_LIMITS.skillsMax) skills.push(skill);
    }
    onChange({ ...content, skills });
    setSkillDraft('');
  }
  function onSkillKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkills(skillDraft);
    } else if (event.key === 'Backspace' && !skillDraft && content.skills.length > 0) {
      onChange({ ...content, skills: content.skills.slice(0, -1) });
    }
  }

  const { personal } = content;

  return (
    <div className="grid gap-4">
      <Section icon={UserRound} title={t('sections.personal')} hint={t('honesty')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t('fields.fullName')}
            name="fullName"
            icon={UserRound}
            placeholder={t('placeholders.fullName')}
            maxLength={S}
            value={personal.fullName}
            onChange={(event) => setPersonal('fullName', event.target.value)}
          />
          <FormField
            label={t('fields.headline')}
            name="headline"
            icon={BadgeCheck}
            placeholder={t('placeholders.headline')}
            maxLength={S}
            value={personal.headline}
            onChange={(event) => setPersonal('headline', event.target.value)}
          />
          <FormField
            label={t('fields.email')}
            name="email"
            type="email"
            icon={Mail}
            placeholder={t('placeholders.email')}
            maxLength={254}
            value={personal.email}
            onChange={(event) => setPersonal('email', event.target.value)}
            error={error('personal.email')}
          />
          <FormField
            label={t('fields.phone')}
            name="phone"
            type="tel"
            icon={Phone}
            placeholder={t('placeholders.phone')}
            maxLength={25}
            value={personal.phone}
            onChange={(event) => setPersonal('phone', event.target.value)}
            error={error('personal.phone')}
          />
          <FormField
            label={t('fields.city')}
            name="city"
            icon={MapPin}
            placeholder={t('placeholders.city')}
            maxLength={S}
            value={personal.city}
            onChange={(event) => setPersonal('city', event.target.value)}
          />
          <CountrySelect
            countries={countries}
            label={t('fields.country')}
            name="countryIso2"
            value={personal.countryIso2}
            onChange={(iso2) => setPersonal('countryIso2', iso2)}
          />
          <FormField
            className="sm:col-span-2"
            label={t('fields.address')}
            name="address"
            icon={Home}
            placeholder={t('placeholders.address')}
            maxLength={M}
            value={personal.address}
            onChange={(event) => setPersonal('address', event.target.value)}
          />
        </div>
      </Section>

      <Section icon={AlignLeft} title={t('sections.summary')}>
        <TextAreaField
          label={t('fields.summary')}
          name="summary"
          icon={AlignLeft}
          placeholder={t('placeholders.summary')}
          maxLength={summaryMax}
          rows={5}
          value={personal.summary}
          onChange={(event) => setPersonal('summary', event.target.value)}
        />
        <AiAssist
          documentId={documentId}
          target="summary"
          text={personal.summary}
          context={{ title: personal.headline }}
          onApply={(suggestion) => setPersonal('summary', suggestion)}
        />
      </Section>

      <Section icon={Briefcase} title={t('sections.experiences')} action={addButton('experiences')}>
        {content.experiences.map((item, index) =>
          itemFrame(
            'experiences',
            index,
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={t('fields.role')}
                  name={`experiences.${index}.role`}
                  icon={Briefcase}
                  placeholder={t('placeholders.role')}
                  maxLength={S}
                  value={item.role}
                  onChange={(event) => setItem('experiences', index, { role: event.target.value })}
                />
                <FormField
                  label={t('fields.organization')}
                  name={`experiences.${index}.organization`}
                  icon={Building2}
                  placeholder={t('placeholders.organization')}
                  maxLength={S}
                  value={item.organization}
                  onChange={(event) =>
                    setItem('experiences', index, { organization: event.target.value })
                  }
                />
                <FormField
                  className="sm:col-span-2"
                  label={t('fields.location')}
                  name={`experiences.${index}.location`}
                  icon={MapPin}
                  placeholder={t('placeholders.location')}
                  maxLength={S}
                  value={item.location}
                  onChange={(event) =>
                    setItem('experiences', index, { location: event.target.value })
                  }
                />
                {monthField(
                  `experiences.${index}.startDate`,
                  t('fields.startDate'),
                  item.startDate,
                  (value) => setItem('experiences', index, { startDate: value }),
                )}
                {monthField(
                  `experiences.${index}.endDate`,
                  t('fields.endDate'),
                  item.current ? '' : item.endDate,
                  (value) => setItem('experiences', index, { endDate: value }),
                  item.current,
                )}
              </div>
              <Checkbox
                label={t('current')}
                checked={item.current}
                onChange={(event) =>
                  setItem('experiences', index, {
                    current: event.target.checked,
                    endDate: event.target.checked ? '' : item.endDate,
                  })
                }
              />
              <TextAreaField
                label={t('fields.description')}
                name={`experiences.${index}.description`}
                icon={AlignLeft}
                placeholder={t('placeholders.description')}
                maxLength={D}
                rows={4}
                value={item.description}
                onChange={(event) =>
                  setItem('experiences', index, { description: event.target.value })
                }
              />
              <AiAssist
                documentId={documentId}
                target="experience"
                text={item.description}
                context={{ title: item.role, organization: item.organization }}
                onApply={(suggestion) => setItem('experiences', index, { description: suggestion })}
              />
            </>,
          ),
        )}
      </Section>

      <Section icon={GraduationCap} title={t('sections.education')} action={addButton('education')}>
        {content.education.map((item, index) =>
          itemFrame(
            'education',
            index,
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={t('fields.degree')}
                  name={`education.${index}.degree`}
                  icon={GraduationCap}
                  placeholder={t('placeholders.degree')}
                  maxLength={S}
                  value={item.degree}
                  onChange={(event) => setItem('education', index, { degree: event.target.value })}
                />
                <FormField
                  label={t('fields.school')}
                  name={`education.${index}.school`}
                  icon={School}
                  placeholder={t('placeholders.school')}
                  maxLength={S}
                  value={item.school}
                  onChange={(event) => setItem('education', index, { school: event.target.value })}
                />
                <FormField
                  className="sm:col-span-2"
                  label={t('fields.location')}
                  name={`education.${index}.location`}
                  icon={MapPin}
                  placeholder={t('placeholders.location')}
                  maxLength={S}
                  value={item.location}
                  onChange={(event) =>
                    setItem('education', index, { location: event.target.value })
                  }
                />
                {monthField(
                  `education.${index}.startDate`,
                  t('fields.startDate'),
                  item.startDate,
                  (value) => setItem('education', index, { startDate: value }),
                )}
                {monthField(
                  `education.${index}.endDate`,
                  t('fields.endDate'),
                  item.endDate,
                  (value) => setItem('education', index, { endDate: value }),
                )}
              </div>
              <TextAreaField
                label={t('fields.description')}
                name={`education.${index}.description`}
                icon={AlignLeft}
                placeholder={t('placeholders.description')}
                maxLength={D}
                rows={3}
                value={item.description}
                onChange={(event) =>
                  setItem('education', index, { description: event.target.value })
                }
              />
              <AiAssist
                documentId={documentId}
                target="education"
                text={item.description}
                context={{ title: item.degree, organization: item.school }}
                onApply={(suggestion) => setItem('education', index, { description: suggestion })}
              />
            </>,
          ),
        )}
      </Section>

      <Section icon={Sparkles} title={t('sections.skills')} hint={t('hints.skills')}>
        {content.skills.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {content.skills.map((skill) => (
              <li
                key={skill}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pr-1 pl-3 text-[13px] text-fg"
              >
                {skill}
                <button
                  type="button"
                  className="grid size-5 place-items-center rounded-full text-fg-subtle hover:bg-line hover:text-fg"
                  aria-label={t('removeSkill', { skill })}
                  onClick={() =>
                    onChange({ ...content, skills: content.skills.filter((s) => s !== skill) })
                  }
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <FormField
          label={t('fields.skill')}
          name="skill"
          icon={Sparkles}
          placeholder={t('placeholders.skill')}
          maxLength={STUDIO_LIMITS.skillMax * 4}
          value={skillDraft}
          disabled={content.skills.length >= STUDIO_LIMITS.skillsMax}
          onChange={(event) => setSkillDraft(event.target.value)}
          onKeyDown={onSkillKey}
          onBlur={() => addSkills(skillDraft)}
          trailing={
            <IconButton
              icon={Plus}
              size="sm"
              label={t('add')}
              disabled={!skillDraft.trim()}
              onClick={() => addSkills(skillDraft)}
            />
          }
        />
      </Section>

      <Section icon={Languages} title={t('sections.languages')} action={addButton('languages')}>
        {content.languages.map((item, index) =>
          itemFrame(
            'languages',
            index,
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label={t('fields.languageName')}
                name={`languages.${index}.name`}
                icon={Languages}
                placeholder={t('placeholders.languageName')}
                maxLength={S}
                value={item.name}
                onChange={(event) => setItem('languages', index, { name: event.target.value })}
              />
              <FormSelect<LanguageLevel>
                label={t('fields.level')}
                icon={BadgeCheck}
                placeholder={t('fields.level')}
                value={item.level}
                onChange={(level) => level && setItem('languages', index, { level })}
                options={LANGUAGE_LEVELS.map((level) => ({
                  value: level,
                  label: t(`levels.${level}`),
                }))}
              />
            </div>,
          ),
        )}
      </Section>

      <Section
        icon={Award}
        title={t('sections.certifications')}
        action={addButton('certifications')}
      >
        {content.certifications.map((item, index) =>
          itemFrame(
            'certifications',
            index,
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                label={t('fields.certification')}
                name={`certifications.${index}.name`}
                icon={Award}
                placeholder={t('placeholders.certification')}
                maxLength={S}
                value={item.name}
                onChange={(event) => setItem('certifications', index, { name: event.target.value })}
              />
              <FormField
                label={t('fields.issuer')}
                name={`certifications.${index}.issuer`}
                icon={Building2}
                placeholder={t('placeholders.issuer')}
                maxLength={S}
                value={item.issuer}
                onChange={(event) =>
                  setItem('certifications', index, { issuer: event.target.value })
                }
              />
              {monthField(`certifications.${index}.date`, t('fields.date'), item.date, (value) =>
                setItem('certifications', index, { date: value }),
              )}
            </div>,
          ),
        )}
      </Section>

      <Section icon={FolderKanban} title={t('sections.projects')} action={addButton('projects')}>
        {content.projects.map((item, index) =>
          itemFrame(
            'projects',
            index,
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={t('fields.project')}
                  name={`projects.${index}.name`}
                  icon={FolderKanban}
                  placeholder={t('placeholders.project')}
                  maxLength={S}
                  value={item.name}
                  onChange={(event) => setItem('projects', index, { name: event.target.value })}
                />
                <FormField
                  label={t('fields.url')}
                  name={`projects.${index}.url`}
                  type="url"
                  icon={Link2}
                  placeholder={t('placeholders.url')}
                  maxLength={M}
                  value={item.url}
                  onChange={(event) => setItem('projects', index, { url: event.target.value })}
                  error={error(`projects.${index}.url`)}
                />
              </div>
              <TextAreaField
                label={t('fields.description')}
                name={`projects.${index}.description`}
                icon={AlignLeft}
                placeholder={t('placeholders.description')}
                maxLength={D}
                rows={3}
                value={item.description}
                onChange={(event) =>
                  setItem('projects', index, { description: event.target.value })
                }
              />
              <AiAssist
                documentId={documentId}
                target="project"
                text={item.description}
                context={{ title: item.name, organization: undefined }}
                onApply={(suggestion) => setItem('projects', index, { description: suggestion })}
              />
            </>,
          ),
        )}
      </Section>

      <Section
        icon={Users}
        title={t('sections.references')}
        hint={t('hints.references')}
        action={addButton('references')}
      >
        {content.references.map((item, index) =>
          itemFrame(
            'references',
            index,
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label={t('fields.referenceName')}
                name={`references.${index}.name`}
                icon={UserRound}
                placeholder={t('placeholders.referenceName')}
                maxLength={S}
                value={item.name}
                onChange={(event) => setItem('references', index, { name: event.target.value })}
              />
              <FormField
                label={t('fields.referenceRole')}
                name={`references.${index}.role`}
                icon={BadgeCheck}
                placeholder={t('placeholders.referenceRole')}
                maxLength={S}
                value={item.role}
                onChange={(event) => setItem('references', index, { role: event.target.value })}
              />
              <FormField
                label={t('fields.organization')}
                name={`references.${index}.organization`}
                icon={Building2}
                placeholder={t('placeholders.organization')}
                maxLength={S}
                value={item.organization}
                onChange={(event) =>
                  setItem('references', index, { organization: event.target.value })
                }
              />
              <FormField
                label={t('fields.contact')}
                name={`references.${index}.contact`}
                icon={Mail}
                placeholder={t('placeholders.contact')}
                maxLength={S}
                value={item.contact}
                onChange={(event) => setItem('references', index, { contact: event.target.value })}
              />
            </div>,
          ),
        )}
      </Section>
    </div>
  );
}
