import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Indicateur de chargement, seule animation continue autorisée. Décoratif : l'état est porté par aria-busy. */
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-4 animate-spin', className)} aria-hidden="true" />;
}
