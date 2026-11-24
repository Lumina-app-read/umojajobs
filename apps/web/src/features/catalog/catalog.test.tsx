import { type AdminCategory, type AdminCountry } from '@opportinities/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCsrfToken } from '@/lib/api/client';
import { jsonResponse, renderWithIntl } from '@/test/render';
import { CategoryManager } from './category-manager';
import { CountryManager } from './country-manager';

const category = (id: string, nameFr: string): AdminCategory => ({
  id,
  slug: id,
  nameFr,
  nameEn: `${nameFr} EN`,
  isActive: true,
  offers: 2,
});
const country = (iso2: string, nameFr: string): AdminCountry => ({
  iso2,
  nameFr,
  nameEn: nameFr,
  flagEmoji: '',
  dialCode: '+221',
  currencyCode: 'XOF',
  isActive: true,
  users: 1,
  offers: 0,
});
const body = (mock: { mock: { calls: unknown[][] } }) =>
  JSON.parse(String((mock.mock.calls[0]?.[1] as RequestInit).body)) as unknown;

describe('CategoryManager', () => {
  beforeEach(() => {
    setCsrfToken('jeton');
    vi.restoreAllMocks();
  });

  it('envoie l’ordre complet après un déplacement', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { categories: [], countries: [] }));
    renderWithIntl(<CategoryManager initial={[category('a', 'Vente'), category('b', 'Santé')]} />);
    expect(screen.getByRole('button', { name: 'Monter Vente' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Monter Santé' }));
    expect(body(fetchMock)).toEqual({ ids: ['b', 'a'] });
  });

  it('exige les deux noms avant d’ajouter', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { categories: [], countries: [] }));
    renderWithIntl(<CategoryManager initial={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une catégorie' }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Nom en français'), 'Énergie');
    await userEvent.click(dialog.getByRole('button', { name: 'Enregistrer' }));
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.type(dialog.getByLabelText('Nom en anglais'), 'Energy');
    await userEvent.click(dialog.getByRole('button', { name: 'Enregistrer' }));
    expect(body(fetchMock)).toEqual({ nameFr: 'Énergie', nameEn: 'Energy' });
  });
});

describe('CountryManager', () => {
  beforeEach(() => {
    setCsrfToken('jeton');
    vi.restoreAllMocks();
  });

  it('cherche sans tenir compte des accents et confirme avant de désactiver', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { categories: [], countries: [] }));
    renderWithIntl(<CountryManager initial={[country('SN', 'Sénégal'), country('ML', 'Mali')]} />);
    await userEvent.type(screen.getByRole('searchbox'), 'senegal');
    expect(screen.queryByText('Mali')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Désactiver Sénégal' }));
    expect(fetchMock).not.toHaveBeenCalled();
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Désactiver' }));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/admin/catalog/countries/SN');
    expect(body(fetchMock)).toEqual({ isActive: false });
  });
});
