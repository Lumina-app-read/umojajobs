import Image from 'next/image';
import { cn } from '@/lib/cn';

/** Proportions des fichiers recadrés de `public/images/logos` (logo complet 635 × 128). */
const FULL_RATIO = 635 / 128;

/** Une image du logo, en bleu sur fond clair et en blanc sur fond sombre. */
function ThemedImage({
  name,
  width,
  height,
  onDark,
  className,
}: {
  name: 'umoja-logo' | 'umoja-mark';
  width: number;
  height: number;
  onDark: boolean;
  /** Masquage selon la largeur d'écran, appliqué aux deux versions. */
  className?: string;
}) {
  const common = { width, height, unoptimized: true, loading: 'eager' } as const;
  const dark = `/images/logos/${name}-dark.png`;
  // Conteneur masquable séparé : le choix du thème ne se heurte pas au choix de la largeur.
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      {onDark ? (
        <Image {...common} alt="" src={dark} />
      ) : (
        <>
          <Image
            {...common}
            alt=""
            src={`/images/logos/${name}-light.png`}
            className="dark:hidden"
          />
          <Image {...common} alt="" src={dark} className="hidden dark:block" />
        </>
      )}
    </span>
  );
}

/**
 * Logo Umoja Jobs. `full` : symbole et nom ; `mark` : symbole seul ; `auto` : symbole seul sur
 * petit écran, logo complet à partir de 640 px. Bleu sur fond clair, blanc sur fond sombre : les
 * deux images sont dans le HTML et la classe `dark` choisit avant le premier affichage (aucun
 * clignotement). Image décorative : le lien qui l'entoure porte le nom.
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
  /** Fond toujours sombre (panneau bleu nuit) : logo blanc quel que soit le thème. */
  onDark?: boolean;
  variant?: 'full' | 'mark' | 'auto';
}) {
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      {variant !== 'full' && (
        <ThemedImage
          name="umoja-mark"
          width={size}
          height={size}
          onDark={onDark}
          className={variant === 'auto' ? 'sm:hidden' : undefined}
        />
      )}
      {variant !== 'mark' && (
        <ThemedImage
          name="umoja-logo"
          width={Math.round(size * FULL_RATIO)}
          height={size}
          onDark={onDark}
          className={variant === 'auto' ? 'max-sm:hidden' : undefined}
        />
      )}
    </span>
  );
}
