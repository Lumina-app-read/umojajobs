import {
  BRIEF_LIMITS,
  type CareerDocumentBrief,
  type CareerDocumentType,
  type CvBrief,
  isLetterType,
  LETTER_BRIEF_FIELDS,
  LETTER_BRIEF_LONG_FIELDS,
  type LetterBrief,
} from '@opportinities/shared';
import { asObject, type ContentIssue, fieldReader } from './content-fields';

/**
 * Valide et normalise les informations de départ d'un document (faits fournis pour la génération) :
 * champs connus selon le type, textes nettoyés, longueurs contrôlées, champs vides omis.
 */
export function normalizeBrief(
  type: CareerDocumentType,
  input: unknown,
): { brief: CareerDocumentBrief; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  const { text } = fieldReader(issues);
  const root = asObject(input);
  if (!isLetterType(type)) {
    const brief: CvBrief = {
      targetRole: text(root.targetRole, 'targetRole', BRIEF_LIMITS.short),
      jobOffer: text(root.jobOffer, 'jobOffer', BRIEF_LIMITS.offer),
    };
    return { brief, issues };
  }
  const brief: LetterBrief = {};
  for (const field of LETTER_BRIEF_FIELDS) {
    const max =
      field === 'offerText'
        ? BRIEF_LIMITS.offer
        : LETTER_BRIEF_LONG_FIELDS.includes(field)
          ? BRIEF_LIMITS.long
          : BRIEF_LIMITS.short;
    const value = text(root[field], field, max);
    if (value) brief[field] = value;
  }
  return { brief, issues };
}
