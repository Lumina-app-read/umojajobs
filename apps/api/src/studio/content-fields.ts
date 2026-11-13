/** Erreur de validation localisée par chemin (« experiences.2.role »). */
export interface ContentIssue {
  field: string;
  rule: string;
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE = /^\+?[0-9 ().-]{6,25}$/;

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Lecture des champs texte d'un document reçu du navigateur, commune au CV et aux lettres :
 * caractères de contrôle supprimés (retours à la ligne conservés), longueur et format contrôlés,
 * chaque écart consigné dans `issues`. Un champ absent devient une chaîne vide.
 */
export function fieldReader(issues: ContentIssue[]) {
  const text = (value: unknown, field: string, max: number): string => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') {
      issues.push({ field, rule: 'isString' });
      return '';
    }
    const cleaned = [...value]
      .filter((char) => {
        const code = char.charCodeAt(0);
        return code >= 32 || code === 10 || code === 9;
      })
      .join('')
      .trim();
    if (cleaned.length > max) issues.push({ field, rule: 'maxLength' });
    return cleaned.slice(0, max);
  };
  const pattern = (value: unknown, field: string, re: RegExp, max = 120): string => {
    const result = text(value, field, max);
    if (result && !re.test(result)) issues.push({ field, rule: 'matches' });
    return result;
  };
  return { text, pattern };
}
