'use client';

/*
 * Page de référence du design system (développement uniquement, jamais servie en production).
 * Outil interne destiné à l'équipe : ses libellés de démonstration ne passent pas par le
 * catalogue de traduction. Les composants présentés, eux, sont ceux utilisés dans l'application.
 */
import { AFRICAN_COUNTRIES, type CountryResponse, flagEmoji } from '@opportinities/shared';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CircleAlert,
  CircleCheck,
  Info,
  KeyRound,
  Send,
  X,
  Bookmark,
  Briefcase,
  Coins,
  Files,
  HandCoins,
  Lock,
  Mail,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Unlock,
  User,
  Wallet,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { CountrySelect } from '@/components/forms/country-select';
import { LanguageMenu } from '@/components/layout/language-menu';
import { Logo } from '@/components/layout/logo';
import { ThemeMenu } from '@/components/theme/theme-menu';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Avatar, EmptyState, Skeleton, StatCard } from '@/components/ui/feedback';
import { Checkbox, FormField, PasswordField } from '@/components/ui/form-field';
import { SegmentedControl, Stepper } from '@/components/ui/navigation';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

const COUNTRIES: CountryResponse[] = AFRICAN_COUNTRIES.map((country) => ({
  ...country,
  flagEmoji: flagEmoji(country.iso2),
}));

