import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DailyPoint {
  date: string;
  value: number;
}

/**
 * Histogramme journalier d'une seule mesure (une couleur, pas de légende : le titre la nomme).
 * Chaque colonne entière sert de zone de survol et affiche le jour et la valeur ; le tableau
 * repliable sous le graphique donne les mêmes données aux lecteurs d'écran et au clavier.
 */
export function DailyChart({
  title,
  total,
  points,
  formatValue,
  formatDay,
  labels,
}: {
  title: string;
  total: ReactNode;
  points: DailyPoint[];
  formatValue: (value: number) => string;
  formatDay: (date: string) => string;
  labels: { max: string; empty: string; table: string; date: string; value: string };
}) {
  const max = Math.max(0, ...points.map((point) => point.value));
  const first = points[0];
  const last = points.at(-1);

  return (
    <figure className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-fg">{title}</span>
        <span className="text-sm font-semibold tabular-nums text-fg">{total}</span>
      </figcaption>

      <div aria-hidden="true" className="grid gap-1.5">
        {/* Repère du maximum au-dessus du tracé, pour ne jamais chevaucher une barre. */}
        <span className="h-4 text-right text-[11px] text-fg-subtle tabular-nums">
          {max > 0 ? labels.max : ''}
        </span>
        <div className="relative h-28">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
          <div className="absolute inset-x-0 bottom-0 border-t border-line-strong" />
          {max === 0 ? (
            <p className="absolute inset-0 grid place-items-center text-xs text-fg-subtle">
              {labels.empty}
            </p>
          ) : (
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {points.map((point, index) => {
                const height = (point.value / max) * 100;
                const alignEnd = index > points.length - 6;
                return (
                  <div key={point.date} className="group relative flex h-full flex-1 items-end">
                    <div
                      className={cn(
                        'w-full rounded-t-[3px] bg-primary transition-opacity group-hover:opacity-80',
                        point.value > 0 ? 'min-h-[3px]' : 'h-0',
                      )}
                      style={point.value > 0 ? { height: `${height}%` } : undefined}
                    />
                    <div
                      className={cn(
                        'pointer-events-none absolute bottom-full z-10 mb-1.5 hidden whitespace-nowrap rounded-md border border-line bg-surface-raised px-2 py-1 text-xs shadow-md group-hover:block',
                        alignEnd ? 'right-0' : index < 5 ? 'left-0' : 'left-1/2 -translate-x-1/2',
                      )}
                    >
                      <span className="text-fg-muted">{formatDay(point.date)}</span>{' '}
                      <span className="font-semibold text-fg tabular-nums">
                        {formatValue(point.value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {first && last && (
          <div className="flex justify-between text-[11px] text-fg-subtle">
            <span>{formatDay(first.date)}</span>
            <span>{formatDay(last.date)}</span>
          </div>
        )}
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-fg-muted hover:text-fg">{labels.table}</summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="text-fg-subtle">
                <th scope="col" className="py-1 font-medium">
                  {labels.date}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {labels.value}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-t border-line">
                  <td className="py-1 text-fg-muted">{formatDay(point.date)}</td>
                  <td className="py-1 text-right tabular-nums text-fg">
                    {formatValue(point.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
