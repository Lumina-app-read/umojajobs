import { type ReactNode } from 'react';
import { splitDescription } from '../cv-format';

/**
 * Éléments communs aux modèles. Les couleurs du CV sont fixes (papier blanc) : elles ne suivent
 * pas le thème sombre de l'interface, l'aperçu doit ressembler au document imprimé.
 */
export function Description({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const { bullets, paragraphs } = splitDescription(text);
  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p key={`p${index}`} className="mt-1">
          {paragraph}
        </p>
      ))}
      {bullets.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {bullets.map((bullet, index) => (
            <li key={`b${index}`}>{bullet}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** N'affiche une section que si elle a un contenu. */
export function When({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <>{children}</> : null;
}

/** Ligne séparée par des points médians, sans éléments vides. */
export function joinParts(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' · ');
}
