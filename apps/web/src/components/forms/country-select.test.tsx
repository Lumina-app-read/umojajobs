import { AFRICAN_COUNTRIES, type CountryResponse, flagEmoji } from '@opportinities/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render';
import { CountrySelect, filterCountries, normalizeSearch } from './country-select';

const COUNTRIES: CountryResponse[] = AFRICAN_COUNTRIES.map((country) => ({
  ...country,
  flagEmoji: flagEmoji(country.iso2),
}));

function Harness({ onChange }: { onChange: (iso2: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <CountrySelect
      countries={COUNTRIES}
      label="Pays de résidence"
      value={value}
      onChange={(iso2) => {
        setValue(iso2);
        onChange(iso2);
      }}
    />
  );
}

describe('recherche de pays', () => {
  it('ignore les accents, la casse et la ponctuation', () => {
    expect(normalizeSearch("Côte d'Ivoire")).toBe('cote d ivoire');
  });

  it('trouve un pays par son nom français, anglais, code ISO ou indicatif', () => {
    expect(filterCountries(COUNTRIES, 'cote').map((c) => c.iso2)).toEqual(['CI']);
    expect(filterCountries(COUNTRIES, 'ivory').map((c) => c.iso2)).toEqual([]);
    expect(filterCountries(COUNTRIES, 'south africa').map((c) => c.iso2)).toEqual(['ZA']);
    expect(filterCountries(COUNTRIES, 'afrique du sud').map((c) => c.iso2)).toEqual(['ZA']);
    expect(filterCountries(COUNTRIES, '+243').map((c) => c.iso2)).toEqual(['CD']);
    expect(filterCountries(COUNTRIES, 'sen').map((c) => c.iso2)).toContain('SN');
    expect(filterCountries(COUNTRIES, '')).toHaveLength(54);
  });
});

describe('CountrySelect', () => {
  it('filtre à la saisie et sélectionne un pays au clavier', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<Harness onChange={onChange} />);

    const input = screen.getByRole('combobox', { name: 'Pays de résidence' });
    await user.type(input, 'cote');
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Côte d'Ivoire");
    expect(options[0]).toHaveTextContent('+225');

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('CI');
    expect(input).toHaveValue(`${flagEmoji('CI')} Côte d'Ivoire`);
  });

  it('affiche un message lorsqu’aucun pays ne correspond', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness onChange={vi.fn()} />);
    await user.type(screen.getByRole('combobox'), 'france');
    expect(
      await screen.findByText('Aucun pays ne correspond à votre recherche.'),
    ).toBeInTheDocument();
  });

  it('affiche les noms dans la langue de l’interface', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness onChange={vi.fn()} />, 'en');
    await user.type(screen.getByRole('combobox'), 'sudan');
    const names = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(names.some((name) => name?.includes('South Sudan'))).toBe(true);
  });
});
