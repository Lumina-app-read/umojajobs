import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { formatDateValue, today } from '@/lib/calendar';
import { renderWithIntl } from '@/test/render';
import { DatePicker } from './date-picker';

function Harness({
  initial = '',
  precision = 'day',
  onChange,
  required,
  min,
}: {
  initial?: string;
  precision?: 'day' | 'month';
  onChange?: (value: string) => void;
  required?: boolean;
  min?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DatePicker
      label="Date de début"
      name="startDate"
      placeholder="Choisir la date"
      precision={precision}
      value={value}
      required={required}
      min={min}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('DatePicker', () => {
  it('choisit l’année, puis le mois, puis le jour, sans rien taper', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Date de début' }));
    await user.click(screen.getByRole('button', { name: 'Choisir le mois et l’année' }));
    await user.click(screen.getByRole('button', { name: 'Choisir l’année' }));
    await user.click(screen.getByRole('option', { name: '2019' }));
    await user.click(screen.getByRole('button', { name: 'mars' }));
    await user.click(screen.getByRole('gridcell', { name: 'vendredi 15 mars 2019' }));

    expect(onChange).toHaveBeenLastCalledWith('2019-03-15');
    expect(screen.getByRole('button', { name: 'Date de début' })).toHaveTextContent('15 mars 2019');
    expect(document.querySelector('input[name="startDate"]')).toHaveValue('2019-03-15');
  });

  it('précision mois (CV) : la valeur reste au format AAAA-MM', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<Harness precision="month" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Date de début' }));
    await user.click(screen.getByRole('option', { name: '2021' }));
    await user.click(screen.getByRole('button', { name: 'sept.' }));

    expect(onChange).toHaveBeenLastCalledWith('2021-09');
    expect(screen.getByRole('button', { name: 'Date de début' })).toHaveTextContent(
      'septembre 2021',
    );
  });

  it('propose la date du jour et permet d’effacer une date facultative', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<Harness initial="2020-05-04" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Date de début' }));
    await user.click(screen.getByRole('button', { name: 'Aujourd’hui' }));
    expect(onChange).toHaveBeenLastCalledWith(formatDateValue(today(), 'day'));

    await user.click(screen.getByRole('button', { name: 'Date de début' }));
    await user.click(screen.getByRole('button', { name: 'Effacer' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('une date obligatoire ne peut pas être effacée', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness initial="2020-05-04" required />);
    await user.click(screen.getByRole('button', { name: 'Date de début' }));
    expect(screen.queryByRole('button', { name: 'Effacer' })).toBeNull();
  });

  it('conserve et affiche une ancienne valeur saisie librement', () => {
    renderWithIntl(<Harness initial="1er mars 2021" />);
    expect(screen.getByRole('button', { name: 'Date de début' })).toHaveTextContent(
      '1er mars 2021',
    );
    expect(document.querySelector('input[name="startDate"]')).toHaveValue('1er mars 2021');
  });

  it('désactive les jours avant la borne minimale', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness initial="2026-03-20" min="2026-03-10" />);
    await user.click(screen.getByRole('button', { name: 'Date de début' }));
    expect(screen.getByRole('gridcell', { name: 'lundi 9 mars 2026' })).toBeDisabled();
    expect(screen.getByRole('gridcell', { name: 'mardi 10 mars 2026' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Mois précédent' })).toBeDisabled();
  });

  it('se navigue au clavier dans la grille des jours', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<Harness initial="2026-03-20" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Date de début' }));
    await user.keyboard('{ArrowRight}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('2026-03-28');
  });

  it('s’affiche en anglais', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness initial="2026-03-20" />, 'en');
    expect(screen.getByRole('button', { name: 'Date de début' })).toHaveTextContent(
      'March 20, 2026',
    );
    await user.click(screen.getByRole('button', { name: 'Date de début' }));
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
  });
});
