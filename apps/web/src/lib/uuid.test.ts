import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUuid } from './uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomUuid', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('utilise crypto.randomUUID quand il existe', () => {
    expect(randomUuid()).toMatch(UUID_V4);
  });

  it('produit un UUID v4 valide hors contexte sécurisé (sans crypto.randomUUID)', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    const ids = new Set(Array.from({ length: 50 }, () => randomUuid()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});
