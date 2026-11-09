# OPPORTINITIES — Rapport de la phase 1c : authentification, sessions, rôles et sécurité

- Date : 9 novembre 2026
- Statut : **réalisée et vérifiée**. En attente de votre validation et de l'autorisation de commit.
- Périmètre : **API uniquement**. Les écrans (inscription, connexion, TOTP) arrivent en phase 1d, avec le système de traduction de l'interface et le design system.

## 1. Objectif

Mettre en place l'identité des utilisateurs et la sécurité d'accès :
- inscription avec pays obligatoire ;
- vérification de l'email ;
- connexion avec sessions révocables ;
- réinitialisation et changement du mot de passe ;
- rôles et permissions ;
- double authentification des administrateurs (décision D7) ;
- protection CSRF, limitation du nombre de requêtes et verrouillage contre la force brute ;
- journal de sécurité et format d'erreur unique.

## 2. Fonctionnalités réalisées

### Routes de l'API (`/api/v1`)

| Route | Accès | Rôle |
|---|---|---|
| `GET /auth/csrf` | public | Jeton CSRF (cookie + corps) |
| `POST /auth/register` | public | Inscription : prénom, nom, email, pays africain, mot de passe, confirmation, acceptation des conditions, langue facultative |
| `POST /auth/verify-email` · `POST /auth/verify-email/resend` | public | Vérification de l'email (lien à usage unique, valable 24 h) |
| `POST /auth/login` | public | Connexion : cookie de session et nouveau jeton CSRF |
| `POST /auth/logout` · `POST /auth/logout-all` | session | Déconnexion de la session courante, ou de toutes les sessions |
| `GET /auth/me` | session | Profil, rôles, permissions, état de la double authentification |
| `GET /auth/sessions` · `DELETE /auth/sessions/:id` | session | Liste des appareils connectés et révocation d'une session |
| `POST /auth/password/forgot` · `POST /auth/password/reset` | public | Réinitialisation par lien (60 min, usage unique) |
| `POST /auth/password/change` | session | Changement, avec le mot de passe actuel exigé |
| `POST /auth/mfa/totp/setup` · `/totp/enable` · `/verify` | session | Inscription du TOTP, codes de secours, validation de la session |
| `GET /admin/security-events` | `admin.access` + `security_events.read` | Journal de sécurité (filtres, pagination) |

### Mesures de sécurité

