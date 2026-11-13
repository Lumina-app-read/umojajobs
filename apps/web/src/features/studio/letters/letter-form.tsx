'use client';

import {
  type CountryResponse,
  ISO_DATE,
  LETTER_LIMITS,
  type LetterContent,
  type LetterRecipient,
  type LetterSender,
  type LetterType,
} from '@opportinities/shared';
import {
  AlignLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  FileText,
  Hash,
  Home,
  Mail,
  MapPin,
  MessageSquareQuote,
  Paperclip,
  PenLine,
  Phone,
  UserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CountrySelect } from '@/components/forms/country-select';
import { TextAreaField } from '@/components/ui/form-controls';
import { FormField } from '@/components/ui/form-field';
import { AiAssist } from '../ai-assist';
import { Section } from '../form-section';
import { SectionRegenerate } from '../section-regenerate';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ().-]{6,25}$/;

export type LetterIssue = 'date' | 'email' | 'phone';

/** Contrôles locaux, alignés sur ceux de l'API : l'enregistrement attend leur correction. */
export function validateLetter(content: LetterContent): Record<string, LetterIssue> {
  const issues: Record<string, LetterIssue> = {};
  if (content.sender.email && !EMAIL.test(content.sender.email)) issues['sender.email'] = 'email';
  if (content.sender.phone && !PHONE.test(content.sender.phone)) issues['sender.phone'] = 'phone';
  if (content.date && !ISO_DATE.test(content.date)) issues.date = 'date';
  return issues;
}

interface FieldsProps {
  content: LetterContent;
  onChange: (next: LetterContent) => void;
}

/** Coordonnées de l'expéditeur (ou du signataire, pour une recommandation). */
export function SenderFields({
  content,
  onChange,
  countries,
  issues,
}: FieldsProps & { countries: CountryResponse[]; issues: Record<string, LetterIssue> }) {
  const t = useTranslations('studio.letter');
  const { shortText: S, addressMax: A } = LETTER_LIMITS;
  const error = (path: string) => (issues[path] ? t(`${issues[path]}Invalid`) : null);
  const set = (key: keyof LetterSender, value: string) =>
    onChange({ ...content, sender: { ...content.sender, [key]: value } });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        label={t('fields.fullName')}
        name="sender.fullName"
        icon={UserRound}
        placeholder={t('placeholders.fullName')}
        maxLength={S}
        value={content.sender.fullName}
        onChange={(event) => set('fullName', event.target.value)}
      />
      <FormField
        label={t('fields.email')}
        name="sender.email"
        type="email"
        icon={Mail}
        placeholder={t('placeholders.email')}
        maxLength={254}
        value={content.sender.email}
        onChange={(event) => set('email', event.target.value)}
        error={error('sender.email')}
      />
      <FormField
        label={t('fields.phone')}
        name="sender.phone"
        type="tel"
        icon={Phone}
        placeholder={t('placeholders.phone')}
        maxLength={25}
        value={content.sender.phone}
        onChange={(event) => set('phone', event.target.value)}
        error={error('sender.phone')}
      />
      <FormField
        label={t('fields.address')}
        name="sender.address"
        icon={Home}
        placeholder={t('placeholders.address')}
        maxLength={A}
        value={content.sender.address}
        onChange={(event) => set('address', event.target.value)}
      />
      <FormField
        label={t('fields.city')}
        name="sender.city"
        icon={MapPin}
        placeholder={t('placeholders.city')}
        maxLength={S}
        value={content.sender.city}
        onChange={(event) => set('city', event.target.value)}
      />
      <CountrySelect
        countries={countries}
        label={t('fields.country')}
        name="sender.countryIso2"
        value={content.sender.countryIso2}
        onChange={(iso2) => set('countryIso2', iso2)}
      />
    </div>
  );
}

/** Destinataire et lieu d'écriture. */
export function RecipientFields({ content, onChange }: FieldsProps) {
  const t = useTranslations('studio.letter');
  const { shortText: S, addressMax: A } = LETTER_LIMITS;
  const set = (key: keyof LetterRecipient, value: string) =>
    onChange({ ...content, recipient: { ...content.recipient, [key]: value } });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        label={t('fields.recipientName')}
        name="recipient.name"
        icon={UserRound}
        placeholder={t('placeholders.recipientName')}
        maxLength={S}
        value={content.recipient.name}
        onChange={(event) => set('name', event.target.value)}
      />
      <FormField
        label={t('fields.recipientRole')}
        name="recipient.role"
        icon={BadgeCheck}
        placeholder={t('placeholders.recipientRole')}
        maxLength={S}
        value={content.recipient.role}
        onChange={(event) => set('role', event.target.value)}
      />
      <FormField
        label={t('fields.organization')}
        name="recipient.organization"
        icon={Building2}
        placeholder={t('placeholders.organization')}
        maxLength={S}
        value={content.recipient.organization}
        onChange={(event) => set('organization', event.target.value)}
      />
      <FormField
        label={t('fields.recipientAddress')}
        name="recipient.address"
        icon={Home}
        placeholder={t('placeholders.recipientAddress')}
        maxLength={A}
        value={content.recipient.address}
        onChange={(event) => set('address', event.target.value)}
      />
      <FormField
        label={t('fields.recipientCity')}
        name="recipient.city"
        icon={MapPin}
        placeholder={t('placeholders.recipientCity')}
        maxLength={S}
        value={content.recipient.city}
        onChange={(event) => set('city', event.target.value)}
      />
      <FormField
        label={t('fields.place')}
        name="place"
        icon={MapPin}
        placeholder={t('placeholders.place')}
        maxLength={S}
        value={content.place}
        onChange={(event) => onChange({ ...content, place: event.target.value })}
      />
    </div>
  );
}

