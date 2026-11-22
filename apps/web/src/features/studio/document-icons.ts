import { type CareerDocumentType } from '@opportinities/shared';
import { FileText, FileUser, type LucideIcon, Mail, PenLine } from 'lucide-react';

/** Icône de chaque type de document du Career Studio. */
export const TYPE_ICONS: Record<CareerDocumentType, LucideIcon> = {
  cv: FileUser,
  cover_letter: Mail,
  application_letter: Mail,
  internship_request: Mail,
  recommendation_draft: PenLine,
  resignation_letter: FileText,
  follow_up_letter: Mail,
  thank_you_letter: Mail,
};
