import { Briefcase, FileText, type LucideIcon, Route, Share2 } from 'lucide-react';

/**
 * Navigation principale du site public, partagée par l'en-tête, le tiroir mobile et le pied de page.
 * Tant que les pages dédiées n'existent pas, chaque entrée mène à la section correspondante de
 * l'accueil (construite à l'étape D4). Remplacer `hash` par une route quand la page existe.
 */
export const PRIMARY_NAV: readonly {
  key: 'jobs' | 'share' | 'careerStudio' | 'howItWorks';
  hash: string;
  icon: LucideIcon;
}[] = [
  { key: 'jobs', hash: 'jobs', icon: Briefcase },
  { key: 'share', hash: 'share', icon: Share2 },
  { key: 'careerStudio', hash: 'career-studio', icon: FileText },
  { key: 'howItWorks', hash: 'how-it-works', icon: Route },
];
