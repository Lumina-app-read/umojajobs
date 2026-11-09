
# CAHIER DES CHARGES COMPLET — OPPORTINITIES
## Global Career & Opportunity Platform
### Version 1.1 — Document de référence pour Claude Code

> **Historique des versions**
> - 1.0 — Version initiale.
> - 1.1 (9 novembre 2026) — Décisions du propriétaire après l'audit de la phase 0 :
>   - D1 : la stack officielle est celle de `CLAUDE.md` (Next.js, NestJS, PostgreSQL, Prisma, Tailwind CSS). Toute référence à Laravel, MySQL, Blade, Livewire et Alpine.js est supprimée.
>   - D2 : les paiements passent par un portefeuille de crédits internes achetés en packs via Chariow, sous réserve de la validation technique des produits Chariow de type License (voir `docs/PHASE_0_AUDIT.md`).
>   - D3 : la commission est calculée sur les crédits effectivement consommés (base précisée en version 1.2 : valeur interne, sans déduction des frais Chariow).
>   - D4 : le statut `paid` signifie un paiement effectif au contributeur.
>   - D5 : un délai de sécurité configurable s'applique avant qu'une commission devienne disponible.
> - 1.2 (9 novembre 2026) — **Modèle économique définitif** :
>   - Chariow sert uniquement aux recharges de crédits.
>   - Taux de conversion configurable (référence : 1 crédit = 0,10 USD).
>   - Packs de recharge de 10, 20, 50 et 100 USD.
>   - Frais Chariow supportés par la plateforme, jamais déduits des crédits ni des commissions.
>   - Commission de 30 % sur la valeur interne des crédits consommés pour les déverrouillages éligibles.
>   - Cette version remplace les exemples de calcul de la version 1.1.
>   - Arbitrages A1 à A5 validés par le propriétaire :
>     - valeur du crédit figée par lot ;
>     - crédits gratuits sans commission et pas de bonus au lancement ;
>     - coûts en crédits et packs d'offres ;
>     - packs d'entrée de 2 et 5 USD ;
>     - pas d'expiration, remboursement des seuls crédits non consommés sous 14 jours.
>
> En cas de contradiction technique, `CLAUDE.md` prévaut.

---

# 1. PRÉSENTATION GÉNÉRALE DU PROJET

Nom du projet : OPPORTINITIES

Slogan : Discover Opportunities. Shape Your Future.

Type de produit : SaaS panafricain dédié aux opportunités professionnelles, à la recherche d'emploi, au partage rémunéré d'offres et à la création intelligente de documents professionnels.

Langues initiales :
- Français (FR)
- Anglais (EN)

Zone géographique :
- Les 54 pays africains.
- Toutes les villes disponibles dans ces pays.
- Possibilité d'extension internationale ultérieure.

Objectif :

Créer une plateforme professionnelle permettant aux utilisateurs de :
1. Découvrir des offres d'emploi provenant de différentes sources.
2. Partager gratuitement des opportunités professionnelles.
3. Gagner des commissions lorsqu'une offre qu'ils ont publiée génère des achats éligibles.
4. Créer des CV et des lettres professionnelles avec l'intelligence artificielle.
5. Télécharger leurs documents au format PDF après paiement.
6. Gérer leurs revenus, leurs crédits et leurs retraits.

IMPORTANT :
Un utilisateur qui publie une offre n'est pas nécessairement le recruteur ou l'entreprise qui embauche.

Il peut simplement être une personne ayant découvert une annonce sur WhatsApp, Facebook, Telegram, un site officiel ou une autre source et souhaitant la partager avec la communauté.

Cette distinction doit être respectée dans toute l'application.

---

# 2. STACK TECHNOLOGIQUE

Utiliser une architecture moderne, sécurisée, évolutive et maintenable.

Stack officielle (référence : `CLAUDE.md`) :

- Frontend : Next.js (App Router), React, TypeScript strict.
- CSS : Tailwind CSS.
- Backend : NestJS (TypeScript), API REST versionnée, documentée avec Swagger/OpenAPI.
- Base de données : PostgreSQL.
- ORM et migrations : Prisma.
- Cache et tâches asynchrones : Redis (files de tâches BullMQ).
- Authentification : sessions serveur révocables gérées par le backend NestJS (cookies HttpOnly, Secure, SameSite).
- IA : API OpenAI, derrière une interface permettant de changer de fournisseur.
- Paiement : Chariow API.
- Emails : Brevo SMTP.
- Génération PDF : rendu HTML vers PDF côté serveur (Chromium headless) dans un worker.
- Stockage : stockage objet privé compatible S3, URLs signées temporaires.
- Environnement et déploiement : Docker, Nginx en reverse proxy, VPS Linux ou cloud professionnel.

Ne pas utiliser PHP, Laravel ou MySQL.

Architecture recommandée : monorepo avec une application web (Next.js), une API modulaire (NestJS) et un worker pour les tâches planifiées et asynchrones. Le frontend n'accède jamais directement à la base de données.

Ne pas créer une architecture microservices inutilement complexe pour la première version.

Organiser le backend en modules NestJS indépendants :
- Authentication
- Users
- Locations
- Jobs
- Moderation
- Contributions
- Wallet
- Commissions
- Withdrawals
- Payments
- Documents
- AI
- Notifications
- Administration
- Localization

Utiliser des migrations Prisma versionnées, des scripts de seed, des services, des guards NestJS (rôles et permissions), des DTO validés, des files de tâches et des événements de domaine.

Ne jamais placer la logique financière directement dans les contrôleurs.

---

# 3. IDENTITÉ VISUELLE ET EXPÉRIENCE UTILISATEUR

Créer une interface SaaS professionnelle, moderne, élégante et internationale.

Direction artistique :

- Fond clair : blanc et gris très léger.
- Couleur principale : bleu professionnel.
- Couleur secondaire : bleu foncé.
- Accent : bleu lumineux.
- Typographie : IBM Plex Sans.
- Interface épurée.
- Cartes élégantes.
- Bordures discrètes.
- Espacements généreux.
- Icônes professionnelles.
- Animations légères.
- Responsive design intégral.

Ne pas utiliser :
- Poppins.
- Inter.
- Des interfaces surchargées.
- Des textes inutiles.
- Des emojis dans l'interface, sauf les drapeaux des pays.

## Mode sombre obligatoire

Prévoir :
- Mode clair.
- Mode sombre.
- Mode système automatique.

Ajouter un sélecteur dans les préférences utilisateur.

Le choix doit être conservé entre les sessions.

