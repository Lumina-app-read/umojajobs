import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DesignShowcase } from '@/features/design-system/showcase';

export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false },
};

/** Référence interne des composants : disponible uniquement en développement. */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <DesignShowcase />;
}
