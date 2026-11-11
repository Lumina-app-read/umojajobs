'use client';

import {
  CONTRACT_TYPES,
  type ContractType,
  type CountryResponse,
  EDUCATION_LEVELS,
  type EducationLevel,
  EXPERIENCE_LEVELS,
  type ExperienceLevel,
  JOB_LIMITS,
  JOB_SOURCE_TYPES,
  type JobCategoryResponse,
  type JobOfferInput,
  type JobOfferResponse,
  type JobSourceType,
  SALARY_PERIODS,
  type SalaryPeriod,
  WORK_MODES,
  type WorkMode,
} from '@opportinities/shared';
import {
  AtSign,
  Banknote,
  Briefcase,
  Building,
  CalendarClock,
  CalendarDays,
  Clock,
  Coins,
  FileText,
  GraduationCap,
  Laptop,
  Layers,
  Link2,
  ListChecks,
  MapPinned,
  Newspaper,
  Save,
  ScrollText,
  Send,
  Tags,
  TrendingUp,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { CitySelect, type CityValue } from '@/components/forms/city-select';
import { CountrySelect } from '@/components/forms/country-select';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormSelect, TextAreaField } from '@/components/ui/form-controls';
import { Checkbox, FormField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { useFormErrors } from '@/lib/use-form-errors';
import { type FieldError } from '@/lib/validation';
import { ContributorTermsReview } from './contributor-terms';
import { OfferDocuments } from './offer-documents';

interface FormValues {
  title: string;
  companyName: string;
  categoryId: string | null;
  contractType: ContractType | null;
  workMode: WorkMode | null;
  educationLevel: EducationLevel | null;
  experienceLevel: ExperienceLevel | null;
  countryIso2: string;
  city: CityValue | null;
  description: string;
  requirements: string;
  skills: string[];
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod | null;
  startDate: string;
  endDate: string;
  sourceType: JobSourceType | null;
  sourceUrl: string;
  sourceDetails: string;
  applicationInstructions: string;
  applicationEmail: string;
  applicationUrl: string;
  applicationAddress: string;
}

type FieldKey = keyof FormValues;

function initialValues(offer: JobOfferResponse | null): FormValues {
  return {
    title: offer?.title ?? '',
    companyName: offer?.companyName ?? '',
    categoryId: offer?.categoryId ?? null,
    contractType: offer?.contractType ?? null,
    workMode: offer?.workMode ?? null,
    educationLevel: offer?.educationLevel ?? null,
    experienceLevel: offer?.experienceLevel ?? null,
    countryIso2: offer?.countryIso2 ?? '',
    city: offer?.city ?? null,
    description: offer?.description ?? '',
    requirements: offer?.requirements ?? '',
    skills: offer?.skills ?? [],
    salaryMin: offer?.salaryMin ?? '',
    salaryMax: offer?.salaryMax ?? '',
    salaryCurrency: offer?.salaryCurrency ?? '',
    salaryPeriod: offer?.salaryPeriod ?? null,
    startDate: offer?.startDate ?? '',
    endDate: offer?.endDate ?? '',
    sourceType: offer?.sourceType ?? null,
    sourceUrl: offer?.sourceUrl ?? '',
    sourceDetails: offer?.sourceDetails ?? '',
    applicationInstructions: offer?.applicationInstructions ?? '',
    applicationEmail: offer?.applicationEmail ?? '',
    applicationUrl: offer?.applicationUrl ?? '',
    applicationAddress: offer?.applicationAddress ?? '',
  };
}

const text = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** Montant saisi librement (« 350 000 », « 350000,50 ») ; NaN si la saisie n'est pas un nombre. */
function amount(value: string): number | null {
  const compact = value.replace(/[\s  ]/g, '').replace(',', '.');
  if (compact === '') return null;
  return /^\d+(\.\d{1,2})?$/.test(compact) ? Number(compact) : Number.NaN;
}

/** Correspondance entre les champs de l'API et ceux du formulaire (erreurs, champs manquants). */
const API_FIELD: Record<string, FieldKey> = {
  countryIso2: 'countryIso2',
  cityId: 'city',
  categoryId: 'categoryId',
};
const toFieldKey = (field: string): FieldKey => API_FIELD[field] ?? (field as FieldKey);

const LABEL_KEY: Partial<Record<FieldKey, string>> = {
  countryIso2: 'country',
  city: 'city',
  categoryId: 'category',
};

/** Bloc du formulaire : titre, explication et champs. */
function Section({
  title,
  hint,
  children,
  tone = 'default',
}: {
  title: string;
  hint: string;
  children: ReactNode;
  tone?: 'default' | 'private';
}) {
  return (
    <section
      className={
        tone === 'private'
          ? 'rounded-xl border border-primary/25 bg-primary-soft/40 p-5 shadow-xs sm:p-6'
          : 'rounded-xl border border-line bg-surface p-5 shadow-xs sm:p-6'
      }
    >
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{hint}</p>
      <div className="mt-5 grid gap-5">{children}</div>
    </section>
  );
}

/**
 * Formulaire de publication (création et modification d'un brouillon ou d'une offre à corriger).
 * L'API reste seule juge : elle revalide tout, indique les champs manquants et contrôle les dates.
 */
export function JobOfferForm({
  offer: initialOffer,
  categories,
  countries,
  locale,
}: {
  offer: JobOfferResponse | null;
  categories: JobCategoryResponse[];
  countries: CountryResponse[];
  locale: string;
}) {
  const t = useTranslations('jobs');
  const tSettings = useTranslations('common.app.settings');
  const router = useRouter();
  const { fieldMessage, fromApiError } = useFormErrors();
  const [offer, setOffer] = useState(initialOffer);
  const [values, setValues] = useState<FormValues>(() => initialValues(initialOffer));
  const [errors, setErrors] = useState<Partial<Record<FieldKey, FieldError>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [skillDraft, setSkillDraft] = useState('');
  const [declared, setDeclared] = useState(false);
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // Le message d'erreur est en haut du formulaire : on l'amène à l'écran dès qu'il apparaît.
  useEffect(() => {
    if (formError) alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [formError]);

  const set = <K extends FieldKey>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const optional = tSettings('optional');
  const label = (key: FieldKey) => t(`form.fields.${(LABEL_KEY[key] ?? key) as 'title'}`);

  function addSkill(raw: string) {
    const skill = raw.trim().slice(0, JOB_LIMITS.skillMax);
    if (!skill || values.skills.length >= JOB_LIMITS.skillsMax) return;
    if (values.skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())) return;
    set('skills', [...values.skills, skill]);
    setSkillDraft('');
  }

  function onSkillKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkill(skillDraft);
    } else if (event.key === 'Backspace' && skillDraft === '' && values.skills.length > 0) {
      set('skills', values.skills.slice(0, -1));
    }
  }

  /** Charge utile pour l'API ; null si un montant n'est pas un nombre (erreur affichée). */
  function payload(): JobOfferInput | null {
    const salaryMin = amount(values.salaryMin);
    const salaryMax = amount(values.salaryMax);
    const invalid: Partial<Record<FieldKey, FieldError>> = {};
    if (Number.isNaN(salaryMin)) invalid.salaryMin = { key: 'invalid' };
    if (Number.isNaN(salaryMax)) invalid.salaryMax = { key: 'invalid' };
    if (Object.keys(invalid).length > 0) {
      setErrors((current) => ({ ...current, ...invalid }));
      return null;
    }
    const pending = skillDraft.trim() ? [skillDraft.trim()] : [];
    return {
      title: text(values.title),
      companyName: text(values.companyName),
      categoryId: values.categoryId,
      contractType: values.contractType,
      workMode: values.workMode,
      educationLevel: values.educationLevel,
      experienceLevel: values.experienceLevel,
      countryIso2: text(values.countryIso2),
      cityId: values.city?.id ?? null,
      description: text(values.description),
      requirements: text(values.requirements),
      skills: [...values.skills, ...pending],
      salaryMin,
      salaryMax,
      salaryCurrency: text(values.salaryCurrency),
      salaryPeriod: values.salaryPeriod,
      startDate: text(values.startDate),
      endDate: text(values.endDate),
      sourceType: values.sourceType,
      sourceUrl: text(values.sourceUrl),
      sourceDetails: text(values.sourceDetails),
      applicationInstructions: text(values.applicationInstructions),
      applicationEmail: text(values.applicationEmail),
      applicationUrl: text(values.applicationUrl),
      applicationAddress: text(values.applicationAddress),
    };
  }

  function handleError(error: unknown) {
    if (error instanceof ApiError && error.code === 'JOB_OFFER_VERSION_CONFLICT') {
      setFormError(t('form.conflict'));
      return;
    }
    const { message, fields } = fromApiError(error);
    setFormError(message);
    setErrors(
      Object.fromEntries(
        Object.entries(fields).map(([field, value]) => [toFieldKey(field), value]),
      ),
    );
  }

  /** Enregistre (création ou modification) et renvoie l'offre à jour. */
  async function save(): Promise<JobOfferResponse | null> {
    const body = payload();
    if (!body) return null;
    setFormError(null);
    if (!offer) {
      const created = await api.post<JobOfferResponse>('/me/job-offers', body);
      setOffer(created);
      setSkillDraft('');
      // L'adresse de la page devient celle du brouillon : un rechargement ne le perd pas.
      window.history.replaceState(null, '', `/${locale}/dashboard/publish/${created.id}`);
      return created;
    }
    const updated = await api.patch<JobOfferResponse>(`/me/job-offers/${offer.id}`, {
      ...body,
      version: offer.version,
    });
    setOffer(updated);
    setSkillDraft('');
    return updated;
  }

  async function onSaveDraft() {
    setBusy('save');
    try {
      if (await save()) toast.success(t('form.saved'));
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit() {
    if (!declared) {
      setFormError(t('terms.required'));
      return;
    }
    setBusy('submit');
    try {
      const saved = await save();
      if (!saved) return;
      if (saved.missingFields.length > 0) {
        const missing = saved.missingFields.map((field) => toFieldKey(field));
        setErrors(
          Object.fromEntries(missing.map((key) => [key, { key: 'required' } as FieldError])),
        );
        setFormError(t('form.missing', { fields: missing.map(label).join(', ') }));
        return;
      }
      await api.post(`/me/job-offers/${saved.id}/submit`, {
        version: saved.version,
        declarationAccepted: true,
      });
      toast.success(t('form.submitted'), t('form.submittedBody'));
      router.push('/dashboard/publications');
      router.refresh();
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(null);
    }
  }

  const error = (key: FieldKey) => fieldMessage(errors[key]);
  const categoryName = (category: JobCategoryResponse) =>
    locale === 'fr' ? category.nameFr : category.nameEn;
  const enumOptions = <T extends string>(
    list: readonly T[],
    group:
      | 'contractType'
      | 'workMode'
      | 'educationLevel'
      | 'experienceLevel'
      | 'salaryPeriod'
      | 'sourceType',
  ) =>
    list.map((value) => ({
      value,
      label: t(`enums.${group}.${value}` as 'enums.workMode.remote'),
    }));

  return (
    <div className="grid max-w-4xl gap-6 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            {offer ? t('form.editTitle') : t('form.newTitle')}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-fg-muted">
            {t('form.newIntro')}
          </p>
        </div>
        <ContributorTermsReview />
      </div>

      {formError && (
        <div ref={alertRef}>
          <Alert tone="error">{formError}</Alert>
        </div>
      )}

      <Section title={t('form.sections.job')} hint={t('form.sections.jobHint')}>
        <FormField
          label={label('title')}
          name="title"
          icon={Briefcase}
          placeholder={t('form.placeholders.title')}
          value={values.title}
          maxLength={JOB_LIMITS.titleMax}
          onChange={(event) => set('title', event.target.value)}
          error={error('title')}
          required
        />
        <FormField
          label={label('companyName')}
          name="companyName"
          icon={Building}
          placeholder={t('form.placeholders.companyName')}
          value={values.companyName}
          maxLength={JOB_LIMITS.companyMax}
          onChange={(event) => set('companyName', event.target.value)}
          error={error('companyName')}
          required
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormSelect
            label={label('categoryId')}
            icon={Layers}
            placeholder={t('form.placeholders.category')}
            value={values.categoryId}
            onChange={(value) => set('categoryId', value)}
            options={categories.map((category) => ({
              value: category.id,
              label: categoryName(category),
            }))}
            error={error('categoryId')}
          />
          <FormSelect
            label={label('contractType')}
            icon={ScrollText}
            placeholder={t('form.placeholders.contractType')}
            value={values.contractType}
            onChange={(value) => set('contractType', value)}
            options={enumOptions(CONTRACT_TYPES, 'contractType')}
            error={error('contractType')}
          />
          <FormSelect
            label={label('workMode')}
            icon={Laptop}
            placeholder={t('form.placeholders.workMode')}
            value={values.workMode}
            onChange={(value) => set('workMode', value)}
            options={enumOptions(WORK_MODES, 'workMode')}
            error={error('workMode')}
          />
          <FormSelect
            label={label('experienceLevel')}
            optionalLabel={optional}
            icon={TrendingUp}
            placeholder={t('form.placeholders.experienceLevel')}
            value={values.experienceLevel}
            onChange={(value) => set('experienceLevel', value)}
            options={enumOptions(EXPERIENCE_LEVELS, 'experienceLevel')}
            allowEmpty
          />
          <FormSelect
            label={label('educationLevel')}
            optionalLabel={optional}
            icon={GraduationCap}
            placeholder={t('form.placeholders.educationLevel')}
            value={values.educationLevel}
            onChange={(value) => set('educationLevel', value)}
            options={enumOptions(EDUCATION_LEVELS, 'educationLevel')}
            allowEmpty
          />
        </div>
      </Section>

      <Section title={t('form.sections.location')} hint={t('form.sections.locationHint')}>
        <div className="grid gap-5 sm:grid-cols-2">
          <CountrySelect
            countries={countries}
            label={label('countryIso2')}
            value={values.countryIso2}
            onChange={(iso2) => {
              setValues((current) => {
                const country = countries.find((entry) => entry.iso2 === iso2);
                return {
                  ...current,
                  countryIso2: iso2,
                  // Une ville d'un autre pays n'a plus de sens ; la devise suit le pays par défaut.
                  city: iso2 === current.countryIso2 ? current.city : null,
                  salaryCurrency: current.salaryCurrency || country?.currencyCode || '',
                };
              });
              setErrors((current) => ({ ...current, countryIso2: undefined }));
            }}
            error={error('countryIso2')}
          />
          <CitySelect
            countryIso2={values.countryIso2 || null}
            value={values.city}
            onChange={(city) => set('city', city)}
            label={label('city')}
            optionalLabel={optional}
            placeholder={t('form.placeholders.city')}
            hint={t('form.hints.noCity')}
            disabledHint={t('form.hints.city')}
            clearLabel={t('form.upload.remove')}
            error={error('city')}
          />
        </div>
      </Section>

      <Section title={t('form.sections.content')} hint={t('form.sections.contentHint')}>
        <TextAreaField
          label={label('description')}
          name="description"
          icon={FileText}
          placeholder={t('form.placeholders.description')}
          value={values.description}
          maxLength={JOB_LIMITS.descriptionMax}
          rows={8}
          onChange={(event) => set('description', event.target.value)}
          error={error('description')}
        />
        <TextAreaField
          label={label('requirements')}
          optionalLabel={optional}
          name="requirements"
          icon={ListChecks}
          placeholder={t('form.placeholders.requirements')}
          value={values.requirements}
          maxLength={JOB_LIMITS.requirementsMax}
          onChange={(event) => set('requirements', event.target.value)}
          error={error('requirements')}
        />
        <div className="grid gap-2">
          <FormField
            label={label('skills')}
            optionalLabel={optional}
            name="skills"
            icon={Tags}
            placeholder={t('form.placeholders.skills')}
            value={skillDraft}
            maxLength={JOB_LIMITS.skillMax}
            onChange={(event) => setSkillDraft(event.target.value.replace(',', ''))}
            onKeyDown={onSkillKey}
            onBlur={() => addSkill(skillDraft)}
            hint={t('form.hints.skills')}
            error={error('skills')}
          />
          {values.skills.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {values.skills.map((skill) => (
                <li
                  key={skill}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-soft pr-1 pl-3 text-[13px] font-medium text-brand"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        'skills',
                        values.skills.filter((entry) => entry !== skill),
                      )
                    }
                    className="grid size-5 place-items-center rounded-full hover:bg-primary/15"
                    aria-label={t('form.removeSkill', { skill })}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title={t('form.sections.salary')} hint={t('form.sections.salaryHint')}>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={label('salaryMin')}
            optionalLabel={optional}
            name="salaryMin"
            icon={Banknote}
            placeholder={t('form.placeholders.salaryMin')}
            inputMode="decimal"
            value={values.salaryMin}
            onChange={(event) => set('salaryMin', event.target.value)}
            error={error('salaryMin')}
          />
          <FormField
            label={label('salaryMax')}
            optionalLabel={optional}
            name="salaryMax"
            icon={Banknote}
            placeholder={t('form.placeholders.salaryMax')}
            inputMode="decimal"
            value={values.salaryMax}
            onChange={(event) => set('salaryMax', event.target.value)}
            error={error('salaryMax')}
          />
          <FormField
            label={label('salaryCurrency')}
            optionalLabel={optional}
            name="salaryCurrency"
            icon={Coins}
            placeholder={t('form.placeholders.salaryCurrency')}
            maxLength={3}
            value={values.salaryCurrency}
            onChange={(event) => set('salaryCurrency', event.target.value.toUpperCase())}
            error={error('salaryCurrency')}
          />
          <FormSelect
            label={label('salaryPeriod')}
            optionalLabel={optional}
            icon={Clock}
            placeholder={t('form.placeholders.salaryPeriod')}
            value={values.salaryPeriod}
            onChange={(value) => set('salaryPeriod', value)}
            options={enumOptions(SALARY_PERIODS, 'salaryPeriod')}
            error={error('salaryPeriod')}
            allowEmpty
          />
        </div>
      </Section>

      <Section title={t('form.sections.validity')} hint={t('form.sections.validityHint')}>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={label('startDate')}
            name="startDate"
            type="date"
            icon={CalendarDays}
            placeholder={t('form.placeholders.startDate')}
            value={values.startDate}
            onChange={(event) => set('startDate', event.target.value)}
            error={error('startDate')}
          />
          <FormField
            label={label('endDate')}
            name="endDate"
            type="date"
            icon={CalendarClock}
            placeholder={t('form.placeholders.endDate')}
            value={values.endDate}
            min={values.startDate || undefined}
            onChange={(event) => set('endDate', event.target.value)}
            error={error('endDate')}
          />
        </div>
      </Section>

      <Section title={t('form.sections.source')} hint={t('form.sections.sourceHint')}>
        <FormSelect
          label={label('sourceType')}
          icon={Newspaper}
          placeholder={t('form.placeholders.sourceType')}
          value={values.sourceType}
          onChange={(value) => set('sourceType', value)}
          options={enumOptions(JOB_SOURCE_TYPES, 'sourceType')}
          error={error('sourceType')}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={label('sourceUrl')}
            optionalLabel={optional}
            name="sourceUrl"
            type="url"
            icon={Link2}
            placeholder={t('form.placeholders.sourceUrl')}
            value={values.sourceUrl}
            onChange={(event) => set('sourceUrl', event.target.value)}
            error={error('sourceUrl')}
          />
          <FormField
            label={label('sourceDetails')}
            optionalLabel={optional}
            name="sourceDetails"
            icon={Newspaper}
            placeholder={t('form.placeholders.sourceDetails')}
            maxLength={JOB_LIMITS.sourceDetailsMax}
            value={values.sourceDetails}
            onChange={(event) => set('sourceDetails', event.target.value)}
            error={error('sourceDetails')}
          />
        </div>
      </Section>

      <Section
        title={t('form.sections.application')}
        hint={t('form.sections.applicationHint')}
        tone="private"
      >
        <TextAreaField
          label={label('applicationInstructions')}
          optionalLabel={optional}
          name="applicationInstructions"
          icon={ListChecks}
          placeholder={t('form.placeholders.applicationInstructions')}
          value={values.applicationInstructions}
          maxLength={JOB_LIMITS.instructionsMax}
          rows={4}
          onChange={(event) => set('applicationInstructions', event.target.value)}
          error={error('applicationInstructions')}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={label('applicationEmail')}
            optionalLabel={optional}
            name="applicationEmail"
            type="email"
            icon={AtSign}
            placeholder={t('form.placeholders.applicationEmail')}
            value={values.applicationEmail}
            onChange={(event) => set('applicationEmail', event.target.value)}
            error={error('applicationEmail')}
          />
          <FormField
            label={label('applicationUrl')}
            optionalLabel={optional}
            name="applicationUrl"
            type="url"
            icon={Link2}
            placeholder={t('form.placeholders.applicationUrl')}
            value={values.applicationUrl}
            onChange={(event) => set('applicationUrl', event.target.value)}
            error={error('applicationUrl')}
          />
        </div>
        <FormField
          label={label('applicationAddress')}
          optionalLabel={optional}
          name="applicationAddress"
          icon={MapPinned}
          placeholder={t('form.placeholders.applicationAddress')}
          maxLength={JOB_LIMITS.addressMax}
          value={values.applicationAddress}
          onChange={(event) => set('applicationAddress', event.target.value)}
          error={error('applicationAddress')}
        />
      </Section>

      <Section title={t('form.sections.documents')} hint={t('form.sections.documentsHint')}>
        {offer ? (
          <OfferDocuments offer={offer} onChange={setOffer} />
        ) : (
          <p className="text-sm text-fg-muted">{t('form.draftFirst')}</p>
        )}
      </Section>

      <div className="z-20 rounded-xl border border-line bg-surface-raised/95 p-4 shadow-lg backdrop-blur-md lg:sticky lg:bottom-4">
        <Checkbox
          name="declaration"
          checked={declared}
          onChange={(event) => setDeclared(event.target.checked)}
          label={t('form.declaration')}
        />
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            icon={Save}
            onClick={onSaveDraft}
            loading={busy === 'save'}
            disabled={busy !== null}
          >
            {t('form.saveDraft')}
          </Button>
          <Button
            icon={Send}
            onClick={onSubmit}
            loading={busy === 'submit'}
            disabled={busy !== null}
          >
            {t('form.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
