'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { ApiError, errorMessageValues, fieldErrorKeys } from './api/errors';
import { type FieldError } from './validation';

/** Traduction des erreurs de formulaire (validation locale et erreurs de l'API). */
export function useFormErrors() {
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');

  const fieldMessage = useCallback(
    (error: FieldError | undefined): string | null =>
      error ? tValidation(error.key, error.values ?? {}) : null,
    [tValidation],
  );

  /** Message global d'une erreur API, et erreurs par champ lorsqu'elles sont fournies. */
  const fromApiError = useCallback(
    (error: unknown): { message: string; fields: Record<string, FieldError> } => {
      if (!(error instanceof ApiError)) {
        return { message: tErrors('INTERNAL_ERROR'), fields: {} };
      }
      const fields = Object.fromEntries(
        Object.entries(fieldErrorKeys(error)).map(([field, key]) => [field, { key } as FieldError]),
      );
      return { message: tErrors(error.code, errorMessageValues(error)), fields };
    },
    [tErrors],
  );

  return { fieldMessage, fromApiError };
}
