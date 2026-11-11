import {
  type CreditService,
  type FinancialSettingKey,
  type PrismaClient,
} from '../../src/generated/prisma/client';

/**
 * Valeurs initiales des paramètres financiers, tirées des décisions validées du propriétaire.
 * Ce sont des données administrables, pas des constantes du code : elles ne sont chargées que si
 * le paramètre n'a encore aucune valeur, puis se modifient depuis l'administration (historisé).
 *
 * Non chargés volontairement (décisions encore ouvertes) : délais de retenue des commissions
 * (N4), ancienneté d'un nouveau contributeur (N4) et seuil de double validation des retraits (N5).
 */
const INITIAL_SETTINGS: { key: FinancialSettingKey; value: string; reason: string }[] = [
  {
    key: 'credit_unit_value_usd',
    value: '0.10',
    reason: 'Valeur initiale : 1 crédit = 0,10 USD (CLAUDE.md §10, cahier v1.2 §8.3).',
  },
  {
    key: 'contributor_commission_rate',
    value: '0.30',
    reason: 'Valeur initiale : 30 % contributeur, 70 % plateforme (CLAUDE.md §10, décision D3).',
  },
  {
    key: 'withdrawal_min_usd',
    value: '10',
    reason: 'Valeur initiale : seuil de retrait de 10 USD (CLAUDE.md §11).',
  },
];

const INITIAL_COSTS: { service: CreditService; credits: number }[] = [
  { service: 'unlock_standard', credits: 5 },
  { service: 'unlock_premium', credits: 10 },
  { service: 'doc_cv', credits: 15 },
  { service: 'doc_cover_letter', credits: 10 },
  { service: 'doc_application_letter', credits: 10 },
  { service: 'doc_pack', credits: 25 },
];
const COST_REASON = 'Valeur initiale : arbitrage A3 validé le 9 novembre 2026.';

export async function seedFinance(prisma: PrismaClient): Promise<number> {
  let created = 0;
  for (const setting of INITIAL_SETTINGS) {
    if ((await prisma.financialSetting.count({ where: { key: setting.key } })) > 0) continue;
    await prisma.financialSetting.create({
      data: { ...setting, effectiveFrom: new Date() },
    });
    created += 1;
  }
  for (const cost of INITIAL_COSTS) {
    if ((await prisma.serviceCreditCost.count({ where: { service: cost.service } })) > 0) continue;
    await prisma.serviceCreditCost.create({
      data: { ...cost, reason: COST_REASON, effectiveFrom: new Date() },
    });
    created += 1;
  }
  return created;
}
