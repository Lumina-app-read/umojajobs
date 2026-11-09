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
cp .env.example .env    # puis remplacer les mots de passe locaux
pnpm docker:up          # PostgreSQL, Redis, Mailpit
pnpm dev                # web sur http://localhost:3000, API sur http://localhost:4000/api/v1/health
```

## Commandes

| Commande                              | Rôle                                        |
| ------------------------------------- | ------------------------------------------- |
| `pnpm dev`                            | Lance le web et l'API en mode développement |
| `pnpm build`                          | Compile tous les packages et applications   |
| `pnpm lint`                           | ESLint sur tout le monorepo                 |
| `pnpm typecheck`                      | Vérification TypeScript stricte             |
| `pnpm test`                           | Tests unitaires                             |
| `pnpm test:e2e`                       | Tests de bout en bout de l'API              |
| `pnpm format` / `pnpm format:check`   | Formatage Prettier                          |
| `pnpm docker:up` / `pnpm docker:down` | Services d'infrastructure locaux            |

## Règles

Aucun secret dans le dépôt : les fichiers `.env` sont ignorés par Git. Seul `.env.example`, sans valeur réelle, est versionné.
