# OPPORTINITIES — Rapport de la phase 1a : socle du monorepo

- Date : 9 novembre 2026
- Statut : **réalisée et entièrement vérifiée** sous Node 24.22.2 avec Docker Desktop, le 9 novembre 2026. En attente de votre validation et de l'autorisation de commit.
- Aucune logique métier n'a été écrite, comme prévu.

## 1. Objectif

Mettre en place le socle technique :
- dépôt Git ;
- monorepo pnpm et Turborepo ;
- squelettes Next.js et NestJS ;
- packages partagés ;
- Docker Compose de développement ;
- intégration continue.

## 2. Fonctionnalités réalisées

| Élément | Détail |
|---|---|
| Git | Dépôt initialisé sur la branche `main`. **Aucun commit** n'est fait pour l'instant. |
| Monorepo | Espaces de travail pnpm (`apps/*`, `packages/*`). Turborepo orchestre `build`, `dev`, `lint`, `typecheck`, `test` et `test:e2e` dans l'ordre des dépendances. |
| `packages/config` | Configurations TypeScript strictes (base, NestJS, Next.js, bibliothèque) et ESLint avec vérification des types. |
| `packages/shared` | Compilé en CommonJS avec déclarations. Contient le nom de la marque, le préfixe et la version de l'API, et les langues `fr` / `en`. Il est utilisé par l'API et par le web, ce qui valide le câblage du monorepo. |
| `apps/api` (NestJS 12) | Préfixe `/api`, versionnement par URL (`/api/v1`) et en-têtes de sécurité (Helmet). Validation globale stricte des entrées (`whitelist`, `forbidNonWhitelisted`). Variables d'environnement validées au démarrage, sans jamais afficher leurs valeurs. Swagger sur `/api/docs`, désactivé en production. Route `GET /api/v1/health`. |
| `apps/web` (Next.js 16, React 19, Tailwind 4) | App Router, police IBM Plex Sans auto-hébergée via `next/font`, en-tête `X-Powered-By` désactivé, page provisoire affichant le nom de la marque. |
| Docker Compose de développement | PostgreSQL 17.11, Redis 7.4.12 (persistance AOF et mot de passe obligatoire), Mailpit 1.33.1 pour capturer les emails. Ports liés à `127.0.0.1`, contrôles de santé, variables obligatoires. |
| CI GitHub Actions | Installation verrouillée, formatage, lint, types, tests unitaires et e2e, build, validation du Compose. |
| Configuration locale | `.env.example` versionné, sans valeur réelle. Un `.env` local a été créé avec des mots de passe aléatoires ; il est ignoré par Git et n'a jamais été affiché. |

## 3. Fichiers créés

