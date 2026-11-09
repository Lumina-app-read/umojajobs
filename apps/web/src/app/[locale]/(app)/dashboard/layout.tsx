import type { Metadata } from 'next';
import { type ReactNode } from 'react';
import { AppShell } from '@/features/app-shell/app-shell';
import { requireUser } from '@/lib/auth-guard';

export const metadata: Metadata = { robots: { index: false } };

/** Espace connecté : session complète exigée, structure de l'application (phase 1e). */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={{ firstName: user.firstName, lastName: user.lastName, email: user.email }}>
      {children}
    </AppShell>
  );
}
