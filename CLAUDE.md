# CLAUDE.md — OPPORTINITIES

## 1. IDENTITÉ DU PROJET

- Nom : OPPORTINITIES
- Type : SaaS panafricain de partage d'offres d'emploi et de création de documents professionnels.
- Marché initial : les 54 pays africains.
- Langues : français et anglais.
- Objectif : devenir une plateforme de référence pour les opportunités professionnelles en Afrique et à l'international.

## 2. STACK TECHNIQUE OFFICIELLE

La stack officielle du projet est :

### Frontend
- Next.js 15+ avec App Router.
- React 19+.
- TypeScript en mode strict.
- Tailwind CSS.
- Composants accessibles et réutilisables.
- Interface responsive mobile-first.

### Backend
- NestJS.
- TypeScript.
- API REST versionnée.
- Architecture modulaire.
- Validation des données avec DTO.
- Documentation API avec Swagger/OpenAPI.

### Base de données
- PostgreSQL.
- Prisma ORM.
- Migrations versionnées.
- Contraintes relationnelles et index adaptés.

### Services complémentaires
- Redis pour le cache et les tâches asynchrones lorsque nécessaire.
- Brevo SMTP pour les emails.
- Chariow API pour les paiements.
- OpenAI API pour les fonctionnalités d'intelligence artificielle.
- Stockage privé pour les fichiers et documents.
- Docker pour l'environnement et le déploiement.
- Nginx comme reverse proxy.
- Linux VPS ou infrastructure cloud professionnelle.

Ne pas remplacer cette stack par PHP, Laravel ou MySQL.

Ne pas changer de framework ou de technologie sans justification technique et validation du propriétaire.

## 3. ARCHITECTURE CIBLE

Architecture recommandée :

- apps/web : application Next.js destinée aux utilisateurs.
- apps/api : backend NestJS.
- packages/shared : types, constantes et schémas partagés.
- packages/config : configurations partagées si nécessaire.
- infrastructure : Docker, Nginx et configuration de déploiement.
- docs : documentation technique et fonctionnelle.

Cette structure doit être adaptée après audit du dépôt.

Le frontend ne doit pas accéder directement à PostgreSQL.

Les opérations métier, paiements, commissions et permissions doivent être contrôlés par le backend.

Utiliser des contrats API cohérents et des types partagés pour limiter les incohérences entre frontend et backend.

## 4. MISSION DU PRODUIT

OPPORTINITIES doit permettre :

1. De découvrir des offres d'emploi fiables.
2. De partager gratuitement des opportunités trouvées sur des sources externes.
3. De consulter les informations complètes d'une offre après paiement.
4. De gagner des commissions sur les déverrouillages éligibles.
5. De créer des CV et des documents professionnels avec l'assistance de l'IA.

Un compte unique doit permettre toutes ces activités.

## 5. RÈGLES ABSOLUES

- Toujours auditer le dépôt avant de modifier son architecture.
- Ne jamais générer toute la plateforme en une seule opération.
- Ne jamais supprimer une fonctionnalité sans justification.
- Ne jamais inventer une API ou un endpoint.
- Ne jamais simuler un paiement réel.
- Ne jamais considérer une redirection navigateur comme une preuve de paiement.
- Ne jamais hardcoder les prix et paramètres financiers.
- Ne jamais exposer les secrets dans le code.
- Ne jamais inventer de diplômes ou expériences dans les documents générés.
- Ne jamais publier automatiquement une offre sans modération.
- Ne jamais contourner les permissions.
- Ne jamais passer à la phase suivante sans rapport et validation.

## 6. UTILISATEURS ET AUTHENTIFICATION

Inscription :

- Prénom.
- Nom.
- Email.
- Pays.
- Mot de passe.
- Confirmation.
- Acceptation des conditions.

Le téléphone reste facultatif.

Prévoir :

- Inscription et connexion.
- Vérification email.
- Réinitialisation du mot de passe.
- Gestion du profil.
- Gestion des sessions.
- Préférences linguistiques.
- Préférences d'affichage.
- Notifications internes.