Toutes les pages, formulaires, tableaux, modales, menus et composants doivent supporter les deux thèmes.

Éviter le flash du thème clair avant le chargement du thème sombre.

## Responsive design

Priorité mobile-first.

L'application doit fonctionner correctement sur :
- Android.
- iPhone.
- Tablettes.
- Ordinateurs portables.
- Écrans larges.

Navigation mobile simple avec menu adapté.

---

# 4. INTERNATIONALISATION FRANÇAIS / ANGLAIS

L'application doit être entièrement bilingue dès la première version.

Prévoir un système centralisé de traduction.

Français :
- fr

Anglais :
- en

Exigences :
- Bouton de changement de langue.
- Traduction de toutes les pages.
- Traduction des formulaires.
- Traduction des notifications.
- Traduction des emails.
- Traduction des erreurs.
- Traduction des tableaux de bord.
- Traduction des documents générés lorsque la langue est choisie.

La langue choisie doit être enregistrée dans le profil utilisateur.

Ne jamais mélanger le français et l'anglais dans une même interface.

Les contenus des offres peuvent être publiés dans leur langue originale. Ne pas traduire automatiquement une annonce sans conserver son contenu original.

Prévoir une structure permettant d'ajouter ultérieurement le portugais et d'autres langues.

---

# 5. INSCRIPTION ET AUTHENTIFICATION

L'inscription doit être extrêmement simple.

Ne pas imposer un formulaire long.

## Formulaire d'inscription

Champs obligatoires :

1. Prénom et nom.
2. Adresse e-mail.
3. Pays de résidence.
4. Mot de passe.
5. Confirmation du mot de passe.
6. Acceptation des conditions d'utilisation et de la politique de confidentialité.

Le numéro de téléphone peut être ajouté ultérieurement dans le profil.

## Sélecteur des pays africains

Le pays est obligatoire.

Afficher les 54 pays africains avec :
- Drapeau.
- Nom du pays.
- Code ISO.
- Code téléphonique international.

Utiliser les emojis drapeaux ou une bibliothèque de drapeaux.

Prévoir une liste déroulante avec recherche.

Les pays doivent être alimentés par une table de référence PostgreSQL remplie par un script de seed Prisma.

Ne pas coder la liste directement dans plusieurs composants.

Exemples :

🇨🇩 République démocratique du Congo
🇨🇬 République du Congo
🇿🇦 Afrique du Sud
🇳🇬 Nigeria
🇰🇪 Kenya
🇸🇳 Sénégal
🇨🇮 Côte d'Ivoire
🇨🇲 Cameroun
🇬🇭 Ghana
🇷🇼 Rwanda
🇲🇦 Maroc
🇪🇬 Égypte

La liste complète doit être présente.

Le pays sélectionné doit automatiquement servir de valeur par défaut dans les recherches et les formulaires de publication.

La ville sera facultative à l'inscription et pourra être renseignée dans le profil.

## Connexion sécurisée

Prévoir :
- Connexion par e-mail et mot de passe.
- Vérification de l'adresse e-mail.
- Réinitialisation du mot de passe.
- Limitation des tentatives de connexion.
- Protection contre les attaques par force brute.
- Sessions sécurisées.
- Cookies HttpOnly, Secure et SameSite.
- Protection CSRF.
- Déconnexion de toutes les sessions.
- Journalisation des événements de sécurité.

Ne pas imposer de vérification SMS.

Privilégier la vérification par e-mail.

Prévoir éventuellement une authentification à deux facteurs pour les administrateurs.

## Gestion des rôles

Un compte unique doit pouvoir :
- Rechercher un emploi.
- Publier une offre.
- Gagner des commissions.
- Créer des documents.

Ne pas obliger l'utilisateur à créer plusieurs comptes.

Rôles :
- User.
- Moderator.
- Admin.
- Super Admin.

Les permissions doivent être contrôlées côté serveur.

---

# 6. PAGE D'ACCUEIL PUBLIQUE

Créer une page d'accueil professionnelle.

Sections :

1. Header avec logo OPPORTINITIES.
2. Navigation.
3. Sélecteur FR / EN.
4. Sélecteur clair / sombre.
5. Boutons Connexion et Inscription.
6. Hero section avec moteur de recherche.
7. Dernières offres d'emploi.
8. Offres par pays.
9. Offres par domaine professionnel.
10. Section création de CV.
11. Section lettres professionnelles.
12. Section programme de contributeurs.
13. Comment fonctionne OPPORTINITIES.
14. Statistiques réelles de la plateforme.
15. FAQ.
16. Footer professionnel.

Moteur de recherche principal :

- Intitulé du poste.
- Pays.
- Ville.
- Catégorie.
- Bouton Rechercher.

Ne jamais afficher de fausses statistiques ou de faux témoignages.

---

# 7. MODULE DES OFFRES D'EMPLOI

C'est le module principal du SaaS.

## 7.1 Publication gratuite

Tout utilisateur authentifié peut proposer une offre gratuitement.

L'utilisateur est appelé CONTRIBUTOR (contributeur).

Il ne faut pas le considérer automatiquement comme recruteur.

## 7.2 Formulaire de publication

Champs :

- Intitulé du poste.
- Nom de l'entreprise.
- Pays.
- Ville.
- Catégorie professionnelle.
- Type de contrat.
- Niveau d'études.
- Expérience requise.
- Salaire (facultatif).
- Description.
- Profil recherché.
- Compétences requises.
- Date de début de validité.
- Date de fin de validité.
- Source de l'annonce.
- URL de la source (facultative).
- PDF original (si disponible).
- Instructions de candidature.
- Adresse e-mail de candidature.
- Autres documents éventuels.

Le système doit permettre de publier :
- Avec PDF original.
- Sans PDF, avec les informations saisies manuellement.

Le document original doit être privé et sécurisé.

## 7.3 Sources des annonces

Prévoir les sources suivantes :
- Site officiel de l'entreprise.
- WhatsApp.
- Facebook.
- Telegram.
- LinkedIn.
- Journal.
- Autre site Internet.
- Autre source.

Le contributeur doit déclarer que les informations fournies sont exactes et qu'il est autorisé à partager les documents transmis.

Ne pas accepter de documents confidentiels ou de documents dont la diffusion n'est pas autorisée.

## 7.4 Vérification des offres

Aucune offre ne doit devenir commercialisable automatiquement.

Workflow :

