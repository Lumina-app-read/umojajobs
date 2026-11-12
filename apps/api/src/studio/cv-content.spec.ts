import { emptyCv } from '@opportinities/shared';
import { normalizeCv } from './cv-content';

describe('normalizeCv', () => {
  it('conserve un CV valide et écarte les champs inconnus', () => {
    const cv = emptyCv({ fullName: '  Awa Diallo ', countryIso2: 'sn' });
    const { content, issues } = normalizeCv({
      ...cv,
      intrus: 'supprimé',
      experiences: [
        {
          id: 'e1',
          role: 'Comptable',
          organization: 'Logistique Ouest',
          location: 'Dakar',
          startDate: '2021-03',
          endDate: '2024-01',
          current: true,
          description: 'Tenue des comptes.\nClôtures mensuelles.',
        },
      ],
      skills: ['Excel', ' ', 'SYSCOHADA'],
    });
    expect(issues).toEqual([]);
    expect(content.personal.fullName).toBe('Awa Diallo');
    expect(content.personal.countryIso2).toBe('SN');
    expect(content.experiences[0]?.endDate).toBe('');
    expect(content.experiences[0]?.description).toContain('\n');
    expect(content.skills).toEqual(['Excel', 'SYSCOHADA']);
    expect(content).not.toHaveProperty('intrus');
  });

  it('signale les formats invalides avec leur chemin', () => {
    const { issues } = normalizeCv({
      personal: { email: 'pas-un-email', countryIso2: 'FR' },
      education: [{ id: 'x', startDate: '2021-13' }],
      languages: [{ id: 'l', name: 'Wolof', level: 'parfait' }],
      projects: [{ id: 'p', url: 'javascript:alert(1)' }],
    });
    expect(issues.map((issue) => issue.field)).toEqual([
      'personal.countryIso2',
      'personal.email',
      'education.0.startDate',
      'languages.0.level',
      'projects.0.url',
    ]);
  });

  it('borne les listes et les textes', () => {
    const { content, issues } = normalizeCv({
      skills: Array.from({ length: 50 }, (_, index) => `Compétence ${index}`),
      personal: { summary: 'x'.repeat(2_000) },
    });
    expect(content.skills).toHaveLength(40);
    expect(content.personal.summary).toHaveLength(1_500);
    expect(issues.map((issue) => issue.rule)).toEqual(['maxLength', 'arrayMaxSize']);
  });
});
