import { toSearchName } from './search-name';

describe('toSearchName', () => {
  it.each([
    ['Lubumbashi', 'lubumbashi'],
    ['LUBUMBASHI', 'lubumbashi'],
    ['Lubúmbashi', 'lubumbashi'],
    ['Saint-Louis', 'saint louis'],
    ["N'Djamena", 'n djamena'],
    ['  Bobo-Dioulasso  ', 'bobo dioulasso'],
    ['São Tomé', 'sao tome'],
  ])('normalise « %s » en « %s »', (input, expected) => {
    expect(toSearchName(input)).toBe(expected);
  });

  it('renvoie une chaîne vide pour une saisie sans lettre ni chiffre', () => {
    expect(toSearchName(' -- ')).toBe('');
  });
});
