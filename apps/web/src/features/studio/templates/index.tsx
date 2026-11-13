import { type CvTemplate } from '@opportinities/shared';
import { type CvTemplateProps } from '../cv-format';
import { AcademicTemplate } from './academic';
import { ClassicTemplate } from './classic';
import { ExecutiveTemplate } from './executive';
import { GraduateTemplate } from './graduate';
import { InternationalTemplate } from './international';
import { ModernTemplate } from './modern';

/** Format A4 à 96 ppp. */
export const A4_WIDTH = 794;
export const A4_HEIGHT = 1123;

/**
 * CV dans le modèle choisi : une seule source pour l'aperçu de l'éditeur et la page d'impression
 * du PDF. Un modèle inconnu retombe sur le modèle Classique.
 */
export function CvDocument({ templateKey, ...props }: CvTemplateProps & { templateKey: string }) {
  switch (templateKey as CvTemplate) {
    case 'modern':
      return <ModernTemplate {...props} />;
    case 'international':
      return <InternationalTemplate {...props} />;
    case 'academic':
      return <AcademicTemplate {...props} />;
    case 'graduate':
      return <GraduateTemplate {...props} />;
    case 'executive':
      return <ExecutiveTemplate {...props} />;
    default:
      return <ClassicTemplate {...props} />;
  }
}
