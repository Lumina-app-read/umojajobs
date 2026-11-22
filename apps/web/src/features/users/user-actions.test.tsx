import { type AdminUserDetail } from '@opportinities/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCsrfToken } from '@/lib/api/client';
import { navigationMock, routerMock } from '@/test/navigation-mock';
import { jsonResponse, renderWithIntl } from '@/test/render';
import { UserActions } from './user-actions';

vi.mock('@/i18n/navigation', () => navigationMock);

const user = (can: AdminUserDetail['can'], roles: AdminUserDetail['roles'] = ['user']) =>
  ({ id: 'u1', name: 'Awa Diallo', roles, status: 'active', can }) as unknown as AdminUserDetail;

describe('UserActions', () => {
  beforeEach(() => {
    setCsrfToken('jeton');
    vi.restoreAllMocks();
  });

  it('n’affiche aucune action sans droit sur le compte', () => {
    renderWithIntl(
      <UserActions user={user({ suspend: false, reactivate: false, manageRoles: false })} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('exige un motif avant d’appeler l’API, puis suspend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {}));
    renderWithIntl(
      <UserActions user={user({ suspend: true, reactivate: false, manageRoles: false })} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Suspendre' }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Suspendre' }));
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.type(dialog.getByRole('textbox'), 'Signalements vérifiés');
    await userEvent.click(dialog.getByRole('button', { name: 'Suspendre' }));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain('/admin/users/u1/suspend');
    expect(JSON.parse(String(init?.body))).toEqual({ reason: 'Signalements vérifiés' });
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it('propose d’attribuer ou de retirer selon les rôles du compte', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {}));
    renderWithIntl(
      <UserActions
        user={user({ suspend: false, reactivate: false, manageRoles: true }, ['user', 'moderator'])}
      />,
    );
    expect(screen.getByRole('button', { name: 'Attribuer : Administrateur' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer : Modérateur' }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByRole('textbox'), 'Départ de l’équipe');
    await userEvent.click(dialog.getByRole('button', { name: 'Retirer' }));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      role: 'moderator',
      granted: false,
      reason: 'Départ de l’équipe',
    });
  });
});
