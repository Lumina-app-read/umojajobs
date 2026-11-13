import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

/** Carte d'une section de formulaire du Studio : icône, titre, aide, contenu et action. */
export function Section({
  icon: Icon,
  title,
  hint,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] text-fg-muted">{hint}</p>}
        </div>
      </div>
      <div className="mt-4 grid gap-4">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
