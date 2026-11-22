import { type Prisma } from '../generated/prisma/client';

export interface PackShare {
  credits: number;
  valueUsd: Prisma.Decimal;
}

/**
 * Répartit le débit d'un pack entre le CV et la lettre, au prorata de leurs tarifs séparés (à parts
 * égales si un tarif manque). Chaque part reçoit au moins un crédit et la somme est toujours exacte.
 */
export function splitPack(
  credits: number,
  valueUsd: Prisma.Decimal,
  cvCost: number | null,
  letterCost: number | null,
): [PackShare, PackShare] {
  if (!Number.isInteger(credits) || credits < 2) {
    throw new RangeError('Un pack vaut au moins deux crédits.');
  }
  const ratio = cvCost && letterCost ? cvCost / (cvCost + letterCost) : 0.5;
  const cvCredits = Math.min(credits - 1, Math.max(1, Math.round(credits * ratio)));
  const cvValue = valueUsd.mul(cvCredits).div(credits).toDecimalPlaces(6);
  return [
    { credits: cvCredits, valueUsd: cvValue },
    { credits: credits - cvCredits, valueUsd: valueUsd.sub(cvValue) },
  ];
}
