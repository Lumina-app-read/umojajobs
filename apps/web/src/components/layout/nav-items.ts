import { Briefcase, FileText, type LucideIcon, Route, Share2 } from 'lucide-react';

type NavHref = string | { pathname: '/'; hash: string };

/**
 * Navigation principale du site public, partagée par l'en-tête, le tiroir mobile et le pied de page.
 * Une entrée mène à sa page quand elle existe, sinon à la section correspondante de l'accueil.
 */
export const PRIMARY_NAV: readonly {
  key: 'jobs' | 'share' | 'careerStudio' | 'howItWorks';
  href: NavHref;
  icon: LucideIcon;
}[] = [
  { key: 'jobs', href: '/jobs', icon: Briefcase },
  { key: 'share', href: { pathname: '/', hash: 'share' }, icon: Share2 },
  { key: 'careerStudio', href: { pathname: '/', hash: 'career-studio' }, icon: FileText },
  { key: 'howItWorks', href: { pathname: '/', hash: 'how-it-works' }, icon: Route },
];
