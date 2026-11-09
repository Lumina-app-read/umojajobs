# OPPORTINITIES — Rapport de la phase 1b : PostgreSQL, Prisma, pays et villes

- Date : 9 novembre 2026
- Statut : **réalisée et vérifiée**. En attente de votre validation et de l'autorisation de commit.
- Environnement de vérification : Node 24.22.2, Docker Desktop, PostgreSQL 17.11.

## 1. Objectif

Mettre en place la couche de persistance (PostgreSQL et Prisma 7) et le référentiel géographique : les 54 pays africains et leurs villes. C'est un prérequis du formulaire d'inscription (phase 1c), où le pays est obligatoire.

## 2. Fonctionnalités réalisées

| Élément | Détail |
|---|---|
| **Référentiel des 54 pays** | Source unique dans `packages/shared/src/countries.ts`, utilisée par l'API, le seed et bientôt le web. Contient les noms usuels et officiels en FR et EN, les codes ISO alpha-2 et alpha-3, l'indicatif E.164, la devise ISO 4217 et le fuseau IANA de la capitale. Les drapeaux sont calculés à partir du code ISO. |
| **Vérification indépendante des pays** | Les 54 entrées ont été comparées à libphonenumber-js (indicatifs), i18n-iso-countries (ISO3) et aux données ICU de Node (devises, fuseaux) : **0 écart**. Les seuls écarts de libellés sont volontaires, pour suivre les noms officiels de l'ONU (par exemple « République démocratique du Congo » plutôt que « Congo-Kinshasa »). |
| **Villes (décision D6)** | **6 479 villes** issues de GeoNames (`cities5000`, plus de 5 000 habitants ou chefs-lieux). Les 54 pays sont couverts. Les quartiers et les lieux historiques, abandonnés ou détruits sont exclus (81 lignes). Chaque ville a sa région (admin1), sa population, ses coordonnées et son fuseau propre (par exemple Lubumbashi en `Africa/Lubumbashi`). Le jeu de données est versionné, donc le seed n'a pas besoin du réseau, et il est régénérable par script. |
| **Prisma 7** | Générateur `prisma-client` (CommonJS), adaptateur `@prisma/adapter-pg`, configuration dans `prisma.config.ts`. Le client est généré automatiquement avant le build, le lint, les types et les tests (tâche Turborepo `db:generate`). |
| **Migration `init_locations`** | Tables `countries` et `cities`, type énuméré `city_source` (`geonames` ou `admin`, en prévision des ajouts par l'administration), clés étrangères `ON DELETE RESTRICT`, index trigramme GIN (`pg_trgm`) pour la recherche, et index (pays, population). Contraintes `CHECK` ajoutées : formats ISO, indicatif et devise, coordonnées dans les bornes, population positive, cohérence entre source et identifiant GeoNames. |
| **Seed idempotent** | Mise à jour des pays existants (upsert) et insertion des villes par lots de 1 000 avec `ON CONFLICT`. Le statut actif/inactif décidé par l'administration n'est jamais écrasé. Deux exécutions successives donnent toujours 54 pays et 6 479 villes. |
| **API — référentiel** | `GET /api/v1/countries` renvoie les pays actifs, avec un cache public d'une heure. `GET /api/v1/countries/:iso2/cities?q=&limit=` recherche les villes en ignorant la casse et les accents. Les villes dont le nom commence par le texte saisi passent en premier, puis le tri se fait par population. La limite par défaut est de 20 résultats, 50 au maximum. Un pays inconnu ou désactivé renvoie 404 avec le code `COUNTRY_NOT_FOUND`. |
| **Sonde de disponibilité** | `GET /api/v1/health/ready` vérifie la base de données et renvoie 503 si elle est injoignable. `GET /api/v1/health` (vivacité) ne dépend d'aucun service. |
| **Codes d'erreur partagés** | `packages/shared/src/errors.ts`. L'API renvoie des codes ; le frontend les traduira (phase 1d). |
| **Configuration** | `DATABASE_URL` est obligatoire et validé au démarrage, sans jamais afficher sa valeur. Il est ajouté à `.env.example` et au `.env` local. |

## 3. Fichiers créés

- **`packages/shared/src/`** : `countries.ts`, `errors.ts`.
- **`apps/api/`** :
  - Prisma : `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/20261109105800_init_locations/migration.sql` ;
  - seed : `prisma/seed/index.ts`, `prisma/seed/cities-dataset.ts`, `prisma/seed/data/cities-africa.tsv` (547 Ko), `prisma/seed/data/ATTRIBUTION.md` ;
  - script de génération : `scripts/geonames/build-cities-dataset.ts`.
- **`apps/api/src/`** :
  - `prisma/prisma.module.ts`, `prisma/prisma.service.ts` ;
  - `locations/` : module, contrôleur, service, DTO, `search-name.ts` et son test ;
  - `common/uuid-v7.ts` et son test.
- **`apps/api/test/`** : `create-test-app.ts`, `locations.e2e-spec.ts`, `setup/global-setup.ts`, `setup/global-teardown.ts`.
- **`docs/`** : `PHASE_1B_RAPPORT.md`.

## 4. Fichiers modifiés

- **Racine** : `package.json` (scripts `db:*`), `turbo.json` (tâche `db:generate`), `pnpm-workspace.yaml` (politique des scripts d'installation), `.gitignore` (client généré), `.prettierignore`, `.env.example` (`DATABASE_URL`), `README.md`, `.github/workflows/ci.yml`.
- **`packages/shared/src/index.ts`** : nouveaux exports.
- **`apps/api/`** :
  - configuration : `package.json`, `tsconfig.json`, `eslint.config.mjs`, `test/jest-e2e.config.js` ;
  - sources : `src/app.module.ts`, `src/config/env.validation.ts` et son test, `src/health/` (contrôleur, DTO, test) ;
  - tests : `test/health.e2e-spec.ts`.

## 5. Migrations

| Migration | Contenu |
|---|---|
| `20261109105800_init_locations` | Extension `pg_trgm`, type `city_source`, tables `countries` et `cities`, index uniques, index trigramme GIN, index (pays, population décroissante), clé étrangère `RESTRICT`, 9 contraintes `CHECK`. |

Aucun écart entre la base et le schéma : `prisma migrate diff` renvoie « No difference detected ».

## 6. Dépendances ajoutées (versions exactes)

| Paquet | Rôle |
|---|---|
| `@prisma/client` 7.10.1, `@prisma/adapter-pg` 7.10.1 | Accès à PostgreSQL (production) |
| `prisma` 7.10.1 | CLI : migrations et génération |
| `dotenv` 18.0.10 | Lecture du `.env` par la CLI Prisma et le seed (Prisma 7 ne le lit plus seul) |
| `tsx` 4.23.15 | Exécution du seed et du script GeoNames |
| `@testcontainers/postgresql` 12.2.1 | PostgreSQL jetable pour les tests d'intégration |

Scripts d'installation autorisés : `prisma`, `@prisma/engines` et `esbuild`. Ceux de Testcontainers (`ssh2`, `cpu-features`, `protobufjs`) restent bloqués, car inutiles.

## 7. Tests exécutés

| Suite | Résultat |
|---|---|
| `pnpm test` (unitaires) : validation d'environnement, santé, normalisation de recherche, UUID v7 | **21/21 OK** |
| `pnpm test:e2e` (intégration) : PostgreSQL 17.11 jetable, migrations et seed réels | **20/20 OK** |
| `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm format:check` (sans cache) | OK |
| Seed exécuté deux fois sur la base de développement | 54 pays et 6 479 villes à chaque fois, sans doublon |
| Plan d'exécution de la recherche | `Bitmap Index Scan on cities_search_name_trgm_idx` (l'index trigramme est utilisé) |
| API compilée sur la base de développement | Les 54 pays sont renvoyés ; `q=abi` en Côte d'Ivoire renvoie Abidjan en premier ; la disponibilité est confirmée ; Swagger documente les routes |
| Écart entre schéma et base | Aucun |
| `prisma generate` sans `DATABASE_URL` (cas de la CI) | OK |

Les tests d'intégration couvrent notamment :
- la présence exacte des 54 pays du référentiel ;
- au moins une ville par pays ;
- le rejet d'un code ISO invalide par la base ;
- le masquage d'un pays désactivé ;
- le tri par population et la priorité aux noms qui commencent par la recherche ;
- l'insensibilité à la casse et aux accents ;
- la neutralisation d'une tentative d'injection (`%' OR 1=1 --`) ;
- le rejet des paramètres invalides ou inconnus (400) ;
- le 404 avec un code traduisible.

## 8. Résultats

Le référentiel géographique est opérationnel, vérifié et prêt pour le formulaire d'inscription (sélecteur de pays recherchable avec drapeau et indicatif) et pour la publication d'offres (ville et fuseau horaire).

## 9. Problèmes rencontrés

| Problème | Résolution |
|---|---|
| Le client généré par Prisma 7 importe ses fichiers avec l'extension `.js`, que Jest ne sait pas résoudre. | Ajout d'un `moduleNameMapper` dans les deux configurations Jest. |
| PostgreSQL 17 n'a pas de fonction `uuidv7()` native (elle arrive en version 18), alors que les insertions en masse du seed contournent Prisma. | Petit générateur UUID v7 (RFC 9562), testé : format, horodatage, ordre et unicité. |
| Lint : comparaison entre deux constantes littérales (54 contre 54) jugée impossible par TypeScript. | Contrôle réécrit avec des variables typées `number`. Il garde son utilité à l'exécution. |

## 10. Risques et limites

- **Noms de régions en anglais.** GeoNames fournit les régions (admin1) en ASCII, souvent en anglais (par exemple « Abidjan Autonomous District »). Les noms de villes restent dans leur forme locale. Une traduction des régions pourra être ajoutée plus tard si besoin.
- **Attribution GeoNames obligatoire.** La licence CC BY 4.0 impose de mentionner GeoNames et de faire un lien vers geonames.org dans l'interface (pied de page ou page « À propos »). Prévu en phase 1d.
- **Petites localités absentes.** Les villes de moins de 5 000 habitants ne sont pas importées. Le type `admin` est prévu pour que l'administration puisse en ajouter (écran à construire en phase 1e).
- **Format des erreurs.** Les réponses d'erreur ne sont pas encore uniformisées : la validation renvoie le format NestJS par défaut. Un filtre d'erreurs global (`statusCode`, `code`, identifiant de requête) est prévu en phase 1c.
- **Rate limiting** des routes publiques : prévu en phase 1c, avec l'authentification.
- **Dossier `.claude/launch.json` non suivi**, créé par l'application de bureau pour l'aperçu du serveur de développement. Je ne l'inclurai pas dans le commit, sauf demande de votre part.

## 11. Décisions nécessaires

| # | Décision | Recommandation |
|---|---|---|
| 1 | Autoriser le **commit** de la phase 1b. | Oui. |
| 2 | D7 : double authentification (TOTP) pour les administrateurs, nécessaire à la phase 1c. | Obligatoire pour admin et super_admin. |
| 3 | D10 : nom de domaine et adresse d'expédition des emails, nécessaires pour les emails de vérification de la phase 1c. En développement, Mailpit capture les emails : ce n'est pas bloquant pour coder la 1c. | À fournir avant la mise en production. |
| 4 | D9 : dépôt distant, pour faire tourner la CI. | GitHub privé. |

## 12. Recommandation pour la suite

Valider la phase 1b, autoriser le commit, puis lancer la **phase 1c — authentification** :
- inscription (prénom, nom, email, pays obligatoire, mot de passe, acceptation des conditions) ;
- vérification de l'email ;
- connexion, avec des sessions serveur révocables dans un cookie `HttpOnly` / `Secure` / `SameSite` ;
- réinitialisation du mot de passe ;
- protection CSRF, limitation du nombre de requêtes et protection contre la force brute ;
- rôles et permissions ;
- journal des événements de sécurité ;
- filtre d'erreurs global.
