'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { api, setCsrfToken } from '@/lib/api/client';

export function LogoutButton({ className }: { className?: string }) {
  const t = useTranslations('common.nav');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    // Même si la session a déjà expiré côté serveur, on revient à la page de connexion.
    await api.post('/auth/logout').catch(() => undefined);
    setCsrfToken(null);
    router.replace('/login');
    router.refresh();
  }

  return (
    <Button variant="secondary" icon={LogOut} onClick={logout} loading={busy} className={className}>
      {t('logout')}
    </Button>
  );
}
