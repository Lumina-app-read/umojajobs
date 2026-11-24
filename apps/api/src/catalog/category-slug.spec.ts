import { categorySlug } from './category-slug';

describe('categorySlug', () => {
  it.each([
    ['Agriculture & Agri-food', 'agriculture-agri-food'],
    ['Énergies renouvelables', 'energies-renouvelables'],
    ['  IT / Télécoms  ', 'it-telecoms'],
    ['!!!', 'category'],
  ])('%s devient %s', (name, expected) => {
    expect(categorySlug(name, new Set())).toBe(expected);
  });

  it('ajoute un suffixe si l’identifiant est déjà pris', () => {
    expect(categorySlug('Sales', new Set(['sales', 'sales-2']))).toBe('sales-3');
  });

  it('reste court, même pour un nom très long', () => {
    expect(categorySlug('mot '.repeat(60), new Set()).length).toBeLessThanOrEqual(72);
  });
});
