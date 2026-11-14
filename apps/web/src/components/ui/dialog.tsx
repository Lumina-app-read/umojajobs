'use client';

import {
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from '@headlessui/react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Modale accessible (Headless UI) : piège du focus, fermeture à l'Échap, fond flouté.
 * Sur mobile, elle s'ouvre depuis le bas de l'écran. Sa hauteur est limitée à l'écran : le contenu
 * défile, l'en-tête et le pied restent visibles.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const t = useTranslations('common.ui');
  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };
  return (
    <HeadlessDialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-navy/40 backdrop-blur-[2px] transition duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel
          transition
          className={cn(
            'flex max-h-[calc(100dvh-1rem)] w-full flex-col rounded-t-2xl border border-line bg-surface-raised shadow-lg sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl',
            'transition duration-[320ms] ease-emphasized data-closed:translate-y-4 data-closed:opacity-0 sm:data-closed:translate-y-2 sm:data-closed:scale-[0.98]',
            widths[size],
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5">
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-fg">{title}</DialogTitle>
              {description && (
                <Description className="mt-1 text-sm sm:text-[13px] text-fg-muted">
                  {description}
                </Description>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label={t('close')}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {children && (
            <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4 text-sm text-fg-muted">
              {children}
            </div>
          )}
          {footer && (
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-3.5 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </DialogPanel>
      </div>
    </HeadlessDialog>
  );
}