1. Le contributeur soumet l'annonce.
2. Le statut devient PENDING_REVIEW.
3. Un modérateur vérifie les informations.
4. Le modérateur vérifie la source.
5. Le modérateur vérifie les dates.
6. Le modérateur examine le PDF si disponible.
7. Il peut approuver, rejeter ou demander une correction.
8. Après validation, l'offre est programmée ou publiée.

Prévoir une détection des doublons.

Vérifier notamment :
- Entreprise.
- Intitulé du poste.
- Pays.
- Dates.
- Source.
- Empreinte du document.

Les offres similaires doivent être présentées au modérateur avant validation.

## 7.5 Statuts des offres

Prévoir :

- DRAFT
- PENDING_REVIEW
- NEEDS_CORRECTION
- SCHEDULED
- ACTIVE
- EXPIRED
- REJECTED
- SUSPENDED
- ARCHIVED

Une offre approuvée ne doit être visible comme active qu'à partir de sa date de début.

## 7.6 Expiration automatique

C'est une fonctionnalité obligatoire.

Les deux dates sont obligatoires :
- Date de début.
- Date de fin.

Le système doit utiliser la timezone appropriée pour interpréter les dates.

À la fin de la date limite, l'offre devient expirée automatiquement.

Prévoir un traitement planifié côté backend : tâches répétables BullMQ (Redis) exécutées par le worker NestJS, idempotentes et sans doublon en cas de plusieurs instances.

Lorsqu'une offre expire :

- Changer automatiquement son statut en EXPIRED.
- Désactiver le déverrouillage.
- Désactiver les nouveaux achats.
- Bloquer les nouvelles candidatures ou demandes d'accès.
- Afficher clairement OFFRE EXPIRÉE.
- Conserver l'annonce dans les archives.
- Conserver toutes les anciennes transactions.
- Conserver les commissions déjà acquises.

Aucune nouvelle commission ne doit être créée après expiration.

L'expiration ne doit jamais annuler les commissions légitimement générées avant la date limite.

Prévoir une notification au contributeur.

Si une annonce est suspendue pour fraude, bloquer immédiatement les achats et examiner les transactions concernées.

---

# 8. CONSULTATION ET DÉVERROUILLAGE PAYANT

Le modèle économique repose sur l'accès payant aux informations complètes de candidature.

## 8.1 Partie publique gratuite

Tout le monde peut consulter :

- Intitulé.
- Entreprise.
- Pays.
- Ville.
- Description.
- Exigences.
- Diplômes.
- Expérience.
- Type de contrat.
- Salaire communiqué.
- Date de fin.
- Statut de vérification.

Ne jamais exposer publiquement :
- E-mail de candidature.
- Coordonnées privées.
- PDF original protégé.
- Instructions réservées.
- Informations confidentielles.

Ne pas supprimer les informations déjà publiquement disponibles sur les sites officiels si leur diffusion est autorisée.

## 8.2 Partie payante

Après déverrouillage :

- Accès au PDF original autorisé.
- Coordonnées officielles de candidature.
- E-mail de candidature.
- Adresse physique éventuelle.
- Instructions complètes.
- Documents complémentaires.
- Informations nécessaires pour envoyer sa candidature.

Ne pas promettre des informations supplémentaires si elles ne sont pas présentes dans l'annonce originale.

## 8.3 Tarification

Prévoir une configuration administrable.

**Modèle économique définitif (version 1.2) : portefeuille de crédits internes.**

### 8.3.1 Séparation entre Chariow et le portefeuille interne

- **Chariow est uniquement le prestataire de paiement des recharges de crédits.** Il intervient seulement lorsqu'un utilisateur achète ou recharge des crédits.
- Chariow ne gère **ni** le portefeuille interne, **ni** les déverrouillages, **ni** les packs d'offres, **ni** les documents, **ni** les commissions, **ni** les retraits.
- Toutes ces opérations se déroulent exclusivement dans OPPORTINITIES et sont payées en crédits, **sans nouveau paiement Chariow**.

### 8.3.2 Taux de conversion

- OPPORTINITIES fixe librement la valeur interne d'un crédit. Référence : **1 crédit = 0,10 USD** (100 crédits = 10 USD).
- Ce taux est configurable par l'administration et historisé.
- La valeur interne est **figée sur chaque lot** au moment de l'attribution. Un changement de taux ne s'applique qu'aux recharges suivantes (décision A1).

### 8.3.3 Packs de recharge

Exemples de référence (montants et packs configurables) :

