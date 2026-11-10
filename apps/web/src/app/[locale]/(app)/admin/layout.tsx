import { PERMISSIONS } from '@opportinities/shared';
import type { Metadata } from 'next';
import { type ReactNode } from 'react';
import { AppShell } from '@/features/app-shell/app-shell';
import { requirePermission } from '@/lib/auth-guard';

export const metadata: Metadata = { robots: { index: false } };

/** Administration : permission admin.access obligatoire (double authentification déjà exigée). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  return (
    <AppShell
      variant="admin"
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
