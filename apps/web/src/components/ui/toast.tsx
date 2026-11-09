'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const AUTO_DISMISS_MS = 5000;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function dismissToast(id: number): void {
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(tone: ToastTone, title: string, description?: string): number {
  const id = nextId++;
  // Trois notifications au plus à l'écran : la plus ancienne laisse sa place.
  items = [...items.slice(-2), { id, tone, title, ...(description ? { description } : {}) }];
  emit();
  return id;
}

/** Retour immédiat après une action. Les erreurs restent affichées jusqu'à leur fermeture. */
export const toast = {
  success: (title: string, description?: string) => push('success', title, description),
  error: (title: string, description?: string) => push('error', title, description),
  info: (title: string, description?: string) => push('info', title, description),
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };
const ICON_TONES = {
  success: 'bg-success-soft text-success',
  error: 'bg-danger-soft text-danger',
  info: 'bg-primary-soft text-brand',
};

function ToastView({ item, closeLabel }: { item: ToastItem; closeLabel: string }) {
  const Icon = ICONS[item.tone];
  useEffect(() => {
    if (item.tone === 'error') return undefined;
    const timer = window.setTimeout(() => dismissToast(item.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [item]);

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-line bg-surface-raised p-3 shadow-lg animate-fade-up"
    >
      <span
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-full',
          ICON_TONES[item.tone],
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] font-semibold text-fg">{item.title}</p>
        {item.description && <p className="mt-0.5 text-xs text-fg-muted">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        className="grid size-7 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        aria-label={closeLabel}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Zone d'affichage des notifications : en haut à droite sur ordinateur, en bas sur mobile. */
export function Toaster() {
  const t = useTranslations('common.ui');
  const current = useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:left-auto sm:top-0 sm:w-[380px]"
    >
      {current.map((item) => (
        <ToastView key={item.id} item={item} closeLabel={t('dismiss')} />
      ))}
    </div>
  );
}
