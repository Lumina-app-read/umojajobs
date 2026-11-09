import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mail } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageMenu } from '@/components/layout/language-menu';
import { ThemeMenu } from '@/components/theme/theme-menu';
import { routerMock } from '@/test/navigation-mock';
import { renderWithIntl } from '@/test/render';
import { Button } from './button';
import { FormField } from './form-field';
import { Stepper } from './navigation';
import { Toaster, toast } from './toast';

vi.mock('@/i18n/navigation', async () => (await import('@/test/navigation-mock')).navigationMock);

describe('ThemeMenu', () => {
  it('un seul bouton, qui ouvre Clair / Sombre / Système et mémorise le choix', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ThemeMenu />);

    const trigger = screen.getByRole('button', { name: 'Thème : Système' });
    await user.click(trigger);
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Clair', 'Sombre', 'Système']);

    await user.click(screen.getByRole('option', { name: 'Sombre' }));
    expect(document.cookie).toContain('oppo_theme=dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button', { name: 'Thème : Sombre' })).toBeInTheDocument();
  });
});

describe('LanguageMenu', () => {
  it('propose chaque langue écrite dans sa propre langue et change la langue de la page', async () => {
    routerMock.replace.mockReset();
    const user = userEvent.setup();
    renderWithIntl(<LanguageMenu />);

    await user.click(screen.getByRole('button', { name: 'Langue : Français' }));
    const english = screen.getByRole('option', { name: 'English' });
    expect(english.querySelector('[lang="en"]')).not.toBeNull();
    await user.click(english);
    expect(routerMock.replace).toHaveBeenCalledWith('/', { locale: 'en' });
  });
});

describe('Toaster', () => {
  it('annonce la notification, puis la retire automatiquement après 5 secondes', () => {
    vi.useFakeTimers();
    try {
      renderWithIntl(<Toaster />);
      act(() => {
        toast.success('Offre enregistrée', 'Retrouvez-la dans « Enregistrées ».');
      });
      expect(screen.getByRole('status')).toHaveTextContent('Offre enregistrée');
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('garde une erreur affichée jusqu’à sa fermeture', async () => {
    renderWithIntl(<Toaster />);
    act(() => {
      toast.error('Paiement non confirmé');
    });
    const user = userEvent.setup();
    expect(screen.getByRole('alert')).toHaveTextContent('Paiement non confirmé');
    await user.click(screen.getByRole('button', { name: 'Fermer la notification' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Stepper', () => {
  it('expose la progression aux technologies d’assistance', () => {
    renderWithIntl(<Stepper current={1} total={2} label="Vos informations" />);
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '1');
    expect(progress).toHaveAttribute('aria-valuetext', 'Étape 1 sur 2 : Vos informations');
  });
});

describe('Button et FormField', () => {
  it('le bouton en chargement est désactivé et signalé comme occupé', () => {
    renderWithIntl(
      <Button loading loadingLabel="Envoi…">
        Envoyer
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Envoi…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('relie l’erreur au champ et masque l’aide', () => {
    renderWithIntl(
      <FormField
        label="Adresse email"
        name="email"
        icon={Mail}
        hint="Aide"
        error="Adresse invalide"
      />,
    );
    const input = screen.getByLabelText('Adresse email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Adresse invalide');
    expect(screen.queryByText('Aide')).toBeNull();
  });
});