const SWATCHES: { token: string; label: string }[] = [
  { token: 'primary', label: 'primary (aplats)' },
  { token: 'brand', label: 'brand (texte coloré)' },
  { token: 'primary-soft', label: 'primary-soft' },
  { token: 'navy', label: 'navy' },
  { token: 'accent', label: 'accent (rare)' },
  { token: 'canvas', label: 'canvas' },
  { token: 'surface', label: 'surface' },
  { token: 'surface-2', label: 'surface-2' },
  { token: 'surface-raised', label: 'surface-raised' },
  { token: 'line-strong', label: 'line-strong' },
  { token: 'fg-muted', label: 'fg-muted' },
  { token: 'fg', label: 'fg' },
  { token: 'success', label: 'success' },
  { token: 'warning', label: 'warning' },
  { token: 'danger', label: 'danger' },
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-line py-10 first:border-t-0 first:pt-0"
    >
      <div className="mb-5 max-w-2xl">
        <h2 className="text-heading-md text-fg">{title}</h2>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function DesignShowcase() {
  const [country, setCountry] = useState('ML');
  const [step, setStep] = useState(1);
  const [view, setView] = useState<'all' | 'active' | 'expired'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [terms, setTerms] = useState(true);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.06em] text-brand uppercase">
            Design system
          </p>
          <h1 className="mt-1 text-heading-lg text-fg">Composants Umoja Jobs</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Référence interne · docs/DESIGN_SYSTEM.md · visible en développement uniquement
          </p>
        </div>
        <div className="flex items-center gap-1">
          <LanguageMenu />
          <ThemeMenu />
        </div>
      </header>

      <Section
        id="couleurs"
        title="Couleurs"
        description="Jetons sémantiques redéfinis par thème. Changez de thème pour vérifier les deux palettes."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SWATCHES.map((swatch) => (
            <div
              key={swatch.token}
              className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs"
            >
              <div
                className="h-14 border-b border-line"
                style={{ background: `var(--${swatch.token})` }}
              />
              <p className="px-3 py-2 font-mono text-[11px] text-fg-muted">{swatch.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="typographie"
        title="Typographie"
        description="Plus Jakarta Sans, famille unique. Interface en 14 px, marketing en 16-18 px."
      >
        <Card className="divide-y divide-line px-5">
          {[
            ['display-xl', 'text-display-xl', 'Opportunités'],
            ['display-lg', 'text-display-lg', 'Comment ça marche'],
            ['heading-lg', 'text-heading-lg', "Vue d'ensemble"],
            ['heading-md', 'text-heading-md', 'Offres recommandées'],
            ['text-base', 'text-base', 'Partagez une offre et recevez 30 % de chaque déblocage.'],
            [
              'text-sm',
              'text-sm text-fg-muted',
              "Texte d'interface par défaut des tableaux de bord.",
            ],
            ['text-xs', 'text-xs font-medium text-fg-subtle', 'Clôture le 30 novembre 2026'],
          ].map(([token, className, sample]) => (
            <div key={token} className="grid gap-1 py-3 sm:grid-cols-[120px_1fr] sm:items-baseline">
              <code className="font-mono text-xs text-fg-subtle">{token}</code>
              <p className={`${className} min-w-0 overflow-hidden text-ellipsis text-fg`}>
                {sample}
              </p>
            </div>
          ))}
        </Card>
      </Section>

      <Section
        id="boutons"
        title="Boutons"
        description="Hauteurs 32, 36, 40 et 48 px (48 réservé au hero). Icônes Lucide."
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button icon={Plus}>Publier une offre</Button>
            <Button variant="secondary" icon={Bookmark}>
              Enregistrer
            </Button>
            <Button variant="ghost" icon={X}>
              Annuler
            </Button>
            <Button variant="danger" icon={Trash2}>
              Supprimer
            </Button>
            <Button variant="link" icon={KeyRound}>
              Mot de passe oublié ?
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button size="sm" icon={Plus}>
              Petit
            </Button>
            <Button size="md" icon={Plus}>
              Moyen
            </Button>
            <Button size="lg" icon={Plus}>
              Grand
            </Button>
            <Button size="xl" trailingIcon={ArrowRight}>
              Créer mon compte gratuit
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button icon={Send} loading loadingLabel="Envoi…">
              Envoyer
            </Button>
            <Button icon={Ban} disabled>
              Désactivé
            </Button>
            <IconButton icon={SlidersHorizontal} label="Filtrer" variant="secondary" />
            <IconButton icon={Search} label="Rechercher" />
          </div>
        </div>
      </Section>

      <Section
        id="champs"
        title="Champs"
        description="40 px, libellé visible, icône à gauche, cinq états : repos, focus, erreur, valide, désactivé."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Adresse email"
            name="demo-email"
            type="email"
            icon={Mail}
            placeholder="nom@exemple.com"
            hint="Nous y enverrons le lien de confirmation."
          />
          <FormField
            label="Poste recherché"
            name="demo-job"
            icon={Briefcase}
            placeholder="Comptable, chargé de projet…"
          />
          <PasswordField
            label="Mot de passe"
            name="demo-password"
            icon={Lock}
            placeholder="Au moins 12 caractères"
            defaultValue="motdepasse"
            error="Au moins 12 caractères."
            showLabel="Afficher le mot de passe"
            hideLabel="Masquer le mot de passe"
          />
          <FormField
            label="Prénom"
            name="demo-first"
            icon={User}
            placeholder="Ex. : Aminata"
            defaultValue="Aminata"
            valid
          />
          <CountrySelect
            countries={COUNTRIES}
            label="Pays de résidence"
            value={country}
            onChange={setCountry}
          />
          <FormField
            label="Téléphone"
            name="demo-phone"
            icon={Phone}
            placeholder="Ex. : +223 70 00 00 00"
            defaultValue="+223"
            disabled
            optionalLabel="(facultatif)"
          />
          <Checkbox
            className="sm:col-span-2"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            label="J'accepte les conditions d'utilisation et la politique de confidentialité."
          />
        </div>
      </Section>

      <Section
        id="menus"
        title="Menus, onglets et étapes"
        description="Un seul bouton pour le thème, un seul pour la langue. Contrôle segmenté pour les filtres de vue."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="grid gap-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Logo />
              <span className="mx-2 h-5 w-px bg-line" aria-hidden="true" />
              <LanguageMenu />
              <ThemeMenu />
            </div>
            <SegmentedControl
              label="Filtrer les offres"
              value={view}
              onChange={setView}
              options={[
                { value: 'all', label: 'Toutes' },
                { value: 'active', label: 'Actives' },
                { value: 'expired', label: 'Expirées' },
              ]}
            />
          </Card>
          <Card className="grid gap-4 p-5">
            <Stepper
              current={step}
              total={2}
              label={step === 1 ? 'Vos informations' : 'Votre compte'}
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ArrowLeft}
                disabled={step === 1}
                onClick={() => setStep(1)}
              >
                Retour
              </Button>
              <Button
                size="sm"
                trailingIcon={ArrowRight}
                disabled={step === 2}
                onClick={() => setStep(2)}
              >
                Continuer
              </Button>
            </div>
          </Card>
        </div>
      </Section>

      <Section
        id="retours"
        title="Retours et statuts"
        description="Badges de statut, alertes, notifications après action, modale."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="success" dot>
                Active
              </Badge>
              <Badge tone="warning" dot>
                En modération
              </Badge>
              <Badge tone="danger" dot>
                Rejetée
              </Badge>
              <Badge dot>Expirée</Badge>
              <Badge tone="primary">CDI</Badge>
              <Badge tone="accent" icon={Sparkles}>
                Nouveau
              </Badge>
            </div>
            <Alert tone="info" title="Vérification en cours">
              Votre offre sera publiée après validation par un modérateur.
            </Alert>
            <Alert tone="success" title="Adresse confirmée">
              Vous pouvez maintenant vous connecter.
            </Alert>
            <Alert tone="warning" title="Offre bientôt expirée">
              La date limite est dans 2 jours.
            </Alert>
            <Alert tone="error" title="Code incorrect">
              Vérifiez l&apos;heure de votre téléphone, puis réessayez.
            </Alert>
          </div>
          <Card className="grid content-start gap-3 p-5">
            <p className="text-sm text-fg-muted">
              Notifications : en haut à droite sur ordinateur, en bas sur mobile.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={CircleCheck}
                onClick={() =>
                  toast.success('Offre enregistrée', 'Retrouvez-la dans « Enregistrées ».')
                }
              >
                Succès
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Info}
                onClick={() => toast.info('Nouvelle offre disponible')}
              >
                Information
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={CircleAlert}
                onClick={() => toast.error('Paiement non confirmé', 'Aucun crédit n’a été débité.')}
              >
                Erreur
              </Button>
              <Button size="sm" icon={Unlock} onClick={() => setDialogOpen(true)}>
                Ouvrir une modale
              </Button>
            </div>
          </Card>
        </div>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Débloquer cette offre ?"
          description="5 crédits seront débités de votre portefeuille."
          footer={
            <>
              <Button variant="secondary" icon={X} onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button icon={Unlock} onClick={() => setDialogOpen(false)}>
                Débloquer
              </Button>
            </>
          }
        >
          Vous accéderez aux coordonnées de candidature et au PDF original, sans limite de durée.
        </Dialog>
      </Section>

      <Section
        id="donnees"
        title="Données"
        description="Indicateurs (quatre au maximum), tableau, état vide, squelettes. Valeurs d'exemple."
      >
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Coins} label="Crédits" value="120" hint="12,00 USD" />
            <StatCard icon={Unlock} label="Offres débloquées" value="12" hint="dont 3 ce mois-ci" />
            <StatCard
              icon={HandCoins}
              label="Gains disponibles"
              value="8,40"
              trend={{ value: '+1,35', positive: true }}
              hint="USD cette semaine"
            />
            <StatCard icon={Files} label="Documents" value="3" hint="1 CV, 2 lettres" />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Offre</Th>
                <Th>Pays</Th>
                <Th>Statut</Th>
                <Th numeric>Déblocages</Th>
                <Th numeric>Commission</Th>
              </tr>
            </thead>
            <tbody>
              <Tr>
                <Td>Chargée de projet santé communautaire</Td>
                <Td>{flagEmoji('SN')} Sénégal</Td>
                <Td>
                  <Badge tone="success" dot>
                    Active
                  </Badge>
                </Td>
                <Td numeric>18</Td>
                <Td numeric>2,70 USD</Td>
              </Tr>
              <Tr>
                <Td>Analyste financier junior</Td>
                <Td>{flagEmoji('CI')} Côte d&apos;Ivoire</Td>
                <Td>
                  <Badge tone="warning" dot>
                    En modération
                  </Badge>
                </Td>
                <Td numeric>0</Td>
                <Td numeric>0,00 USD</Td>
              </Tr>
              <Tr>
                <Td>Stage data analyst</Td>
                <Td>{flagEmoji('KE')} Kenya</Td>
                <Td>
                  <Badge dot>Expirée</Badge>
                </Td>
                <Td numeric>41</Td>
                <Td numeric>6,15 USD</Td>
              </Tr>
            </tbody>
          </Table>
          <div className="grid gap-4 lg:grid-cols-2">
            <EmptyState
              icon={Bookmark}
              title="Aucune offre enregistrée"
              description="Enregistrez les offres qui vous intéressent pour les retrouver ici et suivre leur date limite."
              action={
                <Button size="sm" icon={Search}>
                  Rechercher des offres
                </Button>
              }
            />
            <Card>
              <CardHeader
                title="Chargement"
                description="Squelettes à la forme du contenu final."
              />
              <div className="grid gap-4 p-4">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-lg" />
                    <div className="grid flex-1 gap-1.5">
                      <Skeleton className="h-2.5 w-3/4" />
                      <Skeleton className="h-2 w-2/5" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name="Aminata Traoré" size="sm" />
            <Avatar name="Kofi Mensah" />
            <Avatar name="Awa Diallo" size="lg" />
            <Wallet className="ml-2 size-5 text-fg-subtle" aria-hidden="true" />
            <span className="text-xs text-fg-subtle">Icônes Lucide, trait 1,75</span>
          </div>
        </div>
      </Section>
    </div>
  );
}
