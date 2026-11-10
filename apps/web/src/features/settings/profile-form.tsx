'use client';

import {
  type CountryResponse,
  type MeResponse,
  type UpdateProfileRequest,
} from '@opportinities/shared';
import { Mail, Phone, Save, User, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { CountrySelect } from '@/components/forms/country-select';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import {
  compact,
  type FieldErrors,
  hasErrors,
  normalizePhone,
  validatePersonName,
  validatePhone,
} from '@/lib/validation';

type ProfileValues = { firstName: string; lastName: string; countryIso2: string; phone: string };

/** Formulaire de profil : nom, pays et téléphone facultatif. L'email est affiché, non modifiable. */
export function ProfileForm({
  user,
  countries,
}: {
  user: MeResponse;
  countries: CountryResponse[];
}) {
  const t = useTranslations('auth');
  const tSettings = useTranslations('common.app.settings');
  const tActions = useTranslations('common.actions');
  const router = useRouter();
  const { fieldMessage, fromApiError } = useFormErrors();
  const [values, setValues] = useState<ProfileValues>({
    firstName: user.firstName,
    lastName: user.lastName,
    countryIso2: user.countryIso2,
    phone: user.phoneE164 ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors<keyof ProfileValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const validation = compact<keyof ProfileValues>({
      firstName: validatePersonName(values.firstName),
      lastName: validatePersonName(values.lastName),
      countryIso2: values.countryIso2 ? undefined : { key: 'country' },
      phone: validatePhone(values.phone),
    });
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSaving(true);
    try {
      const payload: UpdateProfileRequest = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        countryIso2: values.countryIso2,
        phoneE164: normalizePhone(values.phone),
      };
      await api.patch<MeResponse>('/auth/me', payload);
      toast.success(tSettings('saved'));
      router.refresh();
    } catch (error) {
      const { message, fields } = fromApiError(error);
      setFormError(message);
      const { phoneE164, ...rest } = fields;
      setErrors({ ...rest, ...(phoneE164 ? { phone: { key: 'phone' } } : {}) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label={t('fields.firstName')}
          name="firstName"
          icon={User}
          placeholder={t('placeholders.firstName')}
          autoComplete="given-name"
          value={values.firstName}
          onChange={(event) => set('firstName', event.target.value)}
          error={fieldMessage(errors.firstName)}
          required
        />
        <FormField
          label={t('fields.lastName')}
          name="lastName"
          icon={UserRound}
          placeholder={t('placeholders.lastName')}
          autoComplete="family-name"
          value={values.lastName}
          onChange={(event) => set('lastName', event.target.value)}
          error={fieldMessage(errors.lastName)}
          required
        />
      </div>
      <FormField
        label={t('fields.email')}
        name="email"
        icon={Mail}
        placeholder={t('placeholders.email')}
        type="email"
        value={user.email}
        hint={tSettings('emailLocked')}
        disabled
        readOnly
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <CountrySelect
          countries={countries}
          label={t('fields.country')}
          value={values.countryIso2}
          onChange={(iso2) => set('countryIso2', iso2)}
          error={fieldMessage(errors.countryIso2)}
        />
        <FormField
          label={t('fields.phone')}
          optionalLabel={tSettings('optional')}
          name="phone"
          icon={Phone}
          placeholder={t('placeholders.phone')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={(event) => set('phone', event.target.value)}
          hint={tSettings('phoneHint')}
          error={fieldMessage(errors.phone)}
        />
      </div>
      <div>
        <Button type="submit" icon={Save} loading={saving} loadingLabel={tActions('submitting')}>
          {tSettings('save')}
        </Button>
      </div>
    </form>
  );
}
