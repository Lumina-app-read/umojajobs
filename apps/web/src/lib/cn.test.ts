import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('la dernière classe en conflit l’emporte', () => {
    expect(cn('h-9 px-3.5 text-sm', 'px-0')).toBe('h-9 text-sm px-0');
    expect(cn('inline-flex', 'max-sm:hidden')).toBe('inline-flex max-sm:hidden');
  });

  it('distingue les tailles de texte du design system et les couleurs', () => {
    expect(cn('text-display-xl', 'text-fg')).toBe('text-display-xl text-fg');
    expect(cn('text-fg', 'text-brand')).toBe('text-brand');
  });

  it('ignore les valeurs vides', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});
