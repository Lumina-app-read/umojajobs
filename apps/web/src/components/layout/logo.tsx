import { APP_NAME } from '@opportinities/shared';
import { cn } from '@/lib/cn';

/**
 * Logotype provisoire : pastille bleu nuit avec un anneau blanc et un point ambre,
 * puis le nom en Plus Jakarta Sans 800. À remplacer par le logo définitif (décision ouverte).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-navy',
        className,
      )}
    >
      <span className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-[#f5b544]" />
      <span className="relative size-3 rounded-full border-[3px] border-white" />
    </span>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className={inverted ? 'bg-primary' : undefined} />
      <span
        className={cn(
          'text-[15px] font-extrabold tracking-[-0.02em] max-[359px]:sr-only sm:text-base',
          inverted ? 'text-white' : 'text-fg',
        )}
      >
        {APP_NAME}
      </span>
    </span>
  );
}
