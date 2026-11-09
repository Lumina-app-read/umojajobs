import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { listKeys, type MessageTree, translate } from './translate';

const NAMESPACES = ['common', 'auth', 'errors', 'validation', 'emails'];

const load = (locale: string, namespace: string): MessageTree =>
  JSON.parse(
    readFileSync(join(__dirname, 'locales', locale, `${namespace}.json`), 'utf8'),
  ) as MessageTree;

test('les catalogues fr et en ont exactement les mêmes clés', () => {
  for (const namespace of NAMESPACES) {
    assert.deepEqual(
      listKeys(load('fr', namespace)).sort(),
      listKeys(load('en', namespace)).sort(),
    );
  }
});

test('les paramètres et balises sont identiques dans les deux langues', () => {
  const tokens = (tree: MessageTree, key: string) =>
    [...translateRaw(tree, key).matchAll(/\{(\w+)[,}]|<(\w+)>/g)].map((m) => m[1] ?? m[2]).sort();
  for (const namespace of NAMESPACES) {
    const fr = load('fr', namespace);
    const en = load('en', namespace);
    for (const key of listKeys(fr)) {
      assert.deepEqual(tokens(fr, key), tokens(en, key), `${namespace}.${key}`);
    }
  }
});

test('aucun message vide', () => {
  for (const namespace of NAMESPACES) {
    for (const locale of ['fr', 'en']) {
      const tree = load(locale, namespace);
      for (const key of listKeys(tree)) {
        assert.ok(translateRaw(tree, key).trim().length > 0, `${locale}.${namespace}.${key}`);
      }
    }
  }
});

test('remplace les paramètres', () => {
  assert.equal(translate({ a: { b: 'Bonjour {name}' } }, 'a.b', { name: 'Awa' }), 'Bonjour Awa');
});

test('signale une clé ou un paramètre manquant', () => {
  assert.throws(() => translate({ a: 'x' }, 'b'), /introuvable/);
  assert.throws(() => translate({ a: '{x}' }, 'a'), /manquant/);
});

function translateRaw(tree: MessageTree, key: string): string {
  let node: string | MessageTree | undefined = tree;
  for (const part of key.split('.')) node = typeof node === 'object' ? node[part] : undefined;
  return typeof node === 'string' ? node : '';
}
