import { uuidv7 } from './uuid-v7';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv7', () => {
  it('respecte le format UUID version 7', () => {
    for (let index = 0; index < 100; index += 1) {
      expect(uuidv7()).toMatch(UUID_V7);
    }
  });

  it("encode l'horodatage dans les 48 premiers bits", () => {
    const timestamp = Date.UTC(2026, 10, 9, 12, 0, 0);
    const id = uuidv7(timestamp);
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(timestamp);
  });

  it("se trie dans l'ordre chronologique", () => {
    const earlier = uuidv7(1_000);
    const later = uuidv7(2_000);
    expect(earlier < later).toBe(true);
  });

  it('produit des identifiants uniques', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(1_000)));
    expect(ids.size).toBe(1000);
  });
});
