# Déploiement en production

Ce guide met Umoja Jobs en ligne sur un serveur Linux (VPS) avec Docker. Une seule commande
démarre toute la pile ; seul Nginx est exposé à Internet.

## Architecture

```
Internet ──HTTPS──> Nginx ──/api/*──> API NestJS ──> PostgreSQL, Redis, stockage S3
                      │                  │  └─> Chromium (export PDF) ──> web:3000 (page d'impression)
                      └──── le reste ──> Application web Next.js ──> API (réseau interne)
```

| Service    | Image                                       | Rôle                                                       |
| ---------- | ------------------------------------------- | ---------------------------------------------------------- |
| `nginx`    | `nginx:1.28.0-alpine`                       | HTTPS, redirection HTTP, compression, limite par visiteur  |
| `web`      | `infrastructure/docker/web.Dockerfile`      | Next.js en serveur autonome                                |
| `api`      | `infrastructure/docker/api.Dockerfile`      | NestJS, tâches planifiées (BullMQ), Chromium pour les PDF  |
| `migrate`  | même Dockerfile, cible `migrate`            | Migrations Prisma, avant chaque démarrage de l'API         |
| `postgres` | `postgres:17.11-alpine`                     | Base de données (volume `postgres-data`)                   |
| `redis`    | `redis:7.4.12-alpine`                       | Files de tâches, limites, cache (volume `redis-data`)      |
| `garage`   | `dxflrs/garage:v2.5.0` (profil `garage`)    | Stockage privé auto-hébergé, si aucun fournisseur S3       |

Fichiers : `infrastructure/compose/docker-compose.prod.yml`,
`infrastructure/nginx/templates/default.conf.template`, `infrastructure/production.env.example`.

## Serveur recommandé

- Ubuntu 24.04 LTS, 2 vCPU, 4 Go de RAM minimum (Chromium et la construction de Next.js sont
  gourmands), 40 Go de disque SSD.
- Docker Engine 27 ou plus récent avec le plugin Compose.
- Pare-feu : ports 22, 80 et 443 seulement.
- Un nom de domaine dont l'enregistrement A (et AAAA si IPv6) pointe vers le serveur.

## Première mise en service

1. **Code** : cloner le dépôt sur le serveur, par exemple dans `/srv/umojajobs`.

2. **Variables** : copier le modèle puis remplir chaque valeur.

   ```sh
   cp infrastructure/production.env.example .env.production
   chmod 600 .env.production
   ```

   - Mots de passe PostgreSQL et Redis, `INTERNAL_API_TOKEN` : `openssl rand -hex 32`.
   - `APP_ENCRYPTION_KEY` : générée une fois, puis **jamais modifiée** (elle chiffre les secrets
     de double authentification).
   - Brevo : identifiant et clé SMTP du compte Brevo.
   - Chariow et OpenAI : peuvent rester vides au départ ; les paiements et l'assistant IA restent
     alors fermés, ce que montre la page Administration > Paramètres.

3. **Certificat HTTPS** (Let's Encrypt), avant le premier démarrage de Nginx :

   ```sh
   sudo apt install certbot
   sudo mkdir -p /var/www/acme
   sudo certbot certonly --standalone -d umojajobs.example
   ```

   Les renouvellements passent ensuite par Nginx déjà démarré :

   ```sh
   sudo certbot renew --webroot -w /var/www/acme \
     --deploy-hook "docker compose -f /srv/umojajobs/infrastructure/compose/docker-compose.prod.yml --env-file /srv/umojajobs/.env.production exec nginx nginx -s reload"
   ```

4. **Démarrage** (construction des images, migrations, puis services) :

   ```sh
   docker compose -f infrastructure/compose/docker-compose.prod.yml --env-file .env.production up -d --build
   ```

   Avec Garage, ajouter `--profile garage`, puis initialiser le stockage une fois :

   ```sh
   STORAGE_ENV_FILE=.env.production STORAGE_COMPOSE_FILE=infrastructure/compose/docker-compose.prod.yml node scripts/storage-init.mjs
   ```

5. **Données de référence** (une seule fois) : pays, villes, rôles, catégories et paramètres
   financiers initiaux. Le seed ne remplace jamais un paramètre financier déjà défini, mais il
   réécrit les fiches pays : ne pas le relancer après des changements faits dans
   l'administration.

   ```sh
   docker compose -f infrastructure/compose/docker-compose.prod.yml --env-file .env.production run --rm migrate pnpm exec prisma db seed
   ```

6. **Premier super administrateur** : créer le compte depuis le site, confirmer l'email, puis :

   ```sh
   docker compose -f infrastructure/compose/docker-compose.prod.yml --env-file .env.production run --rm migrate pnpm role:grant <email> super_admin
   ```

7. **Chariow** : déclarer la Pulse vers `https://<domaine>/api/v1/payments/chariow/pulse`,
   reporter son secret dans `CHARIOW_PULSE_SECRET`, puis saisir les produits License des packs
   dans l'administration.

## Mise à jour

```sh
git pull
docker compose -f infrastructure/compose/docker-compose.prod.yml --env-file .env.production up -d --build
```

Les migrations s'appliquent avant le démarrage de la nouvelle API. Si elles échouent, la
commande s'arrête en erreur : lire `docker compose ... logs migrate` avant toute autre action.
`docker image prune` libère ensuite l'espace des anciennes images.

Nginx résout les noms `web` et `api` toutes les 10 secondes : il suit les nouveaux conteneurs
sans redémarrage.

## Points importants

- **SITE_URL est figée dans l'image web** (robots.txt, plan du site, adresses canoniques) :
  reconstruire l'image après un changement de domaine.
- **Adresse des visiteurs** : Nginx remplace `X-Forwarded-For` par l'adresse du visiteur ; l'API
  fait confiance à un seul proxy (`TRUST_PROXY=1`). Les rendus serveur de Next.js relaient cette
  adresse, et leurs lectures publiques mises en cache portent `INTERNAL_API_TOKEN` pour ne pas
  épuiser la limite commune. Ne pas placer de CDN devant Nginx sans adapter ces réglages.
- **Chromium** tourne sans bac à sable (`CHROMIUM_NO_SANDBOX=true`, impossible autrement dans
  un conteneur) et n'ouvre que la page d'impression interne de l'application.
- **Swagger** est désactivé en production.
- **Taille des images** (mesurée) : web 0,4 Go, API 2,2 Go (Chromium et polices Noto pour
  l'export PDF), migrations 3,2 Go (outillage complet, utilisée seulement au déploiement).

## Sauvegardes

À planifier dès la mise en service (cron quotidien) et à copier hors du serveur :

```sh
docker compose -f infrastructure/compose/docker-compose.prod.yml --env-file .env.production exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > sauvegarde-$(date +%F).dump
```

Le stockage objet (documents, PDF) se sauvegarde chez le fournisseur S3, ou par copie des
volumes `garage-meta` et `garage-data`. Garder aussi `.env.production` en lieu sûr : sans
`APP_ENCRYPTION_KEY`, les doubles authentifications sont perdues.

## Vérifications après déploiement

- `https://<domaine>/fr` s'affiche, `http://` redirige vers `https://`.
- `https://<domaine>/api/v1/health/ready` répond `{"status":"ok","database":"up","redis":"up"}`.
- Administration > Paramètres : tous les services opérationnels, tâches planifiées actives.
- `docker compose ... ps` : tous les services `healthy`.
