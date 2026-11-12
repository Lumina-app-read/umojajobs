import type { Metadata } from 'next';
import { type ReactNode } from 'react';
import { AppShell } from '@/features/app-shell/app-shell';
import { getWallet } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export const metadata: Metadata = { robots: { index: false } };

/** Espace connecté : session complète exigée, structure de l'application (phase 1e). */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const wallet = await getWallet();
  const showEarnings = Boolean(
    wallet && (wallet.commissionCount > 0 || Number(wallet.totalWithdrawnUsd) > 0),
  );
  return (
    <AppShell
      showEarnings={showEarnings}
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        theme: user.theme,
        locale: user.locale,
        permissions: user.permissions,
      }}
    >
      {children}
    </AppShell>
  );
}
