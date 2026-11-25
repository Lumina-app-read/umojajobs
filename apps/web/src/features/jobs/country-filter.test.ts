import { describe, expect, it } from 'vitest';
import {
  countryQuery,
  countryScope,
  parseCountryParam,
  resolveCountries,
  serializeCountryPreference,
} from './country-filter';
import { queryString } from './routes';

describe('pays des offres', () => {
  it('lit un pays, plusieurs pays ou « tous les pays » dans l’adresse', () => {
    expect(parseCountryParam('cd')).toEqual({ explicit: true, countries: ['CD'] });
    expect(parseCountryParam(['CD', 'SN', 'CD'])).toEqual({
      explicit: true,
      countries: ['CD', 'SN'],
    });
    expect(parseCountryParam('all')).toEqual({ explicit: true, countries: [] });
    expect(parseCountryParam(['xx1', ''])).toBeNull();
    expect(parseCountryParam(undefined)).toBeNull();
  });

  it('espace connecté : adresse, puis préférence mémorisée, puis pays du profil', () => {
    expect(resolveCountries({ param: undefined, homeCountry: 'CD' })).toEqual({
      explicit: false,
      countries: ['CD'],
    });
    expect(
      resolveCountries({ param: undefined, preference: 'SN%2CCI', homeCountry: 'CD' }),
    ).toEqual({
      explicit: true,
      countries: ['SN', 'CI'],
    });
    expect(
      resolveCountries({ param: undefined, preference: 'all', homeCountry: 'CD' }).countries,
    ).toEqual([]);
    expect(
      resolveCountries({ param: 'GA', preference: 'SN', homeCountry: 'CD' }).countries,
    ).toEqual(['GA']);
    expect(
      resolveCountries({ param: undefined, preference: '%E0%A4', homeCountry: 'CD' }).countries,
    ).toEqual(['CD']);
  });

  it('site public : tous les pays par défaut, sans lire la préférence', () => {
    expect(resolveCountries({ param: undefined, preference: 'SN' })).toEqual({
      explicit: false,
      countries: [],
    });
  });

  it('déduit le mode affiché et la valeur à mettre dans l’adresse', () => {
    expect(countryScope([], 'CD')).toBe('all');
    expect(countryScope(['CD'], 'CD')).toBe('mine');
    expect(countryScope(['CD', 'SN'], 'CD')).toBe('custom');
    expect(countryScope(['SN'], null)).toBe('custom');
    expect(countryQuery([])).toEqual(['all']);
    expect(serializeCountryPreference([])).toBe('all');
    expect(serializeCountryPreference(['cd', 'SN'])).toBe('CD,SN');
  });

  it('conserve les pays répétés lors d’une redirection', () => {
    expect(queryString({ country: ['CD', 'SN'], q: 'comptable' })).toBe(
      '?country=CD&country=SN&q=comptable',
    );
  });
});
