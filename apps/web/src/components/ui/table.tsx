import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Tableau sobre : en-tête teinté, lignes de 44 px, chiffres alignés à droite, survol discret.
 * Le défilement horizontal reste dans le conteneur ; sur mobile, préférer une liste.
 */
export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
      <table
        className={cn('w-full min-w-[520px] border-collapse text-[13px]', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  className,
  numeric,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-line bg-surface-2 px-3.5 py-2.5 text-left text-xs font-semibold text-fg-subtle',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-line transition-colors duration-[120ms] last:border-b-0 hover:bg-surface-2',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn('px-3.5 py-3 text-fg', numeric && 'text-right tabular-nums', className)}
      {...props}
    />
  );
}