Sécurité :

- Cookies HttpOnly, Secure et SameSite.
- Protection CSRF adaptée à l'architecture.
- Rate limiting.
- Hachage sécurisé des mots de passe.
- Sessions révocables.
- Protection contre les attaques par force brute.

## 7. PAYS ET LANGUES

Prendre en charge les 54 pays africains.

Centraliser :

- Noms officiels.
- Codes ISO.
- Indicatifs téléphoniques.
- Drapeaux.
- Statuts.

Les sélecteurs doivent être recherchables.

Langues initiales :

- Français.
- Anglais.

Toutes les interfaces, emails, notifications et messages d'erreur doivent être traduits.

Utiliser un système centralisé de traduction. Ne pas disperser les textes dans les composants.

Conserver le contenu des annonces dans sa langue originale.

## 8. OFFRES D'EMPLOI

Tout utilisateur inscrit peut partager gratuitement une offre trouvée sur une source externe.

Sources possibles :

- WhatsApp.
- Facebook.
- Telegram.
- LinkedIn.
- Sites officiels.
- Institutions.
- Journaux.
- Autres sources vérifiables.

Informations à collecter :

- Titre.
- Entreprise.
- Pays et ville.
- Description.
- Exigences.
- Type de contrat.
- Salaire éventuel.
- Date de publication.
- Début de validité.
- Date limite.
- Source.
- Instructions de candidature.
- Coordonnées officielles autorisées.
- PDF original, si disponible et partage autorisé.

Toutes les publications doivent passer par la modération.

Statuts :

draft, pending_review, needs_correction, scheduled, active, expired, rejected, suspended, archived.

Historiser les modifications et les changements de statut.

## 9. EXPIRATION

Chaque offre doit posséder une date de fin de validité.

Un traitement planifié doit automatiquement :

- Détecter les offres expirées.
- Désactiver leur déverrouillage.
- Désactiver les possibilités de candidature.
- Conserver les archives.
- Préserver les commissions déjà acquises.

Ne jamais supprimer les historiques financiers à cause de l'expiration d'une offre.

## 10. MONÉTISATION DES OFFRES

Modèle économique (décision du propriétaire, cahier des charges v1.2) :

- Chariow sert uniquement à payer les recharges de crédits (produits de type License). Il ne gère ni le portefeuille, ni les déverrouillages, ni les documents, ni les commissions, ni les retraits.
- Taux de conversion configurable. Référence : 1 crédit = 0,10 USD.
- Les frais Chariow sont une charge de la plateforme. Ils ne sont jamais déduits des crédits attribués ni de la base des commissions.

Partage de la valeur interne des crédits consommés pour un déverrouillage éligible :

- 70 % plateforme.
- 30 % contributeur.

Une commission nécessite :

- Une offre active et validée.
- Un paiement confirmé.
- Un déverrouillage éligible.
- L'absence de doublon.
- L'absence d'auto-achat.
- L'absence de remboursement ou fraude.

États des commissions :

pending, available, paid, reversed.

Prévoir un délai de sécurité configurable.

Ne jamais effacer une commission acquise sans écriture compensatoire et justification.

## 11. PORTEFEUILLES ET RETRAITS

Chaque contributeur dispose d'un portefeuille avec :

- Solde en attente.
- Solde disponible.
- Total des gains.
- Total des retraits.
- Historique des opérations.

Seuil de retrait initial : 10 USD, configurable.

Moyens de retrait adaptés aux pays :

- Mobile Money.
- Virement bancaire.
- Autres méthodes autorisées.

États :

pending, under_review, approved, processing, paid, rejected.

Réserver les fonds dès qu'une demande valide est créée.

Les retraits peuvent être traités manuellement au lancement.

Ne pas supposer que Chariow prend en charge les paiements sortants sans vérifier sa documentation.

## 12. CAREER STUDIO — IA ET DOCUMENTS

Créer un espace de création documentaire assisté par IA.

Documents :

