import { FINANCIAL_SETTING_UNITS, type FinancialSettingKey } from '@opportinities/shared';
import { Prisma } from '../generated/prisma/client';

const DECIMAL = /^\d{1,14}(\.\d{1,6})?$/;
const MAX_DAYS = 365;

/**
 * Valide la valeur saisie pour un paramètre financier. Retourne le décimal normalisé,
 * ou null si la valeur est refusée. Aucun nombre flottant n'intervient.
 */
export function parseSettingValue(key: FinancialSettingKey, raw: string): Prisma.Decimal | null {
  const text = raw.trim();
  if (!DECIMAL.test(text)) return null;
  const value = new Prisma.Decimal(text);
  switch (FINANCIAL_SETTING_UNITS[key]) {
    case 'usd':
      return value.gt(0) ? value : null;
    case 'rate':
      // Une part du contributeur : strictement positive et au plus 100 %.
      return value.gt(0) && value.lte(1) ? value : null;
    case 'days':
      return value.isInteger() && value.lte(MAX_DAYS) ? value : null;
  }
}

export interface LotBalance {
  id: string;
  creditsRemaining: number;
  creditUnitValueUsd: Prisma.Decimal;
}

export interface LotAllocation {
  lotId: string;
  credits: number;
  valueUsd: Prisma.Decimal;
}

/**
 * Consommation FIFO : les lots sont pris dans l'ordre fourni (du plus ancien au plus récent).
 * Chaque affectation porte la valeur interne du lot concerné (figée à son attribution).
 * Retourne null si les lots ne couvrent pas la quantité demandée.
 */
export function allocateFifo(lots: readonly LotBalance[], credits: number): LotAllocation[] | null {
  if (!Number.isInteger(credits) || credits <= 0) return null;
  const allocations: LotAllocation[] = [];
  let missing = credits;
  for (const lot of lots) {
    if (missing === 0) break;
    const taken = Math.min(lot.creditsRemaining, missing);
    if (taken <= 0) continue;
    allocations.push({
      lotId: lot.id,
      credits: taken,
      valueUsd: lot.creditUnitValueUsd.mul(taken),
    });
    missing -= taken;
  }
  return missing === 0 ? allocations : null;
}

/** Somme exacte de montants décimaux. */
export function sumUsd(values: readonly Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((total, value) => total.add(value), new Prisma.Decimal(0));
}

/**
 * Commission : base commissionnable × taux, arrondie à six décimales vers le bas
 * (la plateforme ne verse jamais plus que la part prévue).
 */
export function commissionAmount(base: Prisma.Decimal, rate: Prisma.Decimal): Prisma.Decimal {
  return base.mul(rate).toDecimalPlaces(6, Prisma.Decimal.ROUND_DOWN);
}
