export type MessageTree = { readonly [key: string]: string | MessageTree };
export type MessageParams = Readonly<Record<string, string | number>>;

/**
 * Résout une clé pointée (« verifyEmail.subject ») et remplace les paramètres simples `{nom}`.
 * Syntaxe compatible avec le format ICU utilisé par next-intl côté interface.
 * Une clé absente lève une erreur : un texte manquant doit être détecté par les tests, pas affiché.
 */
export function translate(messages: MessageTree, key: string, params: MessageParams = {}): string {
  let node: string | MessageTree | undefined = messages;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') {
    throw new Error(`Clé de traduction introuvable : ${key}`);
  }

  return node.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Paramètre manquant « ${name} » pour la clé ${key}`);
    }
    return String(value);
  });
}

/** Liste toutes les clés terminales d'un catalogue (contrôle de parité entre langues). */
export function listKeys(messages: MessageTree, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : listKeys(value, path);
  });
}
