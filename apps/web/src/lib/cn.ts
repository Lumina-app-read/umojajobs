import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Fusion de classes Tailwind : en cas de conflit (par exemple `px-3.5` d'un bouton et `px-0`
 * d'un bouton-icône), la classe passée en dernier l'emporte toujours, quel que soit l'ordre
 * de la feuille de style. Les tailles de texte du design system sont déclarées pour ne pas être
 * confondues avec des couleurs (`text-display-xl` contre `text-fg`).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display-xl', 'display-lg', 'heading-lg', 'heading-md'],
    },
  },
});

export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(' '));
}
