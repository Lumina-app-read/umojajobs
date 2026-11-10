import {
  CONTRACT_TYPES,
  EDUCATION_LEVELS,
  EXPERIENCE_LEVELS,
  JOB_OFFER_STATUSES,
  JOB_SOURCE_TYPES,
  SALARY_PERIODS,
  WORK_MODES,
} from '@opportinities/shared';
import {
  ContractType,
  EducationLevel,
  ExperienceLevel,
  JobOfferStatus,
  JobSourceType,
  SalaryPeriod,
  WorkMode,
} from '../generated/prisma/client';
import {
  canTransition,
  checkValidityDates,
  duplicateKey,
  missingSubmissionFields,
  parseDateOnly,
  statusAfterApproval,
  type SubmissionFields,
  todayInTimezone,
  validityWindow,
} from './job-offer-rules';

describe('valeurs partagées alignées sur la base', () => {
  it.each([
    ['statuts', JOB_OFFER_STATUSES, JobOfferStatus],
    ['contrats', CONTRACT_TYPES, ContractType],
    ['modes de travail', WORK_MODES, WorkMode],
    ['niveaux d’études', EDUCATION_LEVELS, EducationLevel],
    ['expérience', EXPERIENCE_LEVELS, ExperienceLevel],
    ['périodes de salaire', SALARY_PERIODS, SalaryPeriod],
    ['sources', JOB_SOURCE_TYPES, JobSourceType],
  ])('%s', (_label, shared, prismaEnum) => {
    expect([...shared].sort()).toEqual(Object.values(prismaEnum).sort());
  });
});

describe('transitions de statut', () => {
  it('suit le circuit de modération', () => {
    expect(canTransition('draft', 'pending_review')).toBe(true);
    expect(canTransition('pending_review', 'active')).toBe(true);
    expect(canTransition('pending_review', 'needs_correction')).toBe(true);
    expect(canTransition('needs_correction', 'pending_review')).toBe(true);
  });

  it('interdit toute publication sans modération', () => {
    expect(canTransition('draft', 'active')).toBe(false);
    expect(canTransition('draft', 'scheduled')).toBe(false);
    expect(canTransition('needs_correction', 'active')).toBe(false);
  });

  it('une offre expirée ou archivée ne redevient jamais active', () => {
    expect(canTransition('expired', 'active')).toBe(false);
    expect(canTransition('archived', 'active')).toBe(false);
    expect(canTransition('rejected', 'active')).toBe(false);
  });

  it('programme une offre approuvée avant sa date de début', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    expect(statusAfterApproval(new Date('2026-11-12T00:00:00Z'), now)).toBe('scheduled');
    expect(statusAfterApproval(new Date('2026-11-10T00:00:00Z'), now)).toBe('active');
  });
});

describe('dates de validité', () => {
  it('refuse les dates impossibles', () => {
    expect(parseDateOnly('2026-02-31')).toBeNull();
    expect(parseDateOnly('31/12/2026')).toBeNull();
    expect(parseDateOnly('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it('interprète les dates dans le fuseau de l’offre (fin exclusive)', () => {
    // Kinshasa : UTC+1. Valable du 1er au 30 juin inclus, heure locale.
    const window = validityWindow('2026-06-01', '2026-06-30', 'Africa/Kinshasa');
    expect(window.startsAt.toISOString()).toBe('2026-05-31T23:00:00.000Z');
    expect(window.endsAt.toISOString()).toBe('2026-06-30T23:00:00.000Z');
    // Nairobi : UTC+3.
    expect(validityWindow('2026-06-01', '2026-06-01', 'Africa/Nairobi').endsAt.toISOString()).toBe(
      '2026-06-01T21:00:00.000Z',
    );
  });

  it('calcule « aujourd’hui » dans le fuseau, pas en UTC', () => {
    const lateEvening = new Date('2026-06-30T22:30:00Z');
    expect(todayInTimezone(lateEvening, 'Africa/Abidjan')).toBe('2026-06-30');
    expect(todayInTimezone(lateEvening, 'Africa/Nairobi')).toBe('2026-07-01');
  });

  it('signale les incohérences', () => {
    const now = new Date('2026-11-10T09:00:00Z');
    expect(checkValidityDates('2026-11-10', '2026-12-31', 'Africa/Dakar', now)).toBeNull();
    expect(checkValidityDates('2026-12-31', '2026-11-30', 'Africa/Dakar', now)).toBe(
      'end_before_start',
    );
    expect(checkValidityDates('2026-10-01', '2026-11-09', 'Africa/Dakar', now)).toBe(
      'already_ended',
    );
    expect(checkValidityDates('2026-11-10', '2028-01-01', 'Africa/Dakar', now)).toBe('too_long');
    expect(checkValidityDates('2026-11-10', '2026-13-01', 'Africa/Dakar', now)).toBe('invalid');
  });
});

describe('empreinte des doublons', () => {
  it('ignore la casse, les accents et la ponctuation', () => {
    expect(duplicateKey('Société Générale', 'Comptable confirmé', 'sn')).toBe(
      duplicateKey('SOCIETE GENERALE', '  comptable  confirme ', 'SN'),
    );
  });

  it('distingue le pays', () => {
    expect(duplicateKey('Orange', 'Analyste', 'SN')).not.toBe(
      duplicateKey('Orange', 'Analyste', 'CI'),
    );
  });
});

describe('complétude avant soumission', () => {
  const complete: SubmissionFields = {
    title: 'Comptable',
    companyName: 'Entreprise',
    countryIso2: 'SN',
    categoryId: 'k',
    contractType: 'permanent',
    workMode: 'on_site',
    description: 'Description',
    startDate: '2026-11-10',
    endDate: '2026-12-10',
    sourceType: 'company_website',
    applicationInstructions: null,
    applicationEmail: 'rh@example.com',
    applicationUrl: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
  };

  it('accepte une offre complète avec un seul moyen de candidater', () => {
    expect(missingSubmissionFields(complete)).toEqual([]);
  });

  it('exige au moins un moyen de candidater', () => {
    expect(missingSubmissionFields({ ...complete, applicationEmail: null })).toEqual([
      'applicationInstructions',
    ]);
  });

  it('exige la devise et la période d’un salaire indiqué', () => {
    expect(missingSubmissionFields({ ...complete, salaryMin: '250000' })).toEqual([
      'salaryCurrency',
      'salaryPeriod',
    ]);
  });

  it('liste les champs vides ou composés d’espaces', () => {
    expect(missingSubmissionFields({ ...complete, title: '  ', categoryId: null })).toEqual([
      'title',
      'categoryId',
    ]);
  });
});
