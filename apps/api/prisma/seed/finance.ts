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
 * Délais de retenue (N4) et seuil de double validation des retraits (N5) : décisions du
 * propriétaire du 12 novembre 2026.
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
  {
    key: 'commission_hold_days',
    value: '14',
    reason: 'Décision N4 du 12 novembre 2026 : retenue de 14 jours (contributeur établi).',
  },
  {
    key: 'commission_hold_days_new_contributor',
    value: '30',
    reason: 'Décision N4 du 12 novembre 2026 : retenue de 30 jours (nouveau contributeur).',
  },
  {
    key: 'new_contributor_period_days',
    value: '60',
    reason: 'Décision N4 du 12 novembre 2026 : nouveau contributeur pendant 60 jours.',
  },
  {
    key: 'withdrawal_dual_approval_usd',
    value: '50',
    reason: 'Décision N5 du 12 novembre 2026 : double validation à partir de 50 USD.',
  },
  {
    key: 'studio_reexport_window_days',
    value: '7',
    reason: 'Décision du 13 novembre 2026 : un export payé ouvre 7 jours de ré-exports gratuits.',
  },
];

const INITIAL_COSTS: { service: CreditService; credits: number }[] = [
  { service: 'unlock_standard', credits: 5 },
  { service: 'unlock_premium', credits: 10 },
  { service: 'doc_cv', credits: 15 },
  { service: 'doc_cover_letter', credits: 10 },
  { service: 'doc_application_letter', credits: 10 },
  // Décision du 13 novembre 2026 : tarif distinct pour les autres lettres, initialisé à 1 USD.
  { service: 'doc_other_letter', credits: 10 },
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