- CV.
- Lettre de motivation.
- Demande d'emploi spontanée.
- Demande de stage.
- Lettre de recommandation à faire signer.
- Lettre de démission.
- Lettre de relance.
- Lettre de remerciement.

Collecter les informations personnelles, formations, expériences, compétences, langues et certifications.

L'IA améliore la formulation sans inventer d'informations.

Fonctionnement :

1. Remplissage gratuit.
2. Génération de l'aperçu.
3. Modification gratuite.
4. Choix du modèle.
5. Paiement.
6. Export PDF.

Prix indicatifs configurables :

- CV : 1,50 USD.
- Lettre de motivation : 1 USD.
- Demande d'emploi : 1 USD.
- Pack CV + lettre : 2,50 USD.

Les revenus du Career Studio reviennent intégralement à la plateforme, après frais éventuels.

## 13. PAIEMENTS CHARIOW

Utiliser la documentation officielle actuelle de Chariow.

Prévoir :

- Création des commandes.
- Initialisation des paiements.
- Confirmation serveur.
- Webhooks.
- Historique des événements.
- Gestion des erreurs.
- Remboursements lorsque supportés.

Vérifier la signature des webhooks lorsque prévue, les références, montants, devises et statuts.

Protéger les traitements contre les doublons avec idempotence.

Aucun déverrouillage ne doit intervenir avant confirmation fiable du paiement côté serveur.

Ne jamais inventer les endpoints Chariow.

## 14. DESIGN

Direction visuelle :

- Design premium.
- Fond blanc et gris léger.
- Bleu professionnel et bleu foncé.
- Typographie Plus Jakarta Sans, famille unique (décision du propriétaire, novembre 2026).
- Design system de référence : `docs/DESIGN_SYSTEM.md` (jetons, composants, règles).
- Cartes sobres.
- Bordures discrètes.
- Espacements généreux.
- Interface mobile-first.

Ne pas utiliser d'autre police d'interface (ni IBM Plex Sans, ni Poppins, ni Inter). Les icônes viennent uniquement de Lucide.

Prévoir :

- Mode clair.
- Mode sombre.
- Mode système.

Mémoriser la préférence et éviter le flash du mauvais thème au chargement.

Ne pas utiliser d'emojis dans l'interface, sauf les drapeaux des pays.

## 15. TABLEAUX DE BORD

Utilisateur :

- Vue d'ensemble.
- Recherche.
- Offres enregistrées.
- Publications.
- Portefeuille.
- Commissions.
- Retraits.
- Career Studio.
- Documents.
- Notifications.
- Paramètres.

Administration :

- Statistiques.
- Utilisateurs.
- Rôles et permissions.
- Offres et modération.
- Catégories et pays.
- Paiements.
- Déverrouillages.
- Commissions.
- Retraits.
- Documents et tarifs.
- Notifications.
- Traductions.
- Paramètres.
- Journaux d'audit.
- Événements de sécurité.

Rôles : user, moderator, admin, super_admin.

## 16. SÉCURITÉ ET AUDIT

Appliquer les protections contre :

- SQL Injection.
- XSS.
- CSRF.
- Attaques par force brute.
- Accès non autorisés.
- Téléversements malveillants.
- Fraudes financières.
- Réutilisation d'événements de paiement.

Les documents privés doivent être stockés hors accès public et servis via des accès contrôlés ou des URLs temporaires signées.

Utiliser des transactions PostgreSQL atomiques.

Utiliser DECIMAL ou NUMERIC pour les montants financiers, jamais FLOAT.

Les journaux administratifs doivent conserver :

- Acteur.
- Rôle.
- Action.
- Date.
- IP.
- User-Agent.
- Route.
- Request ID.
- Résultat.
- Valeurs avant/après pour les modifications sensibles.

Protéger les journaux critiques contre les modifications et suppressions ordinaires.

## 17. SEO

Prévoir :

