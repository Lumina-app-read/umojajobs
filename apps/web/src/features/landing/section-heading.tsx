import { cn } from '@/lib/cn';

/** En-tête de section : sur-titre en couleur de marque, titre, texte d'introduction. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  id,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
  /** Identifiant du titre, pour `aria-labelledby` sur la section. */
  id?: string;
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <p className="text-[13px] font-semibold tracking-wide text-brand uppercase">{eyebrow}</p>
      <h2
        id={id}
        className="mt-3 text-heading-lg font-bold tracking-[-0.02em] text-fg sm:text-display-lg"
      >
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-base leading-relaxed text-fg-muted">{subtitle}</p>}
    </div>
  );
}
