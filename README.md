# OPPORTINITIES

Plateforme SaaS panafricaine d'opportunités professionnelles et de création de documents de candidature.

- Référence technique : [`CLAUDE.md`](CLAUDE.md)
- Cahier des charges : [`docs/CAHIER_DE_CHARGFE.md`](docs/CAHIER_DE_CHARGFE.md)
- Rapports de phase : [`docs/`](docs)

## Structure

```
apps/
  web/        Next.js (App Router), Tailwind CSS — interface utilisateur et administration
  api/        NestJS — API REST versionnée (/api/v1), documentation Swagger en développement (/api/docs)
packages/
  shared/     Types et constantes partagés (compilés en CommonJS + déclarations)
  config/     Configurations TypeScript et ESLint partagées
infrastructure/
  compose/    Docker Compose de développement (PostgreSQL, Redis, Mailpit)
docs/         Cahier des charges, rapports d'audit et de phase
```

## Prérequis

- Node.js 24 LTS (voir `.nvmrc`)
- pnpm 10 (`corepack enable`)
- Docker Desktop (moteur WSL 2 sous Windows)

## Démarrage local

```bash
pnpm install
cp .env.example .env    # puis remplacer les mots de passe et générer APP_ENCRYPTION_KEY
pnpm docker:up          # PostgreSQL, Redis, Mailpit
pnpm db:deploy          # applique les migrations Prisma
pnpm db:seed            # pays, villes, rôles et permissions (idempotent)
pnpm dev                # web sur http://localhost:3000, API sur http://localhost:4000/api/v1/health
```

Les emails envoyés en développement sont capturés par Mailpit : http://localhost:8025.

## Authentification (API)

- Sessions serveur révocables, cookie `HttpOnly` / `SameSite=Lax` (`Secure` et préfixe `__Host-` en production).
- Protection CSRF : jeton obtenu par `GET /api/v1/auth/csrf`, à renvoyer dans l'en-tête `X-CSRF-Token` ; origine vérifiée.
- Double authentification TOTP obligatoire pour `admin` et `super_admin`.
- Premier administrateur d'un environnement : `pnpm role:grant <email> super_admin` (après inscription et vérification de l'email).
- Documentation interactive des routes : http://localhost:4000/api/docs (hors production).

## Base de données

- Schéma : `apps/api/prisma/schema.prisma` (Prisma 7, client généré dans `apps/api/src/generated/`, non versionné).
- Migrations versionnées : `apps/api/prisma/migrations/`. Nouvelle migration : `pnpm db:migrate --name <nom>`.
- Référentiel des pays : `packages/shared/src/countries.ts` (source unique pour le web, l'API et le seed).
- Villes : `apps/api/prisma/seed/data/cities-africa.tsv`, dérivé de [GeoNames](https://www.geonames.org/) (CC BY 4.0, voir `ATTRIBUTION.md`).
- Les tests de bout en bout démarrent leurs propres PostgreSQL, Redis et Mailpit avec Testcontainers (Docker requis).

## Commandes

| Commande                              | Rôle                                         |
| ------------------------------------- | -------------------------------------------- |
| `pnpm dev`                            | Lance le web et l'API en mode développement  |
| `pnpm build`                          | Compile tous les packages et applications    |
| `pnpm lint`                           | ESLint sur tout le monorepo                  |
| `pnpm typecheck`                      | Vérification TypeScript stricte              |
| `pnpm test`                           | Tests unitaires                              |
| `pnpm test:e2e`                       | Tests de bout en bout et d'intégration (API) |
| `pnpm db:migrate` / `pnpm db:deploy`  | Migrations (développement / déploiement)     |
| `pnpm db:seed`                        | Référentiel pays et villes                   |
| `pnpm db:studio`                      | Explorateur de données Prisma                |
| `pnpm format` / `pnpm format:check`   | Formatage Prettier                           |
| `pnpm docker:up` / `pnpm docker:down` | Services d'infrastructure locaux             |

## Règles

Aucun secret dans le dépôt : les fichiers `.env` sont ignorés par Git. Seul `.env.example`, sans valeur réelle, est versionné.