- **Racine** : `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `.gitignore`, `.gitattributes`, `.editorconfig`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`, `.env.example`, `README.md`.
- **`packages/config/`** : `package.json`, `tsconfig/{base,library,nestjs,nextjs}.json`, `eslint/base.mjs`.
- **`packages/shared/`** : `package.json`, `tsconfig.json`, `eslint.config.mjs`, `src/{index,app,locales}.ts`.
- **`apps/api/`** :
  - configuration : `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `eslint.config.mjs` ;
  - sources : `src/main.ts`, `src/app.module.ts`, `src/app.setup.ts`, `src/config/env.validation.ts` et son test, `src/health/` (contrôleur, DTO, module, test) ;
  - tests de bout en bout : `test/health.e2e-spec.ts`, `test/jest-e2e.config.js`.
- **`apps/web/`** :
  - configuration : `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs` ;
  - sources : `src/app/{layout.tsx,page.tsx,globals.css}`.
- **Infrastructure et CI** : `infrastructure/compose/docker-compose.dev.yml`, `.github/workflows/ci.yml`.
- **Documentation** : `docs/PHASE_1A_RAPPORT.md`.

## 4. Fichiers modifiés

Aucun fichier existant en dehors de ceux listés ci-dessus. `CLAUDE.md` et les documents de `docs/` ne sont pas modifiés par cette phase.

## 5. Migrations

Aucune. PostgreSQL et Prisma arrivent en phase 1b.

## 6. Dépendances (versions exactes)

| Rôle | Paquets |
|---|---|
| Outillage racine | turbo 2.11.10, prettier 3.9.10 |
| TypeScript | typescript **6.0.3** |
| Lint | eslint **9.39.5**, @eslint/js 9.39.4, typescript-eslint 8.72.1, eslint-config-next 16.4.5 |
| API | @nestjs/common, core, platform-express et testing 12.4.1 ; @nestjs/config et swagger 12.1.1 ; class-validator 0.15.1, class-transformer 0.5.1, helmet 8.3.0, reflect-metadata 0.2.2, rxjs 7.8.2 |
| Tests API | jest 30.5.2, ts-jest 29.4.15, supertest 7.3.2 |
| Web | next 16.4.5, react et react-dom 19.3.1, tailwindcss et @tailwindcss/postcss 4.3.5 |
| Types | @types/node 24.19.2, @types/react et @types/react-dom 19.3.0, @types/jest 30.0.0, @types/supertest 7.2.1 |

Choix de versions :

- **TypeScript 6.0.3 au lieu de 7.0.** La version 7.0 est sortie, mais ts-jest (< 7), typescript-eslint (< 6.1) et le CLI NestJS (~6.0) ne la prennent pas encore en charge.
- **ESLint 9 au lieu de 10.** `eslint-plugin-react`, utilisé par la configuration Next.js, ne prend pas encore en charge ESLint 10.
- **Scripts d'installation bloqués** (comportement par défaut de pnpm 10), y compris la télémétrie `@scarf/scarf` embarquée par Swagger UI.

## 7. Tests exécutés

| Vérification | Résultat |
|---|---|
| `pnpm format:check` | OK |
| `pnpm lint` (4 packages, avec vérification des types) | OK, 0 erreur |
| `pnpm typecheck` | OK |
| `pnpm build` (shared, api, web) | OK |
| `pnpm test` : tests unitaires de l'API (validation d'environnement, contrôleur de santé) | **5/5 OK** (Node 24.22.2) |
| `pnpm test:e2e` : santé, en-têtes de sécurité, route non versionnée refusée, Swagger désactivé | **4/4 OK** (Node 24.22.2) |
| Relance complète sous Node 24 (`--force`, sans cache) | Formatage, lint, types, tests et build : OK |
| Démarrage réel de l'API compilée | OK : `GET /api/v1/health` renvoie `{"status":"ok"}`, la route non versionnée renvoie 404, Swagger est actif en développement, CSP et `nosniff` sont présents, `X-Powered-By` est absent, et le port fourni en texte est bien converti. |
| Démarrage réel du web compilé | OK : HTTP 200, `lang="fr"`, police IBM Plex servie en woff2 depuis le domaine, `X-Powered-By` absent. |
| `docker compose config` | OK |
| Démarrage des conteneurs | **OK** : les 3 services sont `healthy` et liés à `127.0.0.1`. PostgreSQL 17.11 répond aux requêtes. Redis refuse les connexions sans mot de passe (`NOAUTH`), répond `PONG` avec mot de passe et a la persistance AOF active. L'interface Mailpit répond (HTTP 200, v1.33.1). |
| CI GitHub Actions | Non exécutée : aucun dépôt distant (décision D9). |
| Contrôle Git | Aucun `.env`, `dist`, `.next` ni `node_modules` dans les fichiers suivis. |

## 8. Résultats

Toutes les vérifications passent :
- le socle compile et passe le lint et la vérification stricte des types ;
- les 9 tests passent ;
- les deux applications démarrent et répondent correctement ;
- les trois services d'infrastructure sont opérationnels.

## 9. Problèmes rencontrés

| Problème | Résolution |
|---|---|
| **Bug détecté par les tests :** `API_PORT` fourni en texte par l'environnement était refusé, parce que la conversion implicite n'a pas d'information de type. | Conversion explicite `@Type(() => Number)`. Le test passe et le démarrage réel est vérifié. |
| `Reflect.getMetadata is not a function` dans le test de configuration. | Import explicite de `reflect-metadata` dans le module de validation. |
| **Les paquets NestJS 12 sont uniquement en ESM.** L'API reste en CommonJS, comme le modèle officiel NestJS 12, et charge Nest via `require(esm)`, qui fonctionne en production dès Node 20.19. En revanche, **Jest ne prend en charge `require(esm)` qu'à partir de Node 24.9.** | Scripts de test alignés sur le modèle officiel (`node --experimental-vm-modules`). **Confirmé :** sous Node 24.22.2, tous les tests passent. La CI utilise Node 24. |
| L'image Docker MinIO n'est plus publiée depuis octobre 2025, et le projet est archivé depuis février 2026. | MinIO est retiré du Compose de la phase 1a. Le stockage objet de développement sera choisi en phase 2, quand les fichiers arrivent (voir §11). |
| Réseau lent pendant l'installation (environ 2 Ko/s par moment). | Aucun effet sur le résultat. |
| Le port 6379 est occupé sur le poste par **Memurai** (un Redis pour Windows déjà installé). | Memurai n'a pas été modifié. Le Redis du projet est exposé sur le port **6380** via le `.env` local. `.env.example` rappelle que ce port est modifiable. |
| pnpm affiche toujours « Ignored build scripts » pour `@parcel/watcher` et `@scarf/scarf`, malgré `ignoredBuiltDependencies`. | Avertissement sans effet : ces scripts sont bien bloqués, ce qui est voulu. |

## 10. Risques

- **Actions GitHub non épinglées par empreinte** (`@v5`, `@v4`). Je recommande de les épingler par SHA lorsque le dépôt distant sera créé.
- **Dépôt sans commit :** rien n'est encore sauvegardé dans l'historique Git.

## 11. Décisions nécessaires

| # | Décision | Recommandation |
|---|---|---|
| ~~1~~ | ~~Installer Node.js 24 LTS~~ | **Fait** (24.22.2). |
| ~~2~~ | ~~Démarrer Docker Desktop~~ | **Fait.** |
| 3 | Autoriser le **commit initial** sur `main`. | Oui : toutes les vérifications passent. |
| 4 | D9 : dépôt distant pour la CI. | GitHub privé. |
| 5 | Stockage objet de développement (phase 2) : SeaweedFS, RustFS ou le fork communautaire de MinIO. | À trancher en phase 2. Je préparerai une comparaison courte. |

## 12. Recommandation pour la suite

1. Valider la phase 1a et autoriser le commit initial.
2. Passer ensuite à la **phase 1b** : PostgreSQL, Prisma 7, les 54 pays et les villes. Il faudra pour cela trancher D6 (couverture des villes ; je recommande GeoNames, villes de plus de 5 000 habitants).

Les conteneurs de développement sont laissés démarrés. Pour les arrêter : `pnpm docker:down`.
