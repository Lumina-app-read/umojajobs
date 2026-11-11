import { CREDIT_SERVICES, FINANCIAL_SETTING_KEYS } from '@opportinities/shared';
import { CreditService, FinancialSettingKey, Prisma } from '../generated/prisma/client';
import { allocateFifo, commissionAmount, parseSettingValue, sumUsd } from './finance-rules';

const d = (value: string) => new Prisma.Decimal(value);

describe('énumérations financières', () => {
  it('sont alignées entre le package partagé et la base', () => {
    expect([...FINANCIAL_SETTING_KEYS].sort()).toEqual(Object.values(FinancialSettingKey).sort());
    expect([...CREDIT_SERVICES].sort()).toEqual(Object.values(CreditService).sort());
  });
});

describe('parseSettingValue', () => {
  it('accepte un montant USD positif avec six décimales au plus', () => {
    expect(parseSettingValue('credit_unit_value_usd', '0.10')?.toString()).toBe('0.1');
    expect(parseSettingValue('withdrawal_min_usd', '10')?.toString()).toBe('10');
    expect(parseSettingValue('credit_unit_value_usd', '0')).toBeNull();
    expect(parseSettingValue('credit_unit_value_usd', '0.1234567')).toBeNull();
    expect(parseSettingValue('credit_unit_value_usd', '-1')).toBeNull();
    expect(parseSettingValue('credit_unit_value_usd', '1e3')).toBeNull();
  });

  it('borne un taux entre 0 exclu et 1 inclus', () => {
    expect(parseSettingValue('contributor_commission_rate', '0.30')?.toString()).toBe('0.3');
    expect(parseSettingValue('contributor_commission_rate', '1')?.toString()).toBe('1');
    expect(parseSettingValue('contributor_commission_rate', '1.01')).toBeNull();
    expect(parseSettingValue('contributor_commission_rate', '0')).toBeNull();
  });

  it('exige un nombre entier de jours, 365 au plus', () => {
    expect(parseSettingValue('commission_hold_days', '14')?.toString()).toBe('14');
    expect(parseSettingValue('commission_hold_days', '0')?.toString()).toBe('0');
    expect(parseSettingValue('commission_hold_days', '14.5')).toBeNull();
    expect(parseSettingValue('commission_hold_days', '366')).toBeNull();
  });
});

describe('allocateFifo', () => {
  const lots = [
    { id: 'ancien', creditsRemaining: 3, creditUnitValueUsd: d('0.10') },
    { id: 'vide', creditsRemaining: 0, creditUnitValueUsd: d('0.10') },
    { id: 'récent', creditsRemaining: 10, creditUnitValueUsd: d('0.12') },
  ];

  it('consomme le lot le plus ancien en premier, avec la valeur figée de chaque lot', () => {
    const allocations = allocateFifo(lots, 5);
    expect(allocations?.map((a) => [a.lotId, a.credits, a.valueUsd.toFixed(6)])).toEqual([
      ['ancien', 3, '0.300000'],
      ['récent', 2, '0.240000'],
    ]);
    expect(sumUsd(allocations!.map((a) => a.valueUsd)).toFixed(6)).toBe('0.540000');
  });

  it('refuse une quantité non couverte ou invalide', () => {
    expect(allocateFifo(lots, 14)).toBeNull();
    expect(allocateFifo(lots, 0)).toBeNull();
    expect(allocateFifo(lots, 1.5)).toBeNull();
  });

  it('calcule exactement, sans erreur d’arrondi flottant', () => {
    const tenths = [{ id: 'lot', creditsRemaining: 3, creditUnitValueUsd: d('0.1') }];
    expect(allocateFifo(tenths, 3)?.[0]?.valueUsd.toFixed(6)).toBe('0.300000');
  });
});

describe('commissionAmount', () => {
  it('applique le taux et arrondit vers le bas à six décimales', () => {
    expect(commissionAmount(d('0.50'), d('0.30')).toFixed(6)).toBe('0.150000');
    expect(commissionAmount(d('0.40'), d('0.30')).toFixed(6)).toBe('0.120000');
    expect(commissionAmount(d('0.000007'), d('0.30')).toFixed(6)).toBe('0.000002');
  });
});