/**
 * Onglet « Lettre » : le texte rédigé (par l'IA ou par l'utilisateur), modifiable librement.
 * Chaque partie rédigée peut être régénérée seule ; le corps peut aussi être amélioré.
 */
export function LetterForm({
  documentId,
  type,
  content,
  onChange,
  issues,
}: FieldsProps & {
  documentId: string;
  type: LetterType;
  issues: Record<string, LetterIssue>;
}) {
  const t = useTranslations('studio.letter');
  const { shortText: S, addressMax: A } = LETTER_LIMITS;
  const set = <K extends keyof LetterContent>(key: K, value: LetterContent[K]) =>
    onChange({ ...content, [key]: value });

  return (
    <div className="grid gap-4">
      <Section icon={CalendarDays} title={t('sections.details')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t('fields.date')}
            name="date"
            icon={CalendarDays}
            placeholder={t('placeholders.date')}
            inputMode="numeric"
            maxLength={10}
            hint={t('hints.date')}
            value={content.date}
            onChange={(event) => set('date', event.target.value)}
            error={issues.date ? t('dateInvalid') : null}
          />
          <FormField
            label={t('fields.reference')}
            name="reference"
            icon={Hash}
            placeholder={t('placeholders.reference')}
            maxLength={S}
            value={content.reference}
            onChange={(event) => set('reference', event.target.value)}
          />
          <div className="grid gap-1.5 sm:col-span-2">
            <FormField
              label={t('fields.subject')}
              name="subject"
              icon={FileText}
              placeholder={t(`subjects.${type}`)}
              maxLength={LETTER_LIMITS.subjectMax}
              value={content.subject}
              onChange={(event) => set('subject', event.target.value)}
            />
            <SectionRegenerate
              documentId={documentId}
              section="subject"
              current={content.subject}
              onApply={(text) => set('subject', text)}
            />
          </div>
        </div>
      </Section>

      <Section icon={PenLine} title={t('sections.body')} hint={t(`guides.${type}`)}>
        <FormField
          label={t('fields.salutation')}
          name="salutation"
          icon={MessageSquareQuote}
          placeholder={t('placeholders.salutation')}
          maxLength={LETTER_LIMITS.salutationMax}
          value={content.salutation}
          onChange={(event) => set('salutation', event.target.value)}
        />
        <TextAreaField
          label={t('fields.body')}
          name="body"
          icon={AlignLeft}
          placeholder={t('bodyPlaceholder')}
          hint={t('hints.body')}
          maxLength={LETTER_LIMITS.bodyMax}
          rows={14}
          value={content.body}
          onChange={(event) => set('body', event.target.value)}
        />
        <SectionRegenerate
          documentId={documentId}
          section="body"
          current={content.body}
          onApply={(text) => set('body', text)}
        />
        <AiAssist
          documentId={documentId}
          target="letter"
          text={content.body}
          context={{ title: content.subject, organization: content.recipient.organization }}
          onApply={(suggestion) => set('body', suggestion)}
        />
      </Section>

      <Section icon={MessageSquareQuote} title={t('sections.closing')}>
        <div className="grid gap-1.5">
          <TextAreaField
            label={t('fields.closing')}
            name="closing"
            icon={MessageSquareQuote}
            placeholder={t('placeholders.closing')}
            maxLength={LETTER_LIMITS.closingMax}
            rows={3}
            value={content.closing}
            onChange={(event) => set('closing', event.target.value)}
          />
          <SectionRegenerate
            documentId={documentId}
            section="closing"
            current={content.closing}
            onApply={(text) => set('closing', text)}
          />
        </div>
        <TextAreaField
          label={t('fields.enclosures')}
          name="enclosures"
          icon={Paperclip}
          placeholder={t('placeholders.enclosures')}
          hint={t('hints.enclosures')}
          maxLength={A}
          rows={3}
          value={content.enclosures}
          onChange={(event) => set('enclosures', event.target.value)}
        />
      </Section>
    </div>
  );
}
