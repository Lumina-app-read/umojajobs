import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { listKeys, type MessageTree, translate } from './translate';

const load = (locale: string, namespace: string): MessageTree =>
  JSON.parse(
    readFileSync(join(__dirname, 'locales', locale, `${namespace}.json`), 'utf8'),
  ) as MessageTree;

test('les catalogues fr et en ont exactement les mêmes clés', () => {
  for (const namespace of ['emails']) {
    assert.deepEqual(
      listKeys(load('fr', namespace)).sort(),
      listKeys(load('en', namespace)).sort(),
    );
  }
});

test('les paramètres sont identiques dans les deux langues', () => {
  const fr = load('fr', 'emails');
  const en = load('en', 'emails');
  const params = (tree: MessageTree, key: string) =>
    [...translateRaw(tree, key).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of listKeys(fr)) {
    assert.deepEqual(params(fr, key), params(en, key), key);
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
