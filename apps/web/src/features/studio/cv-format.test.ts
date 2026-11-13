import { emptyCv } from '@opportinities/shared';
import { describe, expect, it } from 'vitest';
import { type CvLabels, formatPeriod, splitDescription } from './cv-format';
import { validateCv } from './cv-validation';

const labels = {
  present: "Aujourd'hui",
  months: { '03': 'mars', '11': 'nov.' },
} as unknown as CvLabels;

describe('Career Studio : mise en forme du CV', () => {
  it('formate une période, y compris le poste actuel', () => {
    expect(formatPeriod('2021-03', '2024-11', false, labels)).toBe('mars 2021 - nov. 2024');
    expect(formatPeriod('2021-03', '', true, labels)).toBe("mars 2021 - Aujourd'hui");
    expect(formatPeriod('', '', false, labels)).toBe('');
  });

  it('transforme les lignes commençant par un tiret en puces', () => {
    expect(splitDescription('Tenue des comptes\n- Clôture mensuelle\n• Paie')).toEqual({
      paragraphs: ['Tenue des comptes'],
      bullets: ['Clôture mensuelle', 'Paie'],
    });
  });

  it('signale les champs mal formés avant l’enregistrement', () => {
    const cv = emptyCv({ email: 'awa@', phone: '12' });
    cv.experiences.push({
      id: 'e1',
      role: 'Comptable',
      organization: '',
      location: '',
      startDate: '2024-13',
      endDate: 'n/a',
      current: true,
      description: '',
    });
    cv.projects.push({ id: 'p1', name: 'Paie', description: '', url: 'exemple.com' });
    expect(validateCv(cv)).toEqual({
      'personal.email': 'email',
      'personal.phone': 'phone',
      'experiences.0.startDate': 'month',
      'projects.0.url': 'url',
    });
  });
});
