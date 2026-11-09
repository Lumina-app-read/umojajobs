import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCsrfToken } from '@/lib/api/client';
import { navigationMock, routerMock } from '@/test/navigation-mock';
import { jsonResponse, renderWithIntl } from '@/test/render';
import { destinationAfterLogin, LoginForm } from './login-form';
import { RegisterForm } from './register-form';

vi.mock('@/i18n/navigation', () => navigationMock);

describe('redirection après connexion', () => {
  it.each([
    ['not_required', '/dashboard'],
    ['verified', '/dashboard'],
    ['verification_required', '/mfa'],
    ['enrollment_required', '/mfa/setup'],
  ] as const)('état MFA %s → %s', (state, destination) => {
    expect(destinationAfterLogin(state)).toBe(destination);
  });
});

describe('LoginForm', () => {
  beforeEach(() => {
    setCsrfToken('jeton');
    routerMock.replace.mockReset();
  });

  it('valide localement avant tout appel réseau', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderWithIntl(<LoginForm />);
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Adresse email')).toHaveAccessibleDescription(
      'Ce champ est obligatoire.',
    );
  });

  it('affiche le message traduit d’identifiants incorrects', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(401, { statusCode: 401, code: 'INVALID_CREDENTIALS', requestId: 'r' }),
    );
    const user = userEvent.setup();
    renderWithIntl(<LoginForm />);
    await user.type(screen.getByLabelText('Adresse email'), 'awa@example.com');
    await user.type(screen.getByLabelText('Mot de passe'), 'mauvais mot de passe');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Adresse email ou mot de passe incorrect.',
    );
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('affiche la durée de verrouillage en anglais', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(429, {
        statusCode: 429,
        code: 'ACCOUNT_LOCKED',
        requestId: 'r',
        meta: { retryAfterSeconds: 900 },
      }),
    );
    const user = userEvent.setup();
    renderWithIntl(<LoginForm />, 'en');
    await user.type(screen.getByLabelText('Email address'), 'awa@example.com');
    await user.type(screen.getByLabelText('Password'), 'mauvais mot de passe');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Try again in 15 minutes.',
    );
  });

  it('propose de renvoyer l’email si l’adresse n’est pas confirmée', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(403, { statusCode: 403, code: 'EMAIL_NOT_VERIFIED', requestId: 'r' }),
      )
      .mockResolvedValueOnce(jsonResponse(202, { status: 'accepted' }));
    const user = userEvent.setup();
    renderWithIntl(<LoginForm />);
    await user.type(screen.getByLabelText('Adresse email'), 'awa@example.com');
    await user.type(screen.getByLabelText('Mot de passe'), 'une phrase de passe');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    await user.click(
      await screen.findByRole('button', { name: "Renvoyer l'email de confirmation" }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent('un nouvel email vient d');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/auth/verify-email/resend');
  });

  it('redirige vers l’inscription TOTP pour un administrateur sans TOTP', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(200, { csrfToken: 'nouveau', user: { mfaState: 'enrollment_required' } }),
    );
    const user = userEvent.setup();
    renderWithIntl(<LoginForm />);
    await user.type(screen.getByLabelText('Adresse email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Mot de passe'), 'une phrase de passe');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await vi.waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/mfa/setup'));
  });
});

describe('RegisterForm', () => {
  it('signale tous les champs obligatoires, sans appel réseau', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderWithIntl(<RegisterForm countries={[]} />);
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Prénom')).toHaveAccessibleDescription(
      'Ce champ est obligatoire.',
    );
    expect(screen.getByText('Choisissez votre pays dans la liste.')).toBeInTheDocument();
    expect(
      screen.getByText('Vous devez accepter les conditions pour créer un compte.'),
    ).toBeInTheDocument();
  });
});
