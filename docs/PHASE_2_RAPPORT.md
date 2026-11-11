# Phase 2 — Rapport de clôture : offres d'emploi

Date : 11 novembre 2026. Étapes 2a à 2e (commits `48020d3` à `42abe79`, plus les voyants de validité, non commités à la date du rapport).

1. **Objectif** : permettre à tout utilisateur de partager une offre trouvée ailleurs, la faire vérifier par la modération, la publier, la rendre consultable puis l'archiver automatiquement à son expiration.

2. **Réalisé**
   - **Publication (2a)** : brouillon, soumission avec déclaration d'authenticité, statuts `draft` à `archived` (CLAUDE.md §8), version optimiste, révisions et historique des statuts en ajout seul. Conditions de publication à accepter une fois (version horodatée) avant tout dépôt.
   - **Modération (2a, 2e)** : file par statut, fiche d'examen (détails, candidature privée, documents, historique, doublons possibles), décisions motivées (validation, correction, refus, suspension). Un modérateur ne peut pas modérer sa propre offre.
   - **Cycle de vie (2b)** : tâche planifiée BullMQ (activation des offres programmées, expiration, archivage), verrouillage `FOR UPDATE SKIP LOCKED`, aucune donnée supprimée.
   - **Documents (2c)** : PDF original et pièces jointes (4 au plus) sur stockage S3 privé (Garage en local), contrôle du contenu (contenu actif refusé), téléchargement par lien signé de 60 s, journal des téléchargements.
   - **Recherche (2d)** : recherche plein texte et trigrammes, filtres (pays, catégorie, contrat, mode de travail), tri, pagination, archives, offres enregistrées, adresse lisible (`slug`) attribuée à la première validation.
   - **Écrans (2e)**
     - Formulaire de publication en sections, avec liste des champs manquants.
     - Mes publications.
     - Offres d'emploi, fiche, archives et offres enregistrées dans l'espace personnel.
     - Vitrine publique pour les visiteurs :
       - données JobPosting pour les offres actives seulement ;
       - `noindex` sur les offres expirées ;
       - redirection vers l'espace personnel pour un utilisateur connecté.
     - Voyants de validité : vert (en cours), orange (moins de 3 jours), rouge (expirée).
     - Animations d'interface.
     - Bouton principal « Publier une offre ».

3. **Fichiers créés** (62)
   - API :
     - `src/jobs/*` : offres, modération, cycle de vie, recherche, règles et tests ;
     - `src/storage/*` : S3 et inspection des PDF ;
     - 3 suites d'intégration.
   - Web :
     - `features/jobs/*`, `features/publish/*`, `features/moderation/*` ;
     - pages `(site)/jobs/*`, `(app)/dashboard/{jobs,saved,publish,publications}/*`, `(app)/admin/moderation/*` ;
     - `form-controls.tsx`, `city-select.tsx`.
   - Autres : `infrastructure/garage`, `scripts/storage-init.mjs`.

4. **Fichiers modifiés** (49) : schéma Prisma, contrats partagés (`jobs.ts`, `countries.ts`), catalogues FR/EN, navigation (site, espace, administration), client et appels serveur de l'API, garde d'authentification, tableau de bord, styles globaux (animations), `DESIGN_SYSTEM.md`.

5. **Migrations** (appliquées en local avec `migrate deploy`, sans perte de données)
   - `20261110120329_add_job_offers`
   - `20261110124330_add_job_offer_files`
   - `20261110150000_add_job_search`
   - `20261110170000_add_contributor_terms`

6. **Dépendances** : `bullmq` 6.5.0, `@aws-sdk/client-s3` et `@aws-sdk/s3-request-presigner` 3.1156.0 (API). Service local Garage v2.5.0 (stockage compatible S3) dans Docker Compose.

7. **Tests exécutés** : API unitaires, API intégration (PostgreSQL, Redis et Garage réels), web (Vitest), i18n, lint, types, formatage. Parcours complet dans le navigateur : soumission, validation par un modérateur, recherche, fiche, enregistrement, en mobile et en bureau.

8. **Résultats** : API unitaires 123/123, intégration 82/82, web 67/67, i18n 5/5. Lint, types et formatage sans erreur.

9. **Problèmes rencontrés**
   - `prisma migrate dev` refuse de s'exécuter sans terminal interactif. Les migrations sont générées par `migrate diff`, puis appliquées par `migrate deploy`.
   - Le serveur de développement gardait parfois un client Prisma périmé. Il a fallu le redémarrer.
   - Docker s'est arrêté en cours de séance.

10. **Risques**
    - Le signalement d'une offre par les utilisateurs (`job_offer_reports`) et les recherches enregistrées ne sont pas encore développés.
    - L'administration des catégories et des pays n'est pas encore développée (référentiel chargé par seed).
    - Le sitemap XML et les pages pays et villes relèvent de la phase 5.
    - Antivirus sur les fichiers : seule l'inspection de structure PDF est en place. ClamAV est prévu avec le worker de production.
    - Comptes de test locaux : `preview.d5@example.com` a le rôle modérateur et un second compte contributeur existe. Leurs identifiants sont dans `.claude/dev-accounts.local.md`, non versionné.

11. **Décisions nécessaires**
    - Valider la clôture de la phase 2.
    - Seuil de l'alerte orange : 3 jours (modifiable).
    - **Prérequis Chariow de la phase 3** (audit §4.4, décision N1) :
      - communiquer les résultats de l'étape A (rachat réel d'un produit License, deux achats avec le même client) ;
      - autoriser l'étape B : script isolé, avec une clé API que vous placez vous-même dans `.env`.

      Sans ces résultats, l'intégration du paiement ne peut pas être finalisée.

12. **Recommandation** : commencer la phase 3 par ce qui ne dépend pas de Chariow.
    - **3a** : paramètres financiers versionnés, packs, comptes et lots de crédits, registre des crédits et grand livre en partie double, en ajout seul.
    - **3b** : déverrouillages en crédits et commissions.
    - **3c** : recharges Chariow (commandes, checkout, Pulses, confirmation serveur), après le go sur les critères G1 et G2.
    - **3d** : portefeuilles et retraits.
    - **3e** : écrans.