| Recharge | Crédits attribués |
|---|---|
| 2 USD | 20 crédits (pack d'entrée, décision A4) |
| 5 USD | 50 crédits (pack d'entrée, décision A4) |
| 10 USD | 100 crédits |
| 20 USD | 200 crédits |
| 50 USD | 500 crédits |
| 100 USD | 1 000 crédits |

- Chaque pack correspond à un produit Chariow de type **License**, dont le prix est égal au montant du pack. Le type License est le seul que Chariow permet de racheter plusieurs fois.
- Le backend bloque la vente d'un pack si son prix diffère de celui du produit Chariow.
- **Réserve technique** : le rachat d'un même produit License par le même client doit être validé par un test réel avant la phase 3 (voir `docs/PHASE_0_AUDIT.md`).

### 8.3.4 Frais Chariow

- Les frais prélevés par Chariow sont **entièrement supportés par OPPORTINITIES**, comme une charge de paiement de la plateforme.
- **Les frais ne sont jamais déduits du nombre de crédits attribués.** Une recharge de 10 USD donne toujours 100 crédits.
- Les frais n'interviennent **jamais** dans le calcul des commissions des contributeurs.

### 8.3.5 Parcours de recharge et attribution des crédits

1. L'utilisateur choisit un pack. Le backend crée une commande de recharge avec une référence unique et un snapshot du montant et des crédits.
2. Le backend ouvre une session de paiement Chariow avec la référence de commande en métadonnée.
3. L'utilisateur paie sur la page Chariow. **Le retour du navigateur ne vaut jamais preuve de paiement** : il affiche seulement « paiement en cours de vérification ».
4. Chariow envoie une notification (Pulse). Le backend vérifie la signature, enregistre l'événement une seule fois, puis le traite en file d'attente.
5. Le backend revérifie la vente auprès de l'API Chariow : statut payé, produit, montant, devise et référence de commande.
6. Dans une seule transaction atomique : la commande passe en état payé, le lot de crédits est créé et le portefeuille interne est crédité. Les écritures comptables sont passées en même temps.
7. **Les crédits ne sont attribués qu'une seule fois**, même si la notification arrive plusieurs fois, si plusieurs notifications concernent la même vente, ou si une réconciliation traite la vente en parallèle. Cette garantie repose sur des contraintes d'unicité en base : identifiant de livraison, identifiant de vente, commande et lot.
8. Une incohérence (montant, produit, devise, référence) bloque l'attribution et alerte l'administration.

### 8.3.6 Utilisation des crédits

- Le coût de chaque service est exprimé en crédits, configurable et historisé. Exemples au taux de référence :
  - déverrouillage standard : 5 crédits (0,50 USD) ;
  - déverrouillage premium : 10 crédits (1 USD).
  - Les coûts des documents sont fixés au §11.8.
- Un **pack d'offres** permet d'acheter plusieurs déverrouillages standard en une fois, contre des crédits. Exemple de référence : 5 déverrouillages pour 20 crédits (décision A3). Il crée des droits de déverrouillage utilisables ensuite.
  - La commission est créée **à chaque utilisation** d'un droit sur une offre éligible.
  - Elle est calculée sur la valeur réellement payée par déverrouillage : 20 ÷ 5 = 4 crédits, soit 0,40 USD de valeur et **0,12 USD de commission**.
  - Le contenu et le prix des packs d'offres sont configurables.
- Chaque débit est atomique et protégé contre la double dépense (double clic, onglets multiples).
- **Crédits gratuits** (promotions, gestes commerciaux) : lots marqués **non commissionnables**. Ils ne génèrent aucune commission (décision A2).
- **Pas de crédits bonus dans les packs de recharge au lancement** (décision A2). Si des bonus sont ajoutés plus tard, la part bonus sera non commissionnable.

### 8.3.7 Expiration et remboursement des crédits (décision A5)

- **Pas d'expiration des crédits au lancement.** Toute politique d'expiration future devra être annoncée dans les CGU et validée juridiquement.
- **Seuls les crédits non consommés sont remboursables**, dans les **14 jours** suivant la recharge.
- Le remboursement est saisi par l'administration avec une preuve. Il annule les crédits concernés par une écriture compensatoire. Les frais Chariow non restitués restent une charge de la plateforme.
- Les crédits consommés ne sont pas remboursables.
- Cette règle doit être validée juridiquement avant la mise en production.

Le système doit permettre :
- Recharge de crédits par packs.
- Consultation du solde et de l'historique des crédits (recharges, consommations, ajustements).
- Historique des déverrouillages.
- Consultation ultérieure des offres déjà débloquées.

Un utilisateur qui a déjà débloqué une offre doit pouvoir y revenir sans payer une deuxième fois.

Un seul déverrouillage payant éligible par utilisateur et par offre.

Une offre expirée ne peut plus être déverrouillée.

## 8.4 Protection des PDF

Ne jamais stocker les documents payants dans un dossier public.

Prévoir :
- Stockage privé.
- Contrôle d'accès côté serveur.
- URLs temporaires signées.
- Vérification de la propriété du déverrouillage.
- Journalisation des téléchargements.
- Filigrane personnalisé lorsque légalement autorisé.

Le simple fait de connaître l'URL du fichier ne doit jamais permettre de le télécharger.

---

# 9. PROGRAMME DE COMMISSIONS DES CONTRIBUTEURS

C'est une fonctionnalité centrale du produit.

Le contributeur gagne de l'argent lorsqu'une offre qu'il a publiée génère un déverrouillage payant éligible.

La commission n'est pas liée à la création de documents.

## 9.1 Répartition financière

Modèle initial :

- Plateforme : 70 %.
- Contributeur : 30 %.

IMPORTANT :

La répartition se fait sur la **valeur interne des crédits effectivement consommés** pour un déverrouillage éligible, **sans déduction des frais Chariow** (version 1.2).

Valeur interne d'un déverrouillage = nombre de crédits consommés × valeur interne du crédit figée sur le lot.

Exemple (1 crédit = 0,10 USD) :

Déverrouillage standard : 5 crédits, soit une valeur interne de 0,50 USD.
Commission contributeur (30 %) : 0,15 USD.
Part plateforme (70 %) : 0,35 USD.

Les frais Chariow de la recharge restent une charge de paiement de la plateforme, sans effet sur la commission.

Les crédits non consommés ne génèrent aucune commission. Ils restent une dette de la plateforme envers l'utilisateur dans le grand livre.

Ne pas coder ces valeurs en dur.

Prévoir une configuration administrative.

La plateforme doit conserver l'historique du taux appliqué à chaque transaction.

## 9.2 Conditions de commission

Une commission peut être générée uniquement si :

- L'offre est validée.
- L'offre est active au moment du déverrouillage (consommation des crédits).
- Les crédits consommés proviennent d'un paiement confirmé.
- Le déverrouillage est éligible.
- L'achat n'est pas un doublon.
- Le paiement n'a pas été remboursé.
- L'opération n'est pas frauduleuse.

Un contributeur ne peut pas gagner de commission sur ses propres achats.

## 9.3 Commissions en attente et disponibles

Prévoir quatre statuts :

PENDING :
Commission générée, mais encore en attente de validation définitive. Une commission en attente peut être mise en retenue (revue manuelle) sans changer de statut.

AVAILABLE :
Commission validée et disponible au retrait.

PAID (décision D4) :
Commission couverte par un retrait **effectivement payé** au contributeur : référence de paiement et preuve enregistrées. Une approbation administrative ne suffit pas.

REVERSED :
Commission annulée à la suite d'un remboursement, d'une fraude ou d'une annulation justifiée, par une écriture compensatoire.

**Délai de sécurité (décision D5).** Une commission devient disponible uniquement lorsque toutes les conditions suivantes sont réunies :

1. Les fonds sont confirmés : la vente Chariow du lot de crédits consommé est réglée (statut `settled`, date de règlement renseignée), après vérification par l'API Chariow.
2. Le délai de retenue configurable est écoulé, compté depuis la plus tardive de ces deux dates : consommation des crédits, ou règlement Chariow.
3. Aucun remboursement, litige ou signalement de fraude n'est ouvert sur le lot, l'offre, l'acheteur ou le contributeur.
4. Le compte du contributeur est en règle.
5. Un délai renforcé configurable s'applique aux nouveaux contributeurs et aux opérations signalées par les règles anti-fraude.

Les règles détaillées et les valeurs par défaut proposées figurent dans `docs/PHASE_0_AUDIT.md`.

Une offre expirée ne doit pas supprimer les commissions acquises avant expiration.

## 9.4 Revenus des documents

RÈGLE ABSOLUE :

Les contributeurs ne touchent aucune commission sur :

- Les CV.
- Les lettres de motivation.
- Les lettres de demande d'emploi.
- Les lettres de recommandation.
- Les traductions.
- Les optimisations de documents.
- Les autres services du studio documentaire.

Ces revenus appartiennent intégralement à OPPORTINITIES.

Ne jamais associer un document vendu à une commission de contributeur.

---

# 10. PORTEFEUILLE CONTRIBUTEUR

Chaque utilisateur possède un tableau de bord financier.

Afficher :

- Total des commissions générées.
- Commissions en attente.
- Solde disponible.
- Total déjà retiré.
- Nombre de déverrouillages générés.
- Nombre d'offres publiées.
- Performance de chaque offre.

## Historique financier

Colonnes :

- Date.
- Offre concernée.
- Identifiant transaction.
- Crédits consommés.
- Valeur interne des crédits consommés.
- Taux de commission.
- Commission.
- Statut.

Tous les montants doivent être conservés avec une précision décimale adaptée.

Utiliser une devise de référence USD pour le grand livre financier.

Ne jamais utiliser les nombres flottants pour les calculs monétaires.

## 10.1 Demandes de retrait

Minimum de retrait initial : 10 USD.

Cette valeur doit être configurable.

Un contributeur peut demander le retrait uniquement lorsque son solde disponible atteint le minimum.

Moyens envisagés :
- Mobile Money.
- Virement bancaire.
- Autres méthodes approuvées.

Les moyens réellement disponibles dépendent du pays et du fournisseur de décaissement.

Demander les informations nécessaires dans un espace sécurisé.

Statuts :

- PENDING
- UNDER_REVIEW
- APPROVED
- PROCESSING
- PAID
- REJECTED

Lors d'une demande, le montant demandé doit être réservé pour éviter une double utilisation.

Si la demande est rejetée, libérer le montant réservé.

Le statut PAID signifie que l'argent a **effectivement été versé** au contributeur (décision D4). L'approbation (APPROVED) et le traitement (PROCESSING) ne suffisent pas.

Le passage à PAID exige :
- un identifiant de référence du paiement (opérateur Mobile Money ou banque) ;
- une preuve de paiement ;
- la date du paiement ;
- l'administrateur qui l'a enregistré.

Au-delà d'un montant configurable, l'administrateur qui approuve et celui qui marque le retrait comme payé doivent être différents.

PAID est un statut définitif. Une erreur constatée ensuite se corrige par une écriture compensatoire.

Lorsqu'un retrait passe à PAID, les commissions qu'il couvre (dans l'ordre chronologique) passent au statut PAID.

L'administration doit pouvoir traiter les retraits manuellement.

Ne pas prétendre que Chariow effectue automatiquement les décaissements sans vérifier sa documentation et ses capacités réelles.

---

# 11. STUDIO INTELLIGENT DE CRÉATION DE DOCUMENTS

C'est le deuxième grand pilier commercial.

Créer une section indépendante appelée :

OPPORTINITIES CAREER STUDIO

Objectif : permettre à toute personne de produire des documents professionnels sans compétences particulières en rédaction.

Le remplissage et l'aperçu doivent être gratuits.

L'exportation PDF est payante.

## 11.1 Créateur de CV

Formulaire guidé :

- Nom complet.
- Photo facultative.
- Adresse.
- Pays.
- Ville.
- Téléphone.
- E-mail.
- Titre professionnel.
- Résumé professionnel.
- Formations.
- Expériences.
- Compétences.
- Langues.
- Certifications.
- Projets.
- Références facultatives.

Permettre d'ajouter plusieurs expériences et formations.

Ne jamais imposer une photo.

L'IA doit améliorer les formulations sans inventer des informations.

## 11.2 Modèles de CV

Prévoir au minimum :

- Classique.
- Moderne.
- Professionnel international.
- Académique.
- Jeune diplômé.
- Cadre et dirigeant.

Tous les modèles doivent être :
- Élégants.
- Lisibles.
- Professionnels.
- Compatibles avec les systèmes ATS lorsque possible.
- Adaptés à une exportation PDF.

L'utilisateur peut changer de modèle avant le paiement.

## 11.3 Lettre de motivation

Formulaire :

- Informations personnelles.
- Entreprise.
- Poste recherché.
- Offre sélectionnée éventuellement.
- Formation.
- Expérience.
- Compétences.
- Motivations.
- Langue du document.

L'IA génère une lettre personnalisée.

Si une offre OPPORTINITIES est sélectionnée, utiliser les informations de l'offre et du profil du candidat.

## 11.4 Lettre de demande d'emploi

Outil indépendant.

Permet de rédiger une demande spontanée à une entreprise même lorsqu'aucune annonce n'existe.

Champs :
- Destinataire.
- Entreprise.
- Poste recherché.
- Profil.
- Diplômes.
- Expériences.
- Compétences.
- Motivations.

## 11.5 Lettre de recommandation

Permettre de préparer un projet de lettre que la personne recommandant le candidat pourra vérifier et signer.

Ne jamais fabriquer une fausse recommandation.

## 11.6 Autres documents

Prévoir une architecture extensible permettant d'ajouter :

- Lettre de candidature.
- Lettre de stage.
- Lettre de démission.
- Lettre de demande de stage.
- Lettre de remerciement après entretien.
- Lettre de relance de candidature.
- Profil professionnel.
- Lettre de présentation.

## 11.7 Adaptation du CV à une offre

Fonctionnalité avancée :

L'utilisateur sélectionne une offre et son CV existant.

L'IA compare :
- Expériences.
- Compétences.
- Formation.
- Exigences du poste.

Elle propose une version adaptée.

Ne jamais inventer de diplôme, expérience ou compétence.

## 11.8 Aperçu et exportation

Le candidat peut :
- Créer.
- Modifier.
- Prévisualiser.
- Changer le modèle.
- Régénérer le contenu.
- Enregistrer son brouillon gratuitement.

L'exportation PDF est réglée en **crédits** prélevés sur le portefeuille de crédits de l'utilisateur (décision D2).

Proposer une tarification administrable, exprimée en crédits.

Coûts indicatifs au taux de référence (1 crédit = 0,10 USD), configurables :
- CV PDF : 15 crédits (1,50 USD).
- Lettre de motivation : 10 crédits (1 USD).
- Lettre de demande d'emploi : 10 crédits (1 USD).
- Pack documentaire CV + lettre : 25 crédits (2,50 USD).

Les documents exportés sont des revenus de la plateforme à 100 % de la valeur interne des crédits consommés.

Aucune commission contributeur.

## 11.9 Intelligence artificielle

Créer un service AI centralisé.

Ne pas disperser les appels API dans les contrôleurs.

Prévoir :
- Prompts versionnés.
- Gestion des langues.
- Validation des réponses.
- Limites d'utilisation.
- Gestion des erreurs.
- Journalisation des coûts.
- Protection contre les abus.
- Vérification des informations générées.

Ne jamais exposer la clé API au navigateur.

Les clés doivent être conservées dans les variables d'environnement.

Prévoir une interface permettant de changer de fournisseur IA ultérieurement.

---

# 12. INTÉGRATION CHARIOW

Intégrer Chariow pour les paiements.

Prévoir une architecture indépendante du fournisseur.

**Rôle de Chariow : uniquement le paiement des recharges de crédits.** Chaque pack de recharge correspond à un produit Chariow de type License.

Les déverrouillages, packs d'offres, documents, commissions, soldes et retraits sont gérés exclusivement par OPPORTINITIES, sans aucun appel à Chariow.

Le parcours de recharge, de confirmation et d'attribution des crédits est décrit au §8.3.5.

Workflow de consommation (interne) :

1. L'utilisateur demande un déverrouillage, un pack d'offres ou un export.
2. Dans une transaction atomique, le backend :
   - vérifie le solde et l'éligibilité ;
   - débite les crédits (FIFO par lot) ;
   - crée le déverrouillage ou l'export ;
   - passe les écritures comptables ;
   - s'il s'agit d'un déverrouillage éligible, crée la commission une seule fois.

Si la validation technique des produits License échoue, le choix du mode de paiement sera présenté de nouveau au propriétaire avant la phase 3.

Sécurité obligatoire :

- Vérification de signature des webhooks si disponible.
- Vérification du montant.
- Vérification de la devise.
- Vérification de la référence.
- Idempotence.
- Protection contre les notifications falsifiées.
- Journalisation.
- Gestion des remboursements.
- Gestion des paiements en attente.
- Gestion des paiements échoués.

Ne jamais considérer une simple redirection du navigateur comme une preuve de paiement.

Ne pas inventer les endpoints Chariow.

Utiliser la documentation officielle et les identifiants de test avant la production.

Ne jamais stocker les clés secrètes dans Git.

---

# 13. TABLEAU DE BORD UTILISATEUR

Créer un dashboard unique avec une navigation claire.

Menu :

- Vue d'ensemble.
- Trouver un emploi.
- Mes offres publiées.
- Publier une offre.
- Mes favoris.
- Mes déverrouillages.
- Mes documents.
- Career Studio.
- Mon portefeuille.
- Mes commissions.
- Mes retraits.
- Notifications.
- Paramètres.

La partie financière doit être présentée uniquement aux utilisateurs concernés.

L'utilisateur doit comprendre immédiatement :
- Ses activités.
- Ses offres.
- Ses gains.
- Ses dépenses.
- Ses documents.

---

# 14. ESPACE ADMINISTRATEUR

Créer une interface d'administration distincte et sécurisée.

Modules :

## Tableau de bord

- Nombre d'utilisateurs.
- Nouveaux inscrits.
- Offres publiées.
- Offres en attente.
- Offres actives.
- Offres expirées.
- Déverrouillages.
- Transactions.
- Chiffre d'affaires.
- Commissions générées.
- Retraits en attente.
- Revenus documentaires.

Les statistiques doivent provenir de données réelles.

## Gestion des utilisateurs

- Recherche.
- Consultation.
- Modification autorisée.
- Suspension.
- Réactivation.
- Vérification.
- Historique des activités.

## Modération des offres

- Liste des annonces.
- Consultation du PDF.
- Consultation de la source.
- Validation.
- Rejet.
- Demande de correction.
- Suspension.
- Historique des décisions.

## Gestion financière

- Transactions.
- Paiements.
- Remboursements.
- Commissions.
- Retraits.
- Export CSV.
- Rapports.

## Paramètres commerciaux

L'administrateur doit pouvoir modifier :

- Prix de déverrouillage.
- Taux de conversion des crédits (valeur interne d'un crédit).
- Packs de recharge (montant, crédits, produit Chariow associé).
- Coût en crédits des services et des packs d'offres.
- Prix des documents.
- Répartition plateforme / contributeur.
- Minimum de retrait.
- Délai de validation des commissions.
- Devises supportées.
- Méthodes de paiement disponibles.

Toutes les modifications doivent être historisées.

## Gestion documentaire

- Modèles de CV.
- Modèles de lettres.
- Prix.
- Disponibilité.
- Langues.
- Versions des modèles.

## Gestion des traductions

Permettre de compléter et de corriger les textes français et anglais.

---

# 15. RECHERCHE ET FILTRES

Le moteur de recherche doit être rapide et performant.

Filtres :

- Pays.
- Ville.
- Catégorie.
- Entreprise.
- Type de contrat.
- Niveau d'expérience.
- Niveau d'études.
- Salaire.
- Présentiel.
- Télétravail.
- Hybride.
- Date de publication.
- Date limite.

Prévoir :
- Pagination.
- Tri.
- Recherche textuelle.
- Offres récentes.
- Offres populaires.
- Favoris.
- Recherche enregistrée.

Ne pas afficher les offres expirées dans les résultats actifs.

Prévoir une page d'archives séparée.

---

# 16. NOTIFICATIONS

Système de notifications internes.

Événements :

- Inscription réussie.
- E-mail vérifié.
- Offre soumise.
- Offre validée.
- Offre rejetée.
- Offre bientôt expirée.
- Offre expirée.
- Déverrouillage effectué.
- Commission générée.
- Commission disponible.
- Retrait demandé.
- Retrait approuvé.
- Retrait payé.
- Paiement échoué.
- Document disponible.

Prévoir également les emails importants via Brevo SMTP.

Toutes les notifications doivent être bilingues.

Prévoir un système de lecture / non-lu.

---

# 17. BASE DE DONNÉES

Créer des migrations propres et cohérentes.

Tables principales proposées :

## Utilisateurs
- users
- user_profiles
- user_preferences
- roles
- permissions
- role_user
- countries
- cities

## Offres
- job_categories
- job_offers
- job_offer_files
- job_offer_sources
- job_offer_status_history
- job_offer_reports
- saved_jobs

## Paiements
- orders
- payments
- payment_events
- refunds
- transactions

## Crédits et déverrouillages
- credit_accounts
- credit_lots
- credit_movements
- credit_lot_allocations
- job_unlocks

## Grand livre
- ledger_accounts
- ledger_transactions
- ledger_entries
- financial_settings

## Commissions
- contributor_wallets
- contributor_commissions
- commission_holds

## Retraits
- withdrawal_methods
- withdrawal_requests
- withdrawal_events
- withdrawal_commission_allocations

## Documents
- resumes
- resume_sections
- resume_templates
- cover_letters
- generated_documents
- document_templates
- document_exports

## IA
- ai_generations
- ai_prompt_versions
- ai_usage_logs

## Communication
- notifications
- conversations
- messages

## Administration
- admin_logs
- security_events
- system_settings

Adapter et normaliser ce schéma au fur et à mesure de l'implémentation.

Ajouter les clés étrangères, index et contraintes uniques nécessaires.

Les montants financiers doivent utiliser DECIMAL, jamais FLOAT.

---

# 18. SÉCURITÉ ET PROTECTION DES DONNÉES

Sécurité prioritaire.

Prévoir :

- Validation serveur de toutes les entrées.
- Protection SQL injection.
- Protection XSS.
- Protection CSRF.
- Rate limiting.
- Contrôle des permissions.
- Vérification des fichiers uploadés.
- Limitation de taille des fichiers.
- Contrôle des types MIME.
- Stockage privé.
- Protection des PDF.
- Journalisation des actions sensibles.
- Sauvegardes automatiques.
- Gestion sécurisée des secrets.
- HTTPS obligatoire en production.

Séparer les accès :
- Utilisateur.
- Modérateur.
- Administrateur.
- Super administrateur.

Ne jamais faire confiance aux données envoyées par le navigateur pour calculer :
- Un prix.
- Une commission.
- Un solde.
- Un retrait.
- Un statut de paiement.

Toutes les opérations financières doivent être réalisées côté serveur dans des transactions SQL atomiques.

Prévoir un journal financier append-only pour les écritures comptables.

Les corrections doivent créer des écritures compensatoires plutôt que modifier silencieusement l'historique.

Les administrateurs ne doivent pas pouvoir effacer discrètement les traces financières.

Les actions sensibles doivent enregistrer :
- Acteur.
- Rôle.
- Date.
- Adresse IP.
- User-Agent.
- Action.
- Résultat.
- Valeurs avant / après lorsque pertinent.

Prévoir une politique de confidentialité, des conditions d'utilisation et une politique de conservation des données.

---

# 19. ANTI-FRAUDE ET FIABILITÉ

Prévoir les mécanismes suivants :

- Détection des offres dupliquées.
- Signalement d'une offre.
- Signalement d'un utilisateur.
- Vérification des sources.
- Contrôle des annonces expirées.
- Détection des tentatives de manipulation de commissions.
- Détection des achats répétés.
- Interdiction des commissions sur ses propres achats.
- Vérification des demandes de retrait.
- Contrôle des remboursements.
- Suspension des comptes suspects.

Un utilisateur ne doit pas pouvoir :
- Modifier son propre solde.
- S'attribuer une commission.
- Débloquer gratuitement un document payant.
- Télécharger le PDF d'une offre non déverrouillée.
- Réactiver une offre expirée sans autorisation.
- Contourner la vérification d'un paiement.

---

# 20. PAGES À DÉVELOPPER

## Pages publiques

- /
- /jobs
- /jobs/{slug}
- /countries
- /categories
- /career-studio
- /about
- /contact
- /faq
- /privacy
- /terms

## Authentification

- /register
- /login
- /forgot-password
- /reset-password
- /verify-email

## Espace utilisateur

- /dashboard
- /dashboard/jobs
- /dashboard/jobs/create
- /dashboard/jobs/manage
- /dashboard/unlocks
- /dashboard/documents
- /dashboard/wallet
- /dashboard/commissions
- /dashboard/withdrawals
- /dashboard/settings
- /dashboard/notifications

## Career Studio

- /career-studio/resume
- /career-studio/cover-letter
- /career-studio/job-application-letter
- /career-studio/recommendation-letter
- /career-studio/history

## Administration

- /admin
- /admin/users
- /admin/jobs
- /admin/moderation
- /admin/payments
- /admin/commissions
- /admin/withdrawals
- /admin/documents
- /admin/templates
- /admin/settings
- /admin/logs

Les pages sont servies par Next.js avec un préfixe de langue (`/fr/...`, `/en/...`). Chaque groupe de pages est protégé par le middleware Next.js pour l'expérience utilisateur, et **chaque endpoint de l'API est protégé côté NestJS** par des guards d'authentification, de rôles et de permissions. La protection côté interface ne remplace jamais le contrôle côté API.

---

# 21. SEO ET PERFORMANCE

Prévoir :

- URLs lisibles.
- Slugs uniques.
- Métadonnées dynamiques.
- Sitemap XML.
- Robots.txt.
- Open Graph.
- Données structurées JobPosting lorsque l'offre respecte les critères Google.
- Canonical URLs.
- Pagination SEO.
- Pages par pays.
- Pages par catégorie.

Optimiser :
- Images.
- PDF.
- Requêtes SQL.
- Index.
- Cache.
- Chargement des composants.
- Pagination.

Ne pas mettre en cache publiquement les données confidentielles des utilisateurs.

---

# 22. TESTS ET QUALITÉ

Créer des tests automatisés.

Scénarios obligatoires :

1. Inscription avec pays obligatoire.
2. Refus d'une inscription sans pays.
3. Connexion sécurisée.
4. Vérification d'e-mail.
5. Publication gratuite.
6. Soumission d'une offre à modération.
7. Validation par modérateur.
8. Publication programmée.
9. Activation à la bonne date.
10. Expiration automatique.
11. Blocage du déverrouillage après expiration.
12. Paiement réussi.
13. Paiement échoué.
14. Webhook reçu plusieurs fois.
15. Déverrouillage unique.
16. Calcul exact des commissions.
17. Interdiction de l'auto-commission.
18. Annulation après remboursement.
19. Demande de retrait.
20. Blocage du retrait sous le minimum.
21. Paiement d'un retrait.
22. Génération d'un CV.
23. Export PDF après paiement.
24. Absence de commission sur les documents.
25. Fonctionnement FR / EN.
26. Fonctionnement clair / sombre.
27. Protection des fichiers privés.
28. Contrôle des permissions administratives.
29. Achat répété du même pack de crédits par le même utilisateur.
30. Consommation FIFO des lots et calcul exact de la valeur interne consommée.
37. Nombre de crédits attribués égal au nombre de crédits du pack, quels que soient les frais Chariow.
38. Notifications multiples, rejeu manuel et réconciliation simultanée : crédits attribués une seule fois.
39. Montant, produit, devise ou référence incohérents : aucun crédit attribué et alerte à l'administration.
31. Refus d'un déverrouillage ou d'un export avec un solde de crédits insuffisant.
32. Consommations simultanées sans double dépense de crédits.
33. Absence de commission sur des crédits gratuits.
34. Commission maintenue en attente tant que la vente Chariow n'est pas réglée ou que le délai de sécurité court.
35. Statut PAID impossible sans référence et preuve de paiement.
36. Équilibre du grand livre (somme des débits égale à la somme des crédits) après chaque opération.

Tous les calculs financiers doivent être testés.

---

# 23. MÉTHODE DE DÉVELOPPEMENT AVEC CLAUDE CODE

IMPORTANT : ne pas essayer de développer toute l'application en une seule opération.

Procéder par phases.

## PHASE 0 — AUDIT ET PLANIFICATION

Avant de coder :

- Inspecter le dépôt.
- Identifier les fichiers existants.
- Vérifier l'environnement.
- Vérifier les dépendances.
- Vérifier la configuration.
- Identifier les risques.
- Proposer l'architecture.
- Établir le plan des migrations.

Ne pas écraser des fichiers existants sans justification.

Ne pas supprimer de fonctionnalités déjà opérationnelles.

Présenter un rapport initial avant de commencer les modifications importantes.

## PHASE 1 — FONDATION

Développer :

- Monorepo (Next.js, NestJS, packages partagés).
- PostgreSQL et Prisma.
- Docker Compose de développement.
- Authentification.
- Inscription simple.
- Pays africains.
- Villes.
- Français / anglais.
- Mode clair / sombre.
- Design system.
- Navigation.
- Dashboard utilisateur.
- Dashboard administrateur.

Livrable : application fonctionnelle avec authentification et interfaces principales.

## PHASE 2 — OFFRES ET MODÉRATION

Développer :

- Publication.
- PDF.
- Sources.
- Dates.
- Catégories.
- Recherche.
- Filtres.
- Modération.
- Validation.
- Programmation.
- Expiration automatique.
- Archivage.

Livrable : système complet de gestion des offres.

## PHASE 3 — PAIEMENTS ET COMMISSIONS

Développer :

- Intégration Chariow.
- Commandes.
- Webhooks.
- Déverrouillages.
- Crédits.
- Portefeuille.
- Commissions 70/30.
- Retraits.
- Historique financier.
- Anti-fraude.

Livrable : modèle économique fonctionnel en environnement de test.

## PHASE 4 — CAREER STUDIO

Développer :

- Générateur de CV.
- Modèles.
- Générateur de lettres.
- IA.
- Aperçus.
- Modifications.
- Paiement.
- Exportation PDF.
- Historique documentaire.

Livrable : studio professionnel opérationnel.

## PHASE 5 — FINALISATION

Développer et vérifier :

- Notifications.
- Emails.
- SEO.
- Sécurité.
- Optimisations.
- Tests.
- Documentation.
- Préparation de production.

Livrable : version candidate à la mise en production.

---

# 24. RÈGLES DE COLLABORATION AVEC LE DÉVELOPPEUR IA

Claude Code doit respecter les règles suivantes :

1. Lire et comprendre le projet avant toute modification.
2. Ne pas inventer des fonctionnalités prétendument terminées.
3. Ne pas utiliser de données fictives en production.
4. Ne pas simuler un paiement réussi.
5. Ne pas exposer les clés secrètes.
6. Ne pas coder les prix en dur.
7. Ne pas coder les commissions en dur.
8. Ne pas supprimer des données existantes.
9. Éviter les dépendances inutiles.
10. Maintenir une architecture propre.
11. Respecter les principes de sécurité.
12. Tester chaque module avant de passer au suivant.
13. Documenter les migrations.
14. Fournir un rapport à la fin de chaque phase.

Pour chaque phase, le rapport doit présenter :

- Objectif.
- Fichiers créés.
- Fichiers modifiés.
- Tables créées.
- Fonctionnalités terminées.
- Tests exécutés.
- Résultats des tests.
- Problèmes rencontrés.
- Points restant à corriger.
- Prochaine étape.

Ne jamais déclarer une phase terminée si les tests critiques échouent.

Ne jamais passer à la phase suivante sans validation.

---

# 25. CRITÈRES FINAUX DE LIVRAISON

OPPORTINITIES doit être :

- Professionnel.
- Bilingue.
- Multinational.
- Mobile-first.
- Accessible.
- Sécurisé.
- Rapide.
- Évolutif.
- Financièrement traçable.
- Facile à administrer.

Le système doit respecter impérativement les règles suivantes :

A. Publication gratuite des offres.

B. Publication possible par un simple contributeur, sans être recruteur.

C. Vérification obligatoire des annonces.

D. Date de début et date de fin obligatoires.

E. Expiration automatique des offres.

F. Consultation publique gratuite des informations générales.

G. Déverrouillage payant des informations complètes.

H. Partage des revenus des offres : 70 % plateforme et 30 % contributeur, sur la valeur interne des crédits consommés. Les frais Chariow sont supportés par la plateforme.

I. Commissions uniquement sur les déverrouillages payants éligibles.

J. Aucune commission sur les ventes de documents.

K. Retrait à partir de 10 USD, seuil configurable.

L. Création et aperçu des documents gratuits, export PDF payant.

M. Français et anglais dès la première version.

N. Mode clair et mode sombre.

O. Inscription simple avec pays africain obligatoire.

P. Sécurité financière et journalisation des opérations.

---

# INSTRUCTION FINALE À CLAUDE CODE

Tu es chargé de construire OPPORTINITIES comme un véritable produit SaaS destiné à une utilisation commerciale.

Ne traite pas ce document comme une simple maquette.

Les fonctionnalités doivent être réellement opérationnelles, reliées à une base de données, sécurisées et testables.

Commence exclusivement par la PHASE 0 : audit du dépôt, compréhension de l'environnement et proposition du plan d'implémentation.

Ne commence pas immédiatement à générer tous les fichiers.

Présente d'abord ton rapport d'audit et attends la validation avant de commencer la PHASE 1.

Le cahier des charges constitue la référence fonctionnelle et commerciale du projet.
