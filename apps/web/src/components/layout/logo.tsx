import Image from 'next/image';
import { cn } from '@/lib/cn';

/** Proportions des fichiers recadrés de `public/images/logos` (logo complet 405 × 96). */
const FULL_RATIO = 405 / 96;

/**
 * Logo Umoja Jobs. `full` : icône et nom ; `mark` : icône seule ; `auto` : icône seule sur
 * petit écran, logo complet à partir de 640 px. Texte noir sur fond clair, blanc sur fond
 * sombre : les deux images sont dans le HTML et la classe `dark` choisit avant le premier
 * affichage (aucun clignotement). Image décorative : le lien qui l'entoure porte le nom.
 */
export function Logo({
  className,
  size = 32,
  onDark = false,
  variant = 'full',
}: {
  className?: string;
  /** Hauteur affichée, en pixels. */
  size?: number;
  /** Fond toujours sombre (panneau bleu nuit) : texte blanc quel que soit le thème. */
  onDark?: boolean;
  variant?: 'full' | 'mark' | 'auto';
}) {
  const mark = (
    <Image
      src="/images/logos/umoja-mark.png"
      alt=""
      width={size}
      height={size}
      unoptimized
      loading="eager"
      className={variant === 'auto' ? 'sm:hidden' : undefined}
    />
  );
  if (variant === 'mark')
    return <span className={cn('inline-flex shrink-0', className)}>{mark}</span>;

  const full = {
    width: Math.round(size * FULL_RATIO),
    height: size,
    unoptimized: true,
    loading: 'eager',
  } as const;
  const hiddenOnSmall = variant === 'auto' ? 'max-sm:hidden' : '';
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      {variant === 'auto' && mark}
      {onDark ? (
        <Image {...full} alt="" src="/images/logos/umoja-logo-dark.png" className={hiddenOnSmall} />
      ) : (
        <>
          <Image
            {...full}
            alt=""
            src="/images/logos/umoja-logo-light.png"
            className={cn('dark:hidden', hiddenOnSmall)}
          />
          <Image
            {...full}
            alt=""
            src="/images/logos/umoja-logo-dark.png"
            className={cn('hidden dark:block', hiddenOnSmall && 'max-sm:!hidden')}
          />
        </>
      )}
    </span>
  );
}
