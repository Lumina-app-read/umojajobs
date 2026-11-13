import {
  isAfricanCountryIso2,
  ISO_DATE,
  LETTER_LIMITS,
  type LetterContent,
} from '@opportinities/shared';
import { asObject, type ContentIssue, EMAIL, fieldReader, PHONE } from './content-fields';

/**
 * Valide et normalise le contenu d'une lettre reçu du navigateur, avec les mêmes règles que le CV :
 * champs connus seulement, textes nettoyés, longueurs et formats contrôlés, rien d'inventé.
 */
export function normalizeLetter(input: unknown): {
  content: LetterContent;
  issues: ContentIssue[];
} {
  const issues: ContentIssue[] = [];
  const { text, pattern } = fieldReader(issues);
  const root = asObject(input);
  const sender = asObject(root.sender);
  const recipient = asObject(root.recipient);
  const { shortText: S, addressMax: A } = LETTER_LIMITS;

  const country = text(sender.countryIso2, 'sender.countryIso2', 2).toUpperCase();
  if (country && !isAfricanCountryIso2(country)) {
    issues.push({ field: 'sender.countryIso2', rule: 'isIn' });
  }

  const content: LetterContent = {
    sender: {
      fullName: text(sender.fullName, 'sender.fullName', S),
      email: pattern(sender.email, 'sender.email', EMAIL, 254),
      phone: pattern(sender.phone, 'sender.phone', PHONE, 25),
      address: text(sender.address, 'sender.address', A),
      city: text(sender.city, 'sender.city', S),
      countryIso2: country,
    },
    recipient: {
      name: text(recipient.name, 'recipient.name', S),
      role: text(recipient.role, 'recipient.role', S),
      organization: text(recipient.organization, 'recipient.organization', S),
      address: text(recipient.address, 'recipient.address', A),
      city: text(recipient.city, 'recipient.city', S),
    },
    place: text(root.place, 'place', S),
    date: pattern(root.date, 'date', ISO_DATE, 10),
    subject: text(root.subject, 'subject', LETTER_LIMITS.subjectMax),
    reference: text(root.reference, 'reference', S),
    salutation: text(root.salutation, 'salutation', LETTER_LIMITS.salutationMax),
    body: text(root.body, 'body', LETTER_LIMITS.bodyMax),
    closing: text(root.closing, 'closing', LETTER_LIMITS.closingMax),
    enclosures: text(root.enclosures, 'enclosures', LETTER_LIMITS.addressMax),
  };
  return { content, issues };
}
