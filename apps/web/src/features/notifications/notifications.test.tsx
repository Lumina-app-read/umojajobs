import { type NotificationsPage } from '@opportinities/shared';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCsrfToken } from '@/lib/api/client';
import { navigationMock } from '@/test/navigation-mock';
import { jsonResponse, renderWithIntl } from '@/test/render';
import { NotificationBell } from './notification-bell';
import { NotificationList } from './notification-list';

vi.mock('@/i18n/navigation', () => navigationMock);

const page: NotificationsPage = {
  unread: 1,
  next: null,
  items: [
    {
      id: 'n1',
      type: 'withdrawal_updated',
      data: { status: 'rejected', amountUsd: '12.50', reason: 'Coordonnées incomplètes.' },
      link: '/dashboard/earnings/withdrawals',
      read: false,
      createdAt: '2026-11-25T08:00:00.000Z',
    },
  ],
};

describe('notifications', () => {
  beforeEach(() => {
    setCsrfToken('jeton');
    vi.restoreAllMocks();
  });

  it('écrit le texte dans la langue, avec le montant et l’état mis en forme', () => {
    renderWithIntl(<NotificationList initial={page} />);
    expect(screen.getByText('Demande de retrait refusée')).toBeVisible();
    expect(
      screen.getByText(
        /Votre demande de retrait de 12,50\s\$US est refusée\. Coordonnées incomplètes\./,
      ),
    ).toBeVisible();
  });

  it('tout marquer comme lu remet la cloche à zéro sans recharger la page', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve(
        jsonResponse(200, String(input).includes('unread-count') ? { unread: 1 } : { unread: 0 }),
      ),
    );
    renderWithIntl(
      <>
        <NotificationBell className="" />
        <NotificationList initial={page} />
      </>,
    );
    expect(await screen.findByRole('link', { name: 'Notifications, 1 non lue' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }));
    await act(async () => Promise.resolve());
    expect(screen.getByRole('link', { name: 'Notifications' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tout est lu' })).toBeDisabled();
  });
});
