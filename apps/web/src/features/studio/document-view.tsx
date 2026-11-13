import {
  type CareerDocumentContent,
  type CareerDocumentType,
  type CvContent,
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
}: {
  type: CareerDocumentType;
  templateKey: string;
  content: CareerDocumentContent;
  labels: StudioLabels;
  language: 'fr' | 'en';
  countryName: string;
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
    />
  );
}
