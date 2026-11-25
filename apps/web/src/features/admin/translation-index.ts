import { CATALOGS, listKeys, type MessageTree, type Namespace } from '@opportinities/i18n';

/** Nombre maximal de lignes affichées pour une recherche (au-delà : préciser la recherche). */
export const TRANSLATION_RESULT_LIMIT = 200;

export interface TranslationRow {
  namespace: Namespace;
  key: string;
  fr: string | null;
  en: string | null;
}

export interface NamespaceSummary {
  namespace: Namespace;
  keys: number;
  missingFr: number;
  missingEn: number;
}

function valueAt(tree: MessageTree, path: string): string | null {
  let node: MessageTree | string | undefined = tree;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return null;
    node = node[part];
  }
  return typeof node === 'string' ? node : null;
}

/** Toutes les clés de toutes les langues, une ligne par clé (une langue peut en manquer). */
export function translationRows(): TranslationRow[] {
  const namespaces = Object.keys(CATALOGS.fr) as Namespace[];
  return namespaces.flatMap((namespace) => {
    const fr: MessageTree = CATALOGS.fr[namespace];
    const en: MessageTree = CATALOGS.en[namespace];
    const keys = [...new Set([...listKeys(fr), ...listKeys(en)])].sort();
    return keys.map((key) => ({ namespace, key, fr: valueAt(fr, key), en: valueAt(en, key) }));
  });
}

export function summarize(rows: TranslationRow[]): NamespaceSummary[] {
  const byNamespace = new Map<Namespace, NamespaceSummary>();
  for (const row of rows) {
    const summary = byNamespace.get(row.namespace) ?? {
      namespace: row.namespace,
      keys: 0,
      missingFr: 0,
      missingEn: 0,
    };
    summary.keys += 1;
    if (row.fr === null) summary.missingFr += 1;
    if (row.en === null) summary.missingEn += 1;
    byNamespace.set(row.namespace, summary);
  }
  return [...byNamespace.values()];
}

/** Sans accents ni casse, pour chercher « echec » dans « Échec ». */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Filtre par espace, texte (clé, français ou anglais) et textes manquants. */
export function searchTranslations(
  rows: TranslationRow[],
  filter: { q?: string; namespace?: string; missing?: boolean },
): TranslationRow[] {
  const terms = normalize(filter.q ?? '')
    .split(/\s+/)
    .filter(Boolean);
  return rows.filter((row) => {
    if (filter.namespace && row.namespace !== filter.namespace) return false;
    if (filter.missing && row.fr !== null && row.en !== null) return false;
    if (terms.length === 0) return true;
    const haystack = normalize(`${row.namespace}.${row.key} ${row.fr ?? ''} ${row.en ?? ''}`);
    return terms.every((term) => haystack.includes(term));
  });
}
