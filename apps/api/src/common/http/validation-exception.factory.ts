import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@opportinities/shared';
import { type ValidationError } from 'class-validator';

export interface ValidationDetail {
  field: string;
  rules: string[];
}

/** Aplatit les erreurs class-validator (objets imbriqués compris) en « champ → règles ». */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): ValidationDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, rules: Object.keys(error.constraints) }] : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

/**
 * Erreur de validation au format de l'API : les règles enfreintes sont renvoyées par nom
 * (isEmail, minLength…), jamais avec la valeur saisie. Le frontend affiche les messages traduits.
 */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    code: ERROR_CODES.VALIDATION_FAILED,
    details: flattenValidationErrors(errors),
  });
}