- URLs propres.
- Métadonnées.
- Sitemap XML.
- Robots.txt.
- Données structurées JobPosting.
- Pages de catégories.
- Pages pays et villes.
- Canonical URLs.
- Gestion SEO des offres expirées.

Ne jamais déclarer une offre expirée comme active dans les données structurées.

## 18. EMAILS ET NOTIFICATIONS

Utiliser Brevo SMTP.

Prévoir les emails de :

- Vérification.
- Réinitialisation.
- Paiement.
- Déverrouillage.
- Commission.
- Retrait.
- Publication.
- Correction.
- Validation.
- Rejet.

Prévoir un centre de notifications interne.

Éviter les notifications en double.

## 19. STRUCTURE ET QUALITÉ DU CODE

Respecter les responsabilités de chaque application :

- Next.js : interface et expérience utilisateur.
- NestJS : logique métier et API.
- PostgreSQL : persistance des données.
- Prisma : accès aux données et migrations.
- Redis : cache et traitements asynchrones si nécessaire.

Utiliser TypeScript strict.

Séparer les modules métier dans NestJS.

Ne pas placer la logique financière dans les composants frontend.

Valider les entrées côté backend.

Documenter les API.

Écrire des tests unitaires et d'intégration.

Éviter les dépendances inutiles.

Ne pas dupliquer la logique métier entre frontend et backend.

## 20. PHASES DE DÉVELOPPEMENT

### PHASE 0 — AUDIT

Aucune fonctionnalité à développer.

- Examiner le dépôt.
- Identifier la stack.
- Examiner les dépendances.
- Vérifier les variables d'environnement sans exposer les secrets.
- Examiner l'architecture.
- Identifier les risques.
- Proposer le schéma de données.
- Proposer l'architecture cible.
- Établir la roadmap.

Présenter un rapport et attendre l'approbation.

### PHASE 1 — FONDATIONS

- Monorepo.
- Configuration Next.js et NestJS.
- PostgreSQL et Prisma.
- Authentification.
- Vérification email.
- Rôles et permissions.
- Pays.
- Langues.
- Thèmes.
- Tableaux de bord.

### PHASE 2 — OFFRES

- Publication.
- Recherche.
- Filtres.
- Catégories.
- Sources.
- Fichiers.
- Modération.
- Historique.
- Expiration.
- Archives.

### PHASE 3 — MONÉTISATION

- Chariow.
- Commandes.
- Paiements.
- Webhooks.
- Déverrouillages.
- Portefeuilles.
- Commissions.
- Retraits.

### PHASE 4 — CAREER STUDIO

- Formulaires.
- Modèles.
- IA.
- Prévisualisation.
- Édition.
- Paiements.
- PDF.

### PHASE 5 — FINALISATION

- Emails.
- Notifications.
- SEO.
- Sécurité.
- Performances.
- Tests.
- Documentation.
- Déploiement.

## 21. RAPPORT OBLIGATOIRE PAR PHASE

Fournir à chaque fin de phase :

1. Objectif.
2. Fonctionnalités réalisées.
3. Fichiers créés.
4. Fichiers modifiés.
5. Migrations.
6. Dépendances.
7. Tests exécutés.
8. Résultats.
9. Problèmes.
10. Risques.
11. Décisions nécessaires.
12. Recommandation pour la suite.

Attendre la validation avant de passer à la phase suivante.

## 22. PREMIÈRE INSTRUCTION À CLAUDE CODE

Commencer exclusivement par la PHASE 0 — AUDIT ET ARCHITECTURE.

Ne pas commencer à coder les fonctionnalités.

Examiner le dépôt et préparer un rapport complet.

Le rapport doit confirmer la faisabilité de la stack Next.js + NestJS + PostgreSQL + Prisma, proposer une architecture adaptée à un hébergement professionnel et présenter les éventuels besoins d'infrastructure.

Attendre l'approbation explicite du propriétaire avant toute implémentation.

**Objectif final : faire d'OPPORTINITIES une plateforme panafricaine fiable, sécurisée, bilingue et évolutive pour les opportunités professionnelles et les documents de candidature.**