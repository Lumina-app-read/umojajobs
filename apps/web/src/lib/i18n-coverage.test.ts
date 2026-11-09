import { CATALOGS, I18N_LOCALES } from '@opportinities/i18n';
import { ERROR_CODES, ROLE_CODES, SUPPORTED_LOCALES } from '@opportinities/shared';
import { describe, expect, it } from 'vitest';

describe('couverture des traductions', () => {
  it('les langues du catalogue correspondent aux langues de l’application', () => {
    expect([...I18N_LOCALES].sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it.each(I18N_LOCALES)('chaque code d’erreur de l’API est traduit (%s)', (locale) => {
    const errors = CATALOGS[locale].errors as Record<string, string>;
    for (const code of Object.values(ERROR_CODES)) {
      expect(errors[code], `${locale}: ${code}`).toBeTruthy();
    }
  });

  it.each(I18N_LOCALES)('chaque rôle est traduit (%s)', (locale) => {
    const roles = CATALOGS[locale].common.roles as Record<string, string>;
    for (const role of ROLE_CODES) {
      expect(roles[role], `${locale}: ${role}`).toBeTruthy();
    }
  });
});
