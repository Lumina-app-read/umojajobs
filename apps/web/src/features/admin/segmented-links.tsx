import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/**
 * Sélecteur à onglets fait de liens (filtre porté par l'adresse, page rendue côté serveur),
 * avec l'apparence du contrôle segmenté.
 */
export function SegmentedLinks({
  label,
  current,
  options,
}: {
  label: string;
  current: string;
  options: { value: string; label: string; href: string }[];
}) {
  return (
    <nav
      aria-label={label}
      className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={option.value}
            href={option.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'grid h-8 place-items-center rounded-md px-3 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-[120ms]',
              active ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
