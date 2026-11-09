# OPPORTINITIES — Rapport de l'étape D1 : fondations du design system

- Date : 9 novembre 2026
- Statut : **réalisée et vérifiée**. Rien n'est commité ; en attente de votre validation.
- Référence : `docs/DESIGN_SYSTEM.md` (v1.0). Page de démonstration : `http://localhost:3000/fr/design` (développement uniquement).

## 1. Objectif

Poser les fondations visuelles réutilisables avant de refaire les pages :
- jetons ;
- typographie ;
- composants ;
- page de référence.

Les écrans existants sont migrés vers ces fondations. La refonte des pages elles-mêmes suit en D2 à D5.

## 2. Réalisé

- **Typographie** : Plus Jakarta Sans (police variable auto-hébergée via `next/font`) remplace IBM Plex Sans. Décision inscrite dans `CLAUDE.md` §14 et dans le cahier des charges §3.
- **Jetons** (`apps/web/src/app/globals.css`) :
  - couleurs sémantiques pour les deux thèmes (`canvas`, `surface`, `surface-2`, `surface-raised`, `line`, `fg`, `fg-muted`, `fg-subtle`, `primary`, `brand`, `navy`, `accent`, états) ;
  - ombres (et reflet en mode sombre) ;
  - échelle des titres (`display-xl` à `heading-md`) ;
  - animations : fondu, glissement d'étape et reflet de chargement, désactivés si l'utilisateur demande moins d'animations.
- **Contrastes mesurés** : tous les couples texte/fond atteignent au moins 4,5:1, et la bordure de focus au moins 3:1, dans les deux thèmes. Quatre couples ont été corrigés :
  - l'ambre sur son fond clair ;
  - le texte discret sur une surface grise ;
  - le texte blanc sur le bleu des boutons en sombre ;
  - le bleu sur fond bleuté en sombre.
- **Composants** (`apps/web/src/components/ui`) :

| Composant | Rôle |
|---|---|
| `Button`, `IconButton` | 5 variantes (`primary`, `secondary`, `ghost`, `danger`, `link`), 4 tailles (32, 36, 40, 48 px), icônes avant et après, état de chargement |
| `FormField`, `PasswordField`, `Checkbox` | Champs de 40 px, icône à gauche, cinq états (repos, focus, erreur, valide, désactivé), aide et erreur reliées au champ ; texte en 16 px sur mobile pour éviter le zoom d'iOS |
| `CountrySelect` | Habillé comme les champs, liste au style des menus, icône de lieu |
| `SelectMenu` | Base commune des menus de sélection (Headless UI Listbox) |
| `ThemeMenu` | **Un seul bouton** dont l'icône suit la préférence (soleil, lune, écran), avec un menu Clair / Sombre / Système |
| `LanguageMenu` | **Un seul bouton** (globe et code de langue), avec un menu Français / English, chaque langue écrite dans sa propre langue |
| `Badge`, `Alert` | Six tons ; alertes avec titre et action |
| `Toaster` / `toast` | Notifications après action : disparition automatique en 5 s, erreurs persistantes ; en haut à droite sur ordinateur, en bas sur mobile |
| `Dialog` | Modale accessible ; s'ouvre depuis le bas de l'écran sur mobile |
| `Stepper`, `SegmentedControl` | Progression d'un parcours, filtres de vue |
| `Table` | Tableau sobre (`Th`, `Tr`, `Td`) |
| `Card`, `CardHeader`, `StatCard`, `EmptyState`, `Skeleton`, `Avatar`, `Spinner` | Cartes, indicateurs, états vides, chargement |
| `Logo` | Logotype provisoire, en attente du logo définitif |

- **Migration** des écrans existants vers les nouveaux jetons : en-tête (menus uniques, collant et translucide), pied de page, formulaires d'authentification (icônes Lucide), tableau de bord provisoire.
- **`cn` avec `tailwind-merge`** : quand deux classes Tailwind visent la même propriété, la dernière l'emporte toujours. Ce risque a été révélé par un vrai défaut, décrit au §4.
- **Page `/design`** : tous les composants et leurs états, en clair et en sombre. Elle renvoie une 404 en production. C'est un outil interne : ses textes de démonstration ne passent pas par le catalogue de traduction.

## 3. Vérifications

| Vérification | Résultat |
|---|---|
| Tests web (Vitest) : menus de thème et de langue, notifications, étapes, bouton, champ, fusion de classes, plus les tests existants | **47/47 OK** |
| Tests i18n et API (unitaires) | 5/5 et 85/85 OK |
| Lint, vérification des types, build, formatage (sans cache) | OK |
| Contrôle visuel dans le navigateur | Page `/design` en sombre et en clair, connexion sur mobile (375 px) : rendu conforme, aucun débordement horizontal |

## 4. Problèmes rencontrés

| Problème | Résolution |
|---|---|
| Bouton « Supprimer » saumon avec un texte foncé en mode sombre, hors charte. | Jeton `danger-solid` (`#D92D20`), identique dans les deux thèmes, texte blanc. |
| Sur mobile, le bouton « Connexion » devait être masqué mais restait visible, à cause de deux classes d'affichage en conflit (`inline-flex` et `hidden`). | Variante `max-sm:hidden`, plus adoption de `tailwind-merge` pour supprimer toute la famille de conflits. |
| L'en-tête dépassait de 42 px sur un téléphone de 375 px (défilement horizontal). | Menu de langue sans chevron sur mobile, bouton d'inscription compact, nom masqué sous 360 px (la pastille reste). |
| Un test a échoué à cause de l'ordre d'initialisation de `vi.mock`. | Simulation chargée de façon asynchrone. |

## 5. Dépendances ajoutées

Aucune bibliothèque d'interface supplémentaire, à une exception près : **`tailwind-merge` 3.7.0** (environ 7 Ko compressé), qui fusionne les classes Tailwind de façon fiable. Les icônes (Lucide) et les primitives accessibles (Headless UI) étaient déjà installées.

## 6. Risques et limites

- **Pages encore provisoires** : landing, inscription et tableau de bord gardent leur structure actuelle (seul leur habillage est migré). Elles seront refaites en D3 à D5.
- **En-tête sans menu mobile complet** : sur téléphone, l'accès à « Connexion » se fait par le landing et les pages d'authentification. La navigation complète arrive en D2.
- **Pages désormais rendues à la demande** : l'en-tête lit le cookie de session pour afficher le bon état. Le coût est faible ; à optimiser si nécessaire en D2.
- **Logo provisoire** : un logo définitif reste à concevoir.

## 7. Décisions nécessaires

1. Valider l'étape D1 et autoriser son commit.
2. Lancer **D2 — Navigation** : en-tête produit complet avec menu mobile en tiroir, pied de page en quatre colonnes, structure de navigation commune au site public.
