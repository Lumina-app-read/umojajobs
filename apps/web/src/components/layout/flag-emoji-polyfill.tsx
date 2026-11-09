'use client';

import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import { useEffect } from 'react';

/** Nom de la police déclarée en tête de la pile de polices (voir globals.css). */
export const FLAG_FONT_FAMILY = 'Twemoji Country Flags';

/**
 * Windows n'affiche pas les drapeaux emoji (il montre « ML » au lieu du drapeau du Mali).
 * Sur ces systèmes uniquement, une police de drapeaux (Twemoji, CC BY 4.0) est chargée depuis
 * notre propre domaine. Elle ne couvre que les caractères de drapeaux.
 */
export function FlagEmojiPolyfill() {
  useEffect(() => {
    polyfillCountryFlagEmojis(FLAG_FONT_FAMILY, '/fonts/TwemojiCountryFlags.woff2');
  }, []);
  return null;
}
