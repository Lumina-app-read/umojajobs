import Image from 'next/image';
import { cn } from '@/lib/cn';

/** Proportions de la marque détourée (109 × 128 px dans `public/images/logos`). */
const MARK_RATIO = 109 / 128;

/**
 * Marque OPPORTINITIES (le « O ») : bleue sur fond clair, cyan sur fond sombre.
 * Les deux images sont dans le HTML et la classe `dark` choisit la bonne avant le premier
 * affichage : aucun clignotement. Image décorative : le lien qui l'entoure porte le nom.
 */
export function Logo({
  className,
  size = 32,
  onDark = false,
}: {
  className?: string;
  size?: number;
  /** Fond toujours sombre (panneau bleu nuit) : version cyan quel que soit le thème. */
  onDark?: boolean;
}) {
  const width = Math.round(size * MARK_RATIO);
  const shared = { width, height: size, unoptimized: true, loading: 'eager' } as const;
  if (onDark) {
    return (
      <span className={cn('inline-flex shrink-0', className)}>
        <Image {...shared} alt="" src="/images/logos/mark-dark.png" />
      </span>
    );
  }
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      <Image {...shared} alt="" src="/images/logos/mark-light.png" className="dark:hidden" />
      <Image {...shared} alt="" src="/images/logos/mark-dark.png" className="hidden dark:block" />
    </span>
  );
}