| Exigence (CLAUDE.md §6 et §16) | Mise en œuvre |
|---|---|
| Hachage des mots de passe | **Argon2id** (19 Mio, t=2, p=1, recommandation OWASP). |
| Politique de mot de passe | 12 à 128 caractères, sans règle de composition (NIST SP 800-63B). Refus des mots de passe courants et de ceux qui contiennent l'email ou le nom. |
| Sessions révocables | Jeton aléatoire de 256 bits dans un cookie `HttpOnly`, `SameSite=Lax`, avec `Secure` et le préfixe `__Host-` en production. **Seule l'empreinte SHA-256 est stockée.** Durée maximale 30 jours, déconnexion après 7 jours d'inactivité (configurables). |
| CSRF | Toutes les requêtes qui modifient des données doivent avoir une origine autorisée **et** un en-tête `X-CSRF-Token` identique au cookie CSRF. Le jeton est renouvelé à chaque connexion. |
| Force brute | Limite par IP stockée dans Redis et partagée entre instances (connexion : 10 par minute ; inscription : 10 par heure ; mot de passe oublié : 5 par heure ; TOTP : 5 par minute ; 120 par minute par défaut). **Verrouillage du compte pendant 15 minutes après 5 échecs** (mot de passe ou TOTP), avec révocation de ses sessions. |
| Pas d'énumération des comptes | Réponses identiques que l'adresse existe ou non (inscription, renvoi de vérification, mot de passe oublié, connexion). Le titulaire d'un compte existant est prévenu par email d'une tentative d'inscription. Une adresse inconnue est verrouillée exactement comme un vrai compte. Une vérification factice garde le même temps de réponse. |
| Double authentification | TOTP RFC 6238 implémenté et validé sur les **vecteurs de test officiels RFC 4226 et 6238**. Secret **chiffré AES-256-GCM** en base. Anti-rejeu (un code ne sert qu'une fois). 10 codes de secours à usage unique. **Obligatoire pour admin et super_admin**, évalué selon les rôles *actuels* : une promotion s'applique dès la requête suivante. Facultatif pour les autres rôles (s'il est activé, il est exigé). |
| Rôles et permissions | `user`, `moderator`, `admin`, `super_admin`, avec 8 permissions vérifiées côté serveur. Toutes les routes exigent une session par défaut (`@Public` pour les exceptions). Premier super_admin créé en ligne de commande (`pnpm role:grant`), opération journalisée. |
| Journal de sécurité | 20 types d'événements, avec IP, User-Agent et identifiant de requête. **Ajout seul, garanti par trigger PostgreSQL** (UPDATE, DELETE et TRUNCATE refusés). Aucun mot de passe, jeton ni code n'est journalisé ; les emails inconnus sont pseudonymisés par SHA-256. |
| Jetons envoyés par email | Aléatoires, à usage unique, consommés de façon atomique, stockés en empreinte. Placés dans le **fragment de l'URL** (`#token=`) : ils n'apparaissent jamais dans les journaux des serveurs ni dans l'en-tête Referer. |
| Format d'erreur unique | `{ statusCode, code, requestId, details?, meta? }`. Codes traduisibles partagés (`packages/shared`), sans message technique, trace ni valeur saisie. |
| Traçabilité | Identifiant de requête (`X-Request-Id`) sur chaque réponse, repris dans les journaux. Celui transmis par Nginx est conservé s'il est bien formé. |
| Configuration | 23 variables validées au démarrage, sans jamais afficher de valeur. Cookies `Secure` imposés en production. |

### Emails bilingues

Création du package **`@opportinities/i18n`**, système de traduction centralisé partagé avec l'interface à partir de la phase 1d. Il contient 4 emails en FR et EN : vérification, tentative d'inscription sur un compte existant, réinitialisation, confirmation de changement de mot de passe. Un test vérifie que les deux langues ont exactement les mêmes clés et paramètres. L'envoi passe par SMTP : Mailpit en développement, Brevo en production.

## 3. Fichiers créés

- **`packages/i18n/`** : package complet, avec catalogues `fr` et `en`, traducteur et tests.
- **`packages/shared/src/`** : `auth.ts` (rôles, permissions, règles de mot de passe, états MFA).
- **`apps/api/src/`** :
  - `auth/` : contrôleurs, services, DTO, guards, RBAC, TOTP et leurs tests ;
  - `security/` : CSRF, cookies, stockage Redis du limiteur, décorateurs ;
  - `common/http/` : filtre d'erreurs, identifiant de requête, contexte client ;
  - `common/crypto/` : jetons, chiffrement AES-256-GCM ;
  - `mail/`, `redis/`, `security-events/`, `admin/security-events.controller.ts`.
- **`apps/api/`** :
  - migrations : `prisma/migrations/20261109112542_add_auth/`, `…112758_remove_session_mfa_required/` ;
  - seed : `prisma/seed/roles.ts` ;
  - script : `scripts/grant-role.ts` ;
  - tests : `test/auth.e2e-spec.ts`, `test/admin-mfa.e2e-spec.ts`, `test/support/`.
- **`docs/`** : `PHASE_1C_RAPPORT.md`.

## 4. Fichiers modifiés

- **Racine** : `package.json` (`role:grant`), `pnpm-workspace.yaml`, `.env.example` (nouvelles variables, sans valeur réelle), `README.md`.
- **`packages/shared/src/`** : `errors.ts` (codes d'authentification, format `ApiErrorBody`), `index.ts`.
- **`apps/api/`** :
  - schéma et seed : `prisma/schema.prisma`, `prisma/seed/index.ts` ;
  - application : `src/app.module.ts` (guards globaux, filtre), `src/app.setup.ts`, `src/main.ts` ;
  - configuration : `src/config/env.validation.ts` et son test ;
  - santé : `src/health/` (Redis ajouté à la sonde de disponibilité) ;
  - référentiel : `src/locations/locations.controller.ts` (`@Public`) ;
  - outillage : `package.json`, `test/setup/` (Redis et Mailpit jetables), `test/health.e2e-spec.ts`, `test/create-test-app.ts`.

## 5. Migrations

| Migration | Contenu |
|---|---|
| `20261109112542_add_auth` | Extension `citext` (emails insensibles à la casse). Types énumérés : statut, langue, thème, rôle, type de jeton, type d'événement. Tables `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions`, `verification_tokens`, `mfa_recovery_codes`, `security_events`. Contraintes `CHECK` sur l'email, les noms, le téléphone E.164 et les dates. **Triggers d'ajout seul** sur `security_events`. |
| `20261109112758_remove_session_mfa_required` | Retrait de la colonne `sessions.mfa_required`. L'obligation de double authentification est désormais calculée à partir des rôles actuels, ce qui est plus sûr. La colonne a été ajoutée puis retirée pendant la phase ; les deux migrations sont conservées, car la réinitialisation de la base de développement demande votre accord explicite. |

Aucun écart entre le schéma Prisma et la base.

## 6. Dépendances ajoutées (versions exactes)

| Paquet | Rôle |
|---|---|
| `@nestjs/throttler` 6.7.1 | Limitation du nombre de requêtes |
| `@node-rs/argon2` 2.2.2 | Argon2id, avec binaires précompilés et sans script d'installation |
| `ioredis` 5.11.1 | Client Redis |
| `nodemailer` 10.4.0 | Envoi SMTP |
| `cookie-parser` 1.4.7 | Lecture des cookies |
| `testcontainers` 12.2.1 *(dev)* | Redis et Mailpit jetables pour les tests |
| `tsx` *(dev, i18n)*, `@types/*` *(dev)* | Outillage |

**Écartés :**
- `@nestjs/authentication` (0.1), `@nestjs/authorization` (0.1) et `@nestjs/mail` (0.0.2) : versions trop jeunes pour un système qui gère de l'argent ;
- `@nest-lab/throttler-storage-redis` : non compatible avec NestJS 12 ; remplacé par un stockage Redis maison d'environ 60 lignes, utilisant un script Lua atomique ;
- `otplib` : TOTP implémenté directement et validé sur les vecteurs officiels.

## 7. Tests exécutés

| Suite | Résultat |
|---|---|
| Tests unitaires de l'API : configuration, chiffrement, TOTP (vecteurs RFC), Base32, mots de passe, RBAC, états MFA, santé, UUID, recherche | **85/85 OK** |
| Tests unitaires i18n : parité FR/EN des clés et des paramètres | **4/4 OK** |
| Tests d'intégration (PostgreSQL, Redis et Mailpit réels et jetables) | **49/49 OK** |
| Lint, vérification des types, build, formatage (sans cache) | OK |
| Essai réel sur la pile de développement | Inscription en anglais, email reçu dans Mailpit, vérification, connexion et profil OK. `role:grant admin` fonctionne, et l'accès d'administration est ensuite bloqué en `MFA_ENROLLMENT_REQUIRED`. |

Scénarios d'intégration couverts :
- **CSRF** : requête sans jeton, origine étrangère, attributs des cookies.
- **Format d'erreur et 401.**
- **Validation de l'inscription** : pays hors Afrique, conditions non acceptées, champ inconnu, confirmation différente, mot de passe faible.
- **Parcours complet** :
  - inscription avec email en majuscules et espaces ;
  - empreinte Argon2id stockée, rôle `user` attribué ;
  - connexion refusée avant vérification ;
  - email reçu en FR, avec le jeton dans le fragment et non stocké en clair ;
  - jeton refusé à la réutilisation ;
  - connexion, profil, et séquence exacte des événements de sécurité.
- **Inscription** : email en anglais ; doublon sans révélation, avec email d'avertissement ; renvoi de vérification.
- **Connexion** : erreur identique pour un compte inexistant ou un mauvais mot de passe ; verrouillage au 5ᵉ échec, même avec le bon mot de passe ensuite ; même verrouillage pour une adresse inconnue ; 429 par IP avec `Retry-After`.
- **Sessions** : liste, révocation d'une autre session, déconnexion partout, déconnexion révoquée côté serveur.
- **Réinitialisation** : mot de passe faible refusé sans consommer le jeton, sessions révoquées, jeton à usage unique, ancien mot de passe refusé, email de confirmation ; aucune fuite pour une adresse inconnue.
- **Changement de mot de passe.**
- **Journal de sécurité** : modification et suppression refusées par la base.
- **Rôles et double authentification** :
  - un utilisateur refusé (403) ;
  - un modérateur avec des permissions limitées ;
  - un administrateur : inscription TOTP imposée dès la promotion, secret chiffré, mauvais code refusé, activation avec 10 codes de secours, accès accordé ;
  - nouvelle session à valider, rejeu du code refusé, code de secours accepté une seule fois, code du pas suivant accepté ;
  - **verrouillage et révocation des sessions après 5 codes TOTP erronés.**

## 8. Résultats

L'authentification est complète côté API, conforme aux exigences de sécurité de `CLAUDE.md`, et entièrement couverte par des tests sur de vrais services.

## 9. Problèmes rencontrés

| Problème | Résolution |
|---|---|
| Une colonne `mfa_required` figeait l'obligation de double authentification au moment de la connexion. Un compte promu administrateur pendant sa session y échappait. | Calcul à partir des rôles actuels, et colonne retirée par une migration complémentaire. |
| Prisma refuse de réinitialiser la base sans accord explicite de l'utilisateur. | Migration restaurée à l'identique, puis migration complémentaire. Aucune donnée perdue, aucune action demandée. |
| Les fichiers de tests d'intégration partagent Redis : un test pouvait effacer les compteurs d'un autre. | Exécution en série (`--runInBand`). |
| **Un premier lancement complet des tests d'intégration est resté bloqué** (conteneurs de test non démarrés). | Arrêté puis diagnostiqué. Non reproduit en 4 exécutions suivantes (49/49 en 32 s). Probablement un incident ponctuel de Docker Desktop. À surveiller en CI. |
| Les tests de traduction ne pouvaient pas s'exécuter avec le support TypeScript natif de Node (package CommonJS). | Exécution via `tsx`. |

## 10. Risques et limites

- **Verrouillage utilisable comme nuisance :** un tiers peut bloquer un compte pendant 15 minutes en échouant volontairement. C'est le compromis habituel. La durée et le seuil sont configurables.
- **Envoi d'email synchrone :** si le serveur SMTP est indisponible, l'opération réussit mais l'email est perdu (erreur journalisée ; l'utilisateur peut le redemander). Une file d'envoi avec reprise est prévue en phase 5.
- **Redis indisponible :** la limite par IP est alors laissée ouverte (journalisée), et la sonde de disponibilité renvoie 503. Le verrouillage des comptes, stocké en base, reste actif.
- **Pas de vérification contre les mots de passe divulgués** (base Have I Been Pwned). Ajout possible ; voir décision 3.
- **Même durée de session pour les administrateurs.** Une durée plus courte est recommandée ; voir décision 2.
- **Pas d'écran de profil ni de préférences** (langue, thème, téléphone, ville) : prévus en phase 1e.
- **Pour la phase 1d**, l'interface devra :
  - proxifier `/api` vers l'API (même origine) ;
  - lire le jeton dans le fragment de l'URL sur les pages de vérification et de réinitialisation ;
  - appliquer `Referrer-Policy: no-referrer` sur ces pages ;
  - afficher l'attribution GeoNames.
- **Base de développement :** elle contient désormais un compte d'essai (`essai.…@example.test`, rôle admin), créé par l'essai réel. Sans incidence.

## 11. Décisions nécessaires

| # | Décision | Recommandation |
|---|---|---|
| 1 | Autoriser le **commit** de la phase 1c. | Oui. |
| 2 | Durée des sessions administrateur. | Déconnexion après 12 h d'inactivité et 7 jours maximum pour admin et super_admin (les utilisateurs gardent 7 et 30 jours). À intégrer en phase 1e. |
| 3 | Vérifier les nouveaux mots de passe contre la base des mots de passe divulgués (Have I Been Pwned, k-anonymat : seuls 5 caractères d'empreinte sont envoyés). | Oui, en phase 5, avec un mode dégradé si le service ne répond pas. |
| 4 | D10 : nom de domaine et adresse d'expédition (Brevo). | Nécessaires avant la mise en production uniquement. |
| 5 | D9 : dépôt distant pour la CI. | GitHub privé. |

## 12. Recommandation pour la suite

Valider la phase 1c, autoriser le commit, puis lancer la **phase 1d — interface** :
- `next-intl` branché sur `@opportinities/i18n`, avec des routes `/fr` et `/en` ;
- thèmes clair, sombre et système, sans flash au chargement ;
- design system IBM Plex Sans ;
- sélecteur de pays recherchable avec drapeaux ;
- pages d'inscription, de connexion, de vérification, de réinitialisation et de TOTP, reliées à l'API de la phase 1c ;
- proxy `/api` en développement ;
- attribution GeoNames.
