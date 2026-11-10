'use client';

import { type ChangePasswordRequest, PASSWORD_MIN_LENGTH } from '@opportinities/shared';
import { KeyRound, Lock, LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import {
  compact,
  type FieldErrors,
  hasErrors,
  validateConfirmation,
  validateNewPassword,
} from '@/lib/validation';

type Fields = 'currentPassword' | 'newPassword' | 'newPasswordConfirmation';
const EMPTY: Record<Fields, string> = {
  currentPassword: '',
  newPassword: '',
  newPasswordConfirmation: '',
};

/** Changement du mot de passe : l'API vérifie l'actuel et déconnecte les autres sessions. */
export function PasswordForm() {
  const t = useTranslations('auth');
  const tSettings = useTranslations('common.app.settings');
  const tActions = useTranslations('common.actions');
  const router = useRouter();
  const { fieldMessage, fromApiError } = useFormErrors();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: Fields, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const validation = compact<Fields>({
      currentPassword: values.currentPassword ? undefined : { key: 'required' },
      newPassword: validateNewPassword(values.newPassword),
      newPasswordConfirmation: validateConfirmation(
        values.newPassword,
        values.newPasswordConfirmation,
      ),
    });
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSaving(true);
    try {
      const payload: ChangePasswordRequest = values;
      await api.post('/auth/password/change', payload);
      setValues(EMPTY);
      toast.success(tSettings('passwordChanged'), tSettings('passwordChangedBody'));
      router.refresh();
    } catch (error) {
      setFormError(fromApiError(error).message);
    } finally {
      setSaving(false);
    }
  }

  const passwordProps = { showLabel: t('password.show'), hideLabel: t('password.hide') };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <PasswordField
        {...passwordProps}
        label={t('fields.currentPassword')}
        name="currentPassword"
        icon={Lock}
        placeholder={t('placeholders.currentPassword')}
        autoComplete="current-password"
        value={values.currentPassword}
        onChange={(event) => set('currentPassword', event.target.value)}
        error={fieldMessage(errors.currentPassword)}
        required
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <PasswordField
          {...passwordProps}
          label={t('fields.newPassword')}
          name="newPassword"
          icon={LockKeyhole}
          placeholder={t('placeholders.newPassword')}
          autoComplete="new-password"
          value={values.newPassword}
          onChange={(event) => set('newPassword', event.target.value)}
          hint={t('password.hint', { min: PASSWORD_MIN_LENGTH })}
          error={fieldMessage(errors.newPassword)}
          required
        />
        <PasswordField
          {...passwordProps}
          label={t('fields.newPasswordConfirmation')}
          name="newPasswordConfirmation"
          icon={LockKeyhole}
          placeholder={t('placeholders.passwordConfirmation')}
          autoComplete="new-password"
          value={values.newPasswordConfirmation}
          onChange={(event) => set('newPasswordConfirmation', event.target.value)}
          error={fieldMessage(errors.newPasswordConfirmation)}
          required
        />
      </div>
      <div>
        <Button
          type="submit"
          variant="secondary"
          icon={KeyRound}
          loading={saving}
          loadingLabel={tActions('submitting')}
        >
          {tSettings('passwordSubmit')}
        </Button>
      </div>
    </form>
  );
}
