# OPPORTINITIES — Rapport de la phase 1d : interface, traductions, thèmes et pages d'authentification

- Date : 9 novembre 2026
- Statut : **réalisée et vérifiée**, y compris dans un vrai navigateur. Rien n'est commité ; en attente de votre validation.

## 1. Objectif

Livrer l'interface utilisateur de l'authentification sur le socle des phases 1a à 1c :
- bilinguisme FR/EN ;
- thèmes clair, sombre et système, sans flash au chargement ;
- design system ;
- sélecteur de pays ;
- pages reliées à l'API.

## 2. Fonctionnalités réalisées

- **Traductions centralisées** : nouveaux catalogues `common`, `auth`, `errors` et `validation` dans `@opportinities/i18n`. Chaque code d'erreur de l'API est traduit. Routes préfixées `/fr` et `/en` avec next-intl (`proxy.ts` de Next 16), langue mémorisée, bascule sans perte de la page courante.
- **Thèmes** : clair, sombre et système. Préférence mémorisée dans un cookie d'un an. Un script exécuté dans le `<head>` applique le thème avant le premier affichage (pas de flash), et le mode système suit les changements du système d'exploitation.
- **Design system** : IBM Plex Sans auto-hébergée, jetons de couleur pour les deux thèmes (contraste WCAG AA). Composants accessibles : boutons, champs avec aide et erreur reliées, champ mot de passe afficher/masquer, alertes, cartes, lien d'évitement vers le contenu.
- **Sélecteur de pays** recherchable au clavier (Headless UI) : recherche sur les noms FR et EN, le code ISO ou l'indicatif, sans tenir compte des accents ; drapeau et indicatif affichés ; pays actifs lus depuis l'API.
- **Drapeaux sous Windows** : Windows n'affiche pas les drapeaux emoji (défaut découvert pendant l'essai dans le navigateur). Une police de drapeaux Twemoji (77 Ko, CC BY 4.0) est chargée uniquement là où ils manquent, depuis notre propre domaine.
- **Pages** :
  - inscription (avec écran « vérifiez votre boîte ») ;
  - connexion (renvoi de l'email si l'adresse n'est pas confirmée) ;
  - vérification de l'email ;
  - mot de passe oublié et réinitialisation (jeton lu dans le fragment `#token`, puis effacé de la barre d'adresse) ;
  - double authentification : inscription par QR code généré localement, codes de secours affichés une seule fois, vérification par code ou code de secours ;
  - tableau de bord provisoire, pages légales provisoires, page 404 traduite.
- **Redirections côté serveur** selon la session : vers la connexion, vers l'activation ou la vérification du TOTP, ou vers le tableau de bord. L'en-tête affiche le tableau de bord et la déconnexion quand une session est ouverte.
- **Même origine** : `/api` est relayé vers NestJS par Next.js. En-têtes de sécurité ajoutés (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`), et `Referrer-Policy: no-referrer` sur les pages qui lisent un jeton.
- **Attributions** GeoNames et Twemoji dans le pied de page.
- **Contrats d'API partagés** (`packages/shared/src/api-contracts.ts`) : les DTO NestJS les implémentent, donc tout écart entre l'API et l'interface est détecté à la compilation.

## 3. Tests et vérifications

| Vérification | Résultat |
|---|---|
| Tests de l'interface (Vitest et Testing Library) : validation, script anti-flash, client API et CSRF, couverture des traductions, sélecteur de pays, formulaires | **37/37 OK** |
| Tests i18n : parité FR/EN des clés, paramètres et balises ; aucun message vide | **5/5 OK** |
| Tests de l'API : unitaires et intégration | **85/85 et 49/49 OK** |
| Lint, vérification des types, build, formatage (sans cache) | OK |
| **Essai complet dans le navigateur intégré** | Inscription, email reçu dans Mailpit, confirmation, connexion, tableau de bord. Thème sombre conservé au rechargement. Bascule FR/EN. Promotion admin, activation du TOTP, codes de secours, déconnexion, reconnexion validée par un code de secours. Affichage mobile à 375 px sans débordement. |

## 4. Dépendances ajoutées (web, versions exactes)

| Rôle | Paquets |
|---|---|
| Production | next-intl 4.14.9, @headlessui/react 2.2.10, lucide-react 1.70.0, qrcode 1.5.4, country-flag-emoji-polyfill 0.1.10, server-only 0.0.1 |
| Tests | vitest 5.1.0, vite 8.3.7, @vitejs/plugin-react 6.3.0, jsdom 31.0.0, @testing-library/react 16.3.3, @testing-library/user-event 14.6.8, @testing-library/jest-dom 7.0.1 |

## 5. Migrations

Aucune.

## 6. Risques et limites

- **Avertissement React en développement** (« script tag while rendering ») dû au script anti-flash. Il est sans effet, car le script s'exécute bien dans le HTML serveur. À revoir avec la politique CSP à nonce prévue en phase 5.
- **Pas de tests de bout en bout Playwright** : le téléchargement des navigateurs est trop lourd sur la connexion actuelle. Le parcours a été vérifié manuellement dans le navigateur. Playwright est prévu en phase 5.
- **Pages légales** : textes provisoires, avec un message honnête. Bloquant pour la mise en production (D13).
- **Base de développement** : elle contient le compte d'essai `navigateur.…@example.test` (rôle admin, TOTP activé).
- **Pendant le développement**, toute modification des catalogues de traduction doit être suivie d'une recompilation du package i18n (`pnpm build`), à défaut de relancer `pnpm dev`.

## 7. Décisions nécessaires

1. Autoriser le **commit** de la phase 1d.
2. Lancer ensuite la **phase 1e** : tableaux de bord utilisateur et administrateur, profil et préférences synchronisés avec le compte, sessions administrateur plus courtes.
