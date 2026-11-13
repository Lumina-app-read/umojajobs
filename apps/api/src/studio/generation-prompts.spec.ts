import { emptyCv, emptyLetter, type CvContent, type LetterContent } from '@opportinities/shared';
import {
  documentPrompt,
  mergeDocument,
  missingForGeneration,
  parseText,
  sectionAvailable,
  tidy,
} from './generation-prompts';

const cv = (): CvContent => {
  const content = emptyCv({ fullName: 'Awa Diallo', email: 'awa@example.com' });
  content.experiences = [
    {
      id: 'e1',
      role: 'Comptable',
      organization: 'Logistique Ouest SA',
      location: 'Dakar',
      startDate: '2021-03',
      endDate: '',
      current: true,
      description: 'compta générale, clôture de 10 à 5 jours',
    },
    {
      id: 'e2',
      role: 'Stagiaire',
      organization: 'Cabinet Ba',
      location: '',
      startDate: '2020-01',
      endDate: '2020-06',
      current: false,
      description: '',
    },
  ];
  content.skills = ['Excel', 'SYSCOHADA', 'Paie'];
  return content;
};

const letter = (): LetterContent =>
  emptyLetter(
    { fullName: 'Awa Diallo', email: 'awa@example.com', phone: '+221 77 123 45 67' },
    { salutation: 'Madame, Monsieur,', closing: 'Salutations.', subject: '' },
  );

describe('Career Studio : génération par l’IA (règles pures)', () => {
  it('exige les faits indispensables avant tout débit', () => {
    expect(missingForGeneration('cover_letter', letter(), {})).toEqual(['jobTitle']);
    expect(missingForGeneration('cover_letter', letter(), { jobTitle: 'Comptable' })).toEqual([]);
    expect(missingForGeneration('cv', emptyCv({ fullName: 'Awa' }), {})).toEqual(['experiences']);
  });

  it('n’envoie au modèle ni email ni téléphone, seulement les faits utiles au type', () => {
    const prompt = documentPrompt('cover_letter', 'fr', letter(), {
      jobTitle: 'Comptable',
      lastDay: '2026-12-31',
    });
    expect(prompt.user).not.toContain('awa@example.com');
    expect(prompt.user).not.toContain('+221');
    expect(prompt.user).toContain('Comptable');
    // « lastDay » ne concerne que la démission : il n'est pas transmis pour une motivation.
    expect(prompt.user).not.toContain('2026-12-31');
    expect(prompt.system).toContain('Language: French');
  });

  it('garde les faits de la lettre et écarte un chiffre inventé', () => {
    const content = letter();
    const { source } = documentPrompt('cover_letter', 'fr', content, { jobTitle: 'Comptable' });
    const ok = mergeDocument(
      'cover_letter',
      JSON.stringify({
        subject: 'Candidature',
        salutation: 'Madame,',
        body: 'Texte.',
        closing: 'Cordialement.',
      }),
      content,
      source,
    );
    expect(ok.rejection).toBeNull();
    expect((ok.content as LetterContent).sender).toEqual(content.sender);
    expect((ok.content as LetterContent).body).toBe('Texte.');

    const invented = mergeDocument(
      'cover_letter',
      JSON.stringify({ subject: 'Candidature', body: 'Hausse de 40 % du chiffre d’affaires.' }),
      content,
      source,
    );
    expect(invented.rejection).toBe('introduced_facts');
    expect(mergeDocument('cover_letter', 'pas du JSON', content, source).rejection).toBe(
      'invalid_format',
    );
  });

  it('ne rédige un CV qu’à partir des notes et refuse une compétence ajoutée', () => {
    const content = cv();
    const { source } = documentPrompt('cv', 'fr', content, { targetRole: 'Comptable' });
    const merged = mergeDocument(
      'cv',
      JSON.stringify({
        summary: 'Comptable rigoureuse.',
        experiences: [
          {
            id: 'e1',
            description: '- Tenir la comptabilité\n- Ramener la clôture de 10 à 5 jours',
          },
          { id: 'e2', description: '- Assister le cabinet' },
          { id: 'inconnu', description: '- Diriger une équipe' },
        ],
        skills: ['syscohada', 'Excel'],
      }),
      content,
      source,
    );
    expect(merged.rejection).toBeNull();
    const next = merged.content as CvContent;
    expect(next.experiences[0]?.description).toContain('10 à 5 jours');
    // Sans notes, aucune description n'est inventée.
    expect(next.experiences[1]?.description).toBe('');
    expect(next.experiences[1]?.organization).toBe('Cabinet Ba');
    expect(next.skills).toEqual(['SYSCOHADA', 'Excel', 'Paie']);

    const extraSkill = mergeDocument(
      'cv',
      JSON.stringify({ summary: 'Comptable.', skills: ['Excel', 'Python'] }),
      content,
      source,
    );
    expect(extraSkill.rejection).toBe('introduced_skill');
  });

  it('ne régénère qu’une section existante et contrôle son texte', () => {
    expect(sectionAvailable('cv', 'experience:e1', cv())).toBe(true);
    expect(sectionAvailable('cv', 'experience:e2', cv())).toBe(false);
    expect(sectionAvailable('cover_letter', 'body', letter())).toBe(true);
    expect(parseText(JSON.stringify({ text: 'Objet court' }), 200, 'source')).toEqual({
      text: 'Objet court',
      rejection: null,
    });
    expect(parseText(JSON.stringify({ text: 'x'.repeat(201) }), 200, 'source').text).toBeNull();
    expect(parseText(JSON.stringify({ text: 'Depuis 2019' }), 200, 'source').rejection).toBe(
      'introduced_facts',
    );
  });

  it('remplace les tirets longs par un tiret simple', () => {
    expect(
      tidy(`Comptable ${String.fromCharCode(0x2013)} offre ${String.fromCharCode(0x2014)} RH`),
    ).toBe('Comptable - offre - RH');
  });
});
