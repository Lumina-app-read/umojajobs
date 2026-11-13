import {
  type CareerDocumentContent,
  type CareerDocumentType,
  CV_PHOTO_TEMPLATES,
  type CvContent,
  type CvTemplate,
  isLetterType,
  type LetterContent,
} from '@opportinities/shared';
import { type CvLabels } from './cv-format';
import { type LetterLabels } from './letters/letter-format';
import { LetterDocument } from './letters/letter-templates';
import { CvDocument } from './templates';

/** Libellés imprimés, dans la langue du document. */
export interface StudioLabels {
  cv: CvLabels;
  letter: LetterLabels;
}

/** Pays affiché sur le document : celui du titulaire du CV ou de l'expéditeur de la lettre. */
export function documentCountry(type: CareerDocumentType, content: CareerDocumentContent): string {
  return isLetterType(type)
    ? (content as LetterContent).sender.countryIso2
    : (content as CvContent).personal.countryIso2;
}

/**
 * Rendu d'un document du Studio (CV ou lettre) dans son modèle : une seule source pour l'aperçu
 * de l'éditeur et la page d'impression du PDF.
 */
export function StudioDocument({
  type,
  templateKey,
  content,
  labels,
  language,
  countryName,
  photoUrl,
}: {
  type: CareerDocumentType;
  templateKey: string;
  content: CareerDocumentContent;
  labels: StudioLabels;
  language: 'fr' | 'en';
  countryName: string;
  /** Photo du CV, si l'utilisateur en a ajouté une. */
  photoUrl?: string | null;
}) {
  if (isLetterType(type)) {
    return (
      <LetterDocument
        templateKey={templateKey}
        content={content as LetterContent}
        labels={labels.letter}
        language={language}
        countryName={countryName}
      />
    );
  }
  return (
    <CvDocument
      templateKey={templateKey}
      content={content as CvContent}
      labels={labels.cv}
      countryName={countryName}
      // Photo affichée seulement par les modèles qui la prévoient (décision du 13 novembre 2026).
      photoUrl={CV_PHOTO_TEMPLATES.includes(templateKey as CvTemplate) ? photoUrl : null}
    />
  );
}
