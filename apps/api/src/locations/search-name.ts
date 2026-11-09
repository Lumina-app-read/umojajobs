/**
 * Forme normalisée utilisée pour la recherche de villes : minuscules, sans accents ni ponctuation.
 * Exemple : « Lubumbashi », « LUBUMBASHI » et « lubúmbashi » donnent « lubumbashi ».
 * Utilisée à l'écriture (seed, ajout par l'administration) et à la lecture (requête de recherche).
 */
export function toSearchName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}
