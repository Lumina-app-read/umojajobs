import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConsentSnapshot, openCookiePreferences } from '@/lib/consent';
import { renderWithIntl } from '@/test/render';
import { ConsentGate } from './consent-gate';
import { CookieConsent } from './cookie-consent';

vi.mock('@/i18n/navigation', async () => (await import('@/test/navigation-mock')).navigationMock);

function clearCookies() {
  for (const entry of document.cookie.split('; ')) {
    const name = entry.split('=')[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

const banner = () => screen.queryByRole('region', { name: 'Votre vie privée, vos choix' });

describe('consentement aux cookies', () => {
  afterEach(clearCookies);

  it('s’affiche à la première visite ; « Tout refuser » enregistre un refus et ferme', async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookieConsent />);
    expect(banner()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tout refuser' }));
    expect(banner()).toBeNull();
    expect(getConsentSnapshot()?.categories).toEqual({ functional: false, analytics: false });
  });

  it('« Tout accepter » accepte toutes les catégories présentées', async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookieConsent />);
    await user.click(screen.getByRole('button', { name: 'Tout accepter' }));
    expect(getConsentSnapshot()?.categories).toEqual({ functional: true, analytics: true });
    expect(getConsentSnapshot()?.version).toBeTruthy();
    expect(Date.parse(getConsentSnapshot()!.decidedAt)).not.toBeNaN();
  });

  it('« Personnaliser » : rien n’est coché par défaut, les nécessaires restent actifs', async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookieConsent />);
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    expect(screen.getByText('Toujours actifs')).toBeInTheDocument();
    const functional = screen.getByRole('switch', { name: 'Fonctionnels' });
    expect(functional).not.toBeChecked();
    await user.click(functional);
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes choix' }));
    expect(getConsentSnapshot()?.categories).toEqual({ functional: true, analytics: false });
  });

  it('fermer le panneau n’est pas une acceptation : la fenêtre revient, rien n’est enregistré', async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookieConsent />);
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(banner()).toBeInTheDocument());
    expect(getConsentSnapshot()).toBeNull();
  });

  it('le lien « Préférences des cookies » rouvre le panneau avec le choix enregistré', async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookieConsent />);
    await user.click(screen.getByRole('button', { name: 'Tout accepter' }));
    act(() => openCookiePreferences());
    expect(await screen.findByRole('switch', { name: 'Fonctionnels' })).toBeChecked();
    expect(banner()).toBeNull();
  });

  it('aucun contenu non essentiel n’est rendu avant le consentement correspondant', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <>
        <CookieConsent />
        <ConsentGate category="analytics">
          <script data-testid="mesure" />
        </ConsentGate>
      </>,
    );
    expect(screen.queryByTestId('mesure')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Tout refuser' }));
    expect(screen.queryByTestId('mesure')).toBeNull();
    act(() => openCookiePreferences());
    await user.click(await screen.findByRole('button', { name: 'Tout accepter' }));
    expect(screen.getByTestId('mesure')).toBeInTheDocument();
  });
});
