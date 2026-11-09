# OPPORTINITIES — Rapport PHASE 0 : Audit et architecture

- Version : **2.1**, 9 novembre 2026. Modèle économique corrigé selon `docs/CORRECTION_MODELE_ECONOMIQUE.md`.
- Statut : **en attente de validation du propriétaire**. La phase 1 n'est pas commencée.
- Périmètre : audit et conception uniquement. Aucun code n'a été écrit et aucune dépendance installée.

**Historique**
- 1.0 — Audit initial.
- 2.0 — Intègre les orientations du propriétaire sur D1 à D5 :
  - analyse des produits Chariow de type License et des conditions de rachat ;
  - modèle de crédits internes ;
  - grand livre financier ;
  - règles de commission, sens du statut `paid` et délai de sécurité ;
  - conséquences techniques et financières.

---

## 1. Objectif

Examiner le dépôt et l'environnement, confirmer la faisabilité de la stack Next.js + NestJS + PostgreSQL + Prisma + Tailwind CSS, puis concevoir l'architecture, le schéma de données et le modèle financier en tenant compte des décisions du propriétaire.

---

## 2. État du dépôt et de l'environnement

| Élément | Constat |
|---|---|
| Contenu | `CLAUDE.md`, `docs/CAHIER_DE_CHARGFE.md` (mis à jour en version 1.1) et ce rapport. Aucun code source. |
| Git | Le dossier n'est pas un dépôt Git. Initialisation prévue en phase 1a. |
| Dépendances, `.env`, secrets | Aucun. |
| Skills et instructions projet | Pas de dossier `.claude/` dans le projet. Seuls des Skills génériques sont disponibles. |

| Outil | Version | Constat |
|---|---|---|
| Node.js | 20.20.2 | **Plus maintenu depuis avril 2026.** Installer Node 24 LTS. |
| pnpm | 10.34.5 | Retenu pour le monorepo. |
| Docker / Compose | 29.8.1 / v5.5.1 | Installé, mais le démon Docker Desktop n'était pas démarré. |
| PostgreSQL / Redis | absents localement | Normal : ils tourneront dans Docker. |

Versions stables sur npm au 9 novembre 2026 :

- next 16.4.5 ;
- react 19.3.1 ;
- @nestjs/core 12.4.1 ;
- tailwindcss 4.3.5 ;
- next-intl 4.14.9 ;
- **prisma 7.10.1, à fixer explicitement**, car le tag `latest` de npm pointe vers la pré-version 8.0.0-rc.33.

---

## 3. Décisions du propriétaire et état de traitement

| # | Décision | Traitement |
|---|---|---|
| D1 | `CLAUDE.md` est la référence technique. Supprimer Laravel et MySQL du cahier. | **Fait.** Le cahier passe en version 1.1 : §2, §7.6, le schéma de données, §20 et §23 sont réécrits. Plus aucune référence à Laravel, MySQL, Blade, Livewire ou Alpine.js, hormis l'interdiction explicite. |
| D2 | Portefeuille de crédits internes, avec une analyse préalable des produits License. | Analyse documentaire au §4. **Une validation technique réelle reste nécessaire** (protocole au §4.4). Cahier §8.3, §11.8 et §12 mis à jour. |
| D3 | 30 % de la valeur interne des crédits consommés pour les déverrouillages éligibles (corrigé en version 2.1 : frais Chariow non déduits), 70 % pour la plateforme. Grand livre complet. | Modèle détaillé aux §5 et §6. Cahier §9.1 et §9.2 mis à jour. |
| D4 | `paid` = retrait effectivement payé. Une approbation ne suffit pas. | Règles au §7. Cahier §9.3 et §10.1 mis à jour. |
| D5 | Délai de sécurité configurable, fondé sur la confirmation des fonds et le risque. | Règle proposée au §8. Cahier §9.3 mis à jour. |

Les autres incohérences relevées dans la version 1.0 sont reprises au §14 :
- prénom et nom séparés ;
- champ « mode de travail » (`work_mode`) ;
- messagerie reportée ;
- 2FA pour les administrateurs ;
- renommage du fichier du cahier.

---

## 4. D2 — Analyse Chariow : produits License et rachat

Sources : documentation officielle [chariow.dev](https://chariow.dev) et [centre d'aide Chariow](https://help.chariow.com), consultés le 9 novembre 2026.

### 4.1 Ce que dit la documentation

| Sujet | Constat documenté | Source |
|---|---|---|
| Types de produits | `downloadable`, `course`, `license`, `service`, `bundle`, `coaching`. Le checkout API **ne prend pas en charge** `service` ni `coaching`. | Guide Products, Initiate Checkout |
| Montant | **Pas de montant libre** : le prix vient du produit. Il ne varie que par une variante de prix, un code promo ou la conversion de devise (avec majoration). | Guide Checkout |
| Rachat bloqué | Pour `downloadable`, `course` et `bundle`, l'API renvoie `already_purchased` et **ne crée aucune vente** si le client a un accès actif. Le rachat redevient possible seulement après révocation de l'accès (par exemple après un remboursement). | Initiate Checkout |
| Rachat License | « Repurchase is always allowed. Each purchase generates a new unique license key. » | Initiate Checkout |
| Clés de licence | Générées automatiquement à chaque vente. Aucun stock de clés à charger. L'activation peut être désactivée, la durée peut être illimitée. Révocation possible par API, de façon définitive. | Guide Licenses |
| Quantité | Aucun paramètre de quantité au checkout : un achat correspond à une unité. | Initiate Checkout |
| Idempotence | Aucune clé d'idempotence côté checkout. | Initiate Checkout |
| Statuts de vente | `initiated`, `awaiting_payment`, `completed`, `failed`, `abandoned`, `settled`. **Aucun statut de remboursement.** Un champ `is_access_revoked` existe, sans explication de ce qui le déclenche. | Guide Sales |
| Règlement | `settlement.amount` (net versé après frais), `service_fee`, `due_at`, `done_at` (vide tant que le règlement n'est pas fait). Fonds versés au portefeuille Chariow du vendeur sous **72 h maximum**. | Guide Sales, aide n° 91 |
| Frais Chariow | **15 % par vente** tant que le chiffre d'affaires cumulé reste sous 5 000 USD, puis **10 %**. Tarif négocié au-delà de 15 000 USD. Aucun abonnement. La page ne mentionne ni frais de paiement séparés, ni frais fixes. | Aide n° 64 |
| Webhooks (Pulses) | `successful.sale`, `failed.sale`, `abandoned.sale`, des événements de licence, `affiliate.joined`. **Aucun événement de remboursement.** Signature HMAC-SHA256 (`x-chariow-signature`). Idempotence via l'en-tête `x-pulse-delivery-id`. 5 tentatives, puis désactivation automatique de la Pulse. | Guides Pulses et Pulse Security |
| Environnement de test | **Aucun sandbox documenté.** Seul le tableau de bord permet d'envoyer des Pulses de test. | Guides Checkout et Pulses |
| Décaissements vers des tiers | **Aucune API de décaissement.** Le vendeur retire ses propres gains vers Mobile Money (MTN, Orange, Wave, Moov, etc.). | Aide sur les retraits |
| Moyens de paiement des acheteurs | Carte bancaire partout. Mobile Money dans « plus de 25 pays africains ». La liste par pays n'a pas pu être extraite. | Aide n° 68 |

### 4.2 Conséquence principale

**Le modèle de crédits ne supprime pas la dépendance aux produits License.** Un même utilisateur doit pouvoir racheter le même pack plusieurs fois. Or, d'après la documentation, seuls les produits `license` le permettent. Les packs de crédits doivent donc être créés comme produits License.

Ce que le modèle de crédits apporte réellement :

- Chariow ne contient plus que **2 à 4 produits** (les packs), au lieu d'un produit par service. Il y a donc moins de prix à synchroniser.
- Les prix des services (déverrouillages, documents) sont fixés **uniquement dans OPPORTINITIES**, en crédits. Les modifier ne demande aucune action dans Chariow.
- Un déverrouillage ou un export ne dépend plus de la disponibilité de Chariow à ce moment-là.

### 4.3 Points non garantis par la documentation

1. Le rachat d'un produit License fonctionne-t-il réellement via `POST /v1/checkout` pour un **même client** (même email, même téléphone) ? La phrase de la référence API est claire, mais le guide Licenses ne la confirme pas.
2. Contenu des **emails envoyés par Chariow** à l'acheteur. Il recevra probablement une « clé de licence » qui n'a aucune utilité pour lui. Ce message est-il personnalisable ?
3. Les **frais réels** par vente : le champ `payment_fee` s'ajoute-t-il aux 15 % ? Qui supporte la majoration de conversion de devise ?
4. Le **remboursement** : procédure, délai, effet sur la vente (statut, `is_access_revoked`), frais Chariow conservés ou non.
5. Les **rétrofacturations** sur carte : sont-elles répercutées au vendeur, et dans quel délai ?
6. La **liste des pays et opérateurs** Mobile Money disponibles pour les acheteurs.
7. L'existence d'un **environnement de test**.

### 4.4 Protocole de validation technique (avant de retenir définitivement la solution)

**Étape A — Test manuel par le propriétaire.** Aucun code. Coût : 2 ou 3 achats au prix minimal.

1. Dans Chariow, créer un produit **License** « Pack test » au prix minimal autorisé. Désactiver l'activation, choisir une durée illimitée et un stock illimité. Le produit peut rester non mis en avant.
2. L'acheter **deux fois** depuis la page boutique, avec le même email et le même téléphone.
3. Noter :
   - si le second achat est accepté ;
   - si deux ventes apparaissent ;
   - les emails reçus par l'acheteur ;
   - les frais affichés ;
   - les dates de règlement.
4. Demander le remboursement d'une des deux ventes. Noter la procédure, le délai, le nouveau statut de la vente et le montant retenu par Chariow.
5. Envoyer au support Chariow les questions listées au §4.3 et conserver les réponses écrites.

**Étape B — Spike technique (si vous l'approuvez).** Je l'exécuterais au début de la phase 3, ou plus tôt sur décision.

Il s'agit d'un script isolé, hors du code produit, qui :
- appelle `POST /v1/checkout` deux fois pour le même client ;
- vérifie `custom_metadata` dans la Pulse et dans `GET /v1/sales/{id}` ;
- teste la vérification de signature et la déduplication.

La clé API serait placée par vous dans un fichier `.env` local, jamais transmise dans la conversation.

**Critères de décision**

| # | Critère | Bloquant |
|---|---|---|
| G1 | Le rachat du même pack par le même client crée bien une nouvelle vente, depuis la boutique et via l'API. | **Oui** |
| G2 | `custom_metadata` (référence de commande) est restitué dans la Pulse et dans `GET /v1/sales/{id}`. | **Oui** |
| G3 | Les frais et le montant net sont lisibles par vente. | Oui. Sinon, la règle de calcul des frais est à configurer manuellement. |
| G4 | Un remboursement est détectable, par l'API ou par une procédure manuelle fiable. | Non. Une procédure administrative peut le compenser. |
| G5 | Les emails Chariow sont acceptables pour l'acheteur, ou personnalisables. | Non. Il s'agit d'un sujet d'expérience utilisateur. |

**Si G1 ou G2 échoue :**
- demander au support Chariow une solution officielle pour les produits consommables (recharges) ;
- sinon, vous présenter une alternative. Un agrégateur à montant libre comme CinetPay, FedaPay, Paystack ou Flutterwave demanderait de modifier `CLAUDE.md`, donc votre validation.

La solution de rotation de produits identiques est écartée : elle est fragile et contraire aux conditions d'usage probables de Chariow.

Le **programme d'affiliation intégré de Chariow** a aussi été examiné et écarté : il rémunère l'achat du pack, et non la consommation de crédits sur une offre donnée.

---

## 5. D2 et D3 — Modèle de crédits et calcul des commissions

> **Section remplacée par le modèle économique définitif (version 2.1).** Le détail figure dans `docs/CORRECTION_MODELE_ECONOMIQUE.md`.

### 5.1 Principes

1. Chariow ne sert qu'au paiement des **recharges** : packs de 10, 20, 50 et 100 USD, soit 100, 200, 500 et 1 000 crédits. Ce sont des produits License.
2. **Valeur interne d'un crédit configurable** (référence : 0,10 USD), figée sur chaque lot à l'attribution.
3. **Les frais Chariow sont une charge de la plateforme.** Ils ne réduisent ni les crédits attribués ni la base des commissions.
4. Le coût de chaque service est exprimé en crédits, configurable et historisé. Les débits se font par lot, du plus ancien au plus récent (FIFO).
5. **Commission = 30 % × crédits consommés × valeur interne**, pour un déverrouillage éligible.
6. Les exports de documents ne génèrent aucune commission.

### 5.2 Précision des calculs

- Montants en `NUMERIC(20,6)`, jamais de nombres flottants. Les crédits sont des entiers.
- Avec une valeur interne de 0,10 USD et des coûts entiers en crédits, les calculs tombent juste (exemple : 5 × 0,10 × 30 % = 0,150000). Aucun problème d'arrondi.

### 5.3 Exemples chiffrés (1 crédit = 0,10 USD, frais Chariow de 15 %)

| Opération | Crédits | Valeur interne | Commission contributeur | Part plateforme avant frais |
|---|---|---|---|---|
| Déverrouillage standard | 5 | 0,50 | **0,15** | 0,35 |
| Déverrouillage premium | 10 | 1,00 | **0,30** | 0,70 |
| CV PDF | 15 | 1,50 | 0 | 1,50 |

Il faut **67 déverrouillages standard** pour atteindre le seuil de retrait de 10 USD.

---

## 6. D3 — Grand livre financier

### 6.1 Deux registres complémentaires, en ajout seul

1. **Registre des crédits**, en unités. Il retrace les achats, consommations, remboursements, expirations, dotations gratuites et ajustements. Le solde de crédits d'un utilisateur est la somme de ses mouvements.
2. **Grand livre comptable en partie double**, en USD. Chaque opération crée une transaction équilibrée : total des débits égal au total des crédits.

Garanties d'intégrité :
- UPDATE et DELETE sont interdits par trigger PostgreSQL et par les droits du rôle base de données de l'application ;
- chaque correction est une écriture compensatoire liée à l'écriture d'origine, avec un motif et l'administrateur concerné ;
- un contrôle quotidien vérifie l'équilibre global et la cohérence entre registre des crédits, grand livre, soldes en cache et ventes Chariow.

### 6.2 Plan de comptes proposé

| Type | Compte | Rôle |
|---|---|---|
| Actif | `chariow_receivable` | Montant net dû par Chariow pour une vente non encore réglée. |
| Actif | `chariow_wallet` | Fonds réglés sur le portefeuille Chariow de la plateforme. |
| Actif | `payout_treasury` | Trésorerie de la plateforme utilisée pour payer les contributeurs (Mobile Money, banque). |
| Actif | `contributor_recoverable:{id}` | Somme à récupérer sur les gains futurs d'un contributeur après annulation d'une commission déjà payée. |
| Passif | `customer_credits` | Valeur interne des crédits attribués et non consommés : dette envers les utilisateurs. |
| Passif | `contributor_pending:{id}` | Commissions en attente. |
| Passif | `contributor_available:{id}` | Commissions disponibles. |
| Passif | `contributor_reserved:{id}` | Montants réservés par une demande de retrait. |
| Produit | `revenue_unlocks` | Chiffre d'affaires brut des déverrouillages. |
| Produit | `revenue_documents` | Chiffre d'affaires brut des exports de documents. |
| Produit | `revenue_breakage` | Crédits expirés (seulement si une politique d'expiration est adoptée). |
| Charge | `payment_processing_fees` | Frais Chariow sur les recharges, supportés par la plateforme. |
| Charge | `contributor_commissions` | Commissions des contributeurs. |

### 6.3 Écritures types (recharge de 10 USD = 100 crédits, frais Chariow de 1,50 USD)

| Événement | Débit | Crédit |
|---|---|---|
| Recharge confirmée | `chariow_receivable` 8,50 ; `payment_processing_fees` 1,50 | `customer_credits` 10,00 |
| Règlement Chariow | `chariow_wallet` 8,50 | `chariow_receivable` 8,50 |
| Déverrouillage éligible (5 crédits) | `customer_credits` 0,50 ; `contributor_commissions` 0,15 | `revenue_unlocks` 0,50 ; `contributor_pending:{id}` 0,15 |
| Export de CV (15 crédits) | `customer_credits` 1,50 | `revenue_documents` 1,50 |
| Commission devenue disponible | `contributor_pending` | `contributor_available` |
| Demande de retrait (10,00) | `contributor_available` 10,00 | `contributor_reserved` 10,00 |
| Retrait rejeté | `contributor_reserved` | `contributor_available` |
| Retrait **payé** | `contributor_reserved` 10,00 | `payout_treasury` 10,00 |
| Transfert du portefeuille Chariow vers la trésorerie | `payout_treasury` | `chariow_wallet` |
| Commission annulée (statut `pending`) | `contributor_pending` | `contributor_commissions` |
| Commission annulée alors qu'elle était déjà payée | `contributor_recoverable` | `contributor_commissions` |
| Remboursement des crédits non utilisés | `customer_credits` (valeur interne restante) | `chariow_wallet`. Les frais Chariow non restitués restent en charge. |

Sur un déverrouillage standard, la plateforme reçoit 0,35 USD (70 % de 0,50 USD). La charge de paiement se mesure au niveau de la recharge, au §10.

**Le plan de comptes et les écritures doivent être validés par un expert-comptable.** Le référentiel dépend du pays de l'entité juridique (par exemple SYSCOHADA dans l'espace OHADA).

---

## 7. D4 — Statut `paid` et cycle des retraits

### 7.1 Retraits

```
pending -> under_review -> approved -> processing -> paid
   \___________\______________\___________\-------> rejected (montant réservé libéré)
```

- À la création d'une demande valide (montant ≥ seuil, méthode de retrait vérifiée), le montant est **réservé** immédiatement par une écriture `available -> reserved`.
- `approved` et `processing` ne versent rien.
- **`paid` exige** :
  - la référence de l'opérateur ou de la banque ;
  - une preuve de paiement (fichier privé) ;
  - la date effective du paiement ;
  - l'administrateur qui l'enregistre.
- **Séparation des tâches** : au-delà d'un seuil configurable, celui qui approuve et celui qui marque le retrait comme payé doivent être deux administrateurs différents.
- `paid` est définitif. Une erreur se corrige par une écriture compensatoire.
- Un échec de versement pendant `processing` remet la demande en `approved`, ou la passe en `rejected` avec libération du montant réservé, motif journalisé.

### 7.2 Commissions

- Statuts : `pending`, `available`, `paid`, `reversed`.
- À la création d'une demande de retrait, les commissions disponibles sont **affectées** à cette demande dans l'ordre chronologique (table `withdrawal_commission_allocations`). La dernière commission peut être affectée en partie.
- Les commissions affectées restent `available` (avec la mention « réservée » à l'écran) tant que le retrait n'est pas payé.
- Lorsque le retrait passe à `paid`, les commissions **entièrement couvertes** passent à `paid`. Une commission couverte en partie reste `available` pour le reste.
- Si le retrait est rejeté, les affectations sont libérées.

---

## 8. D5 — Délai de sécurité proposé

Une commission passe de `pending` à `available` uniquement si **toutes** les conditions suivantes sont réunies.

| # | Condition | Valeur par défaut proposée (configurable) |
|---|---|---|
| 1 | **Fonds réellement confirmés** : la vente Chariow du lot consommé est au statut `settled` et `settlement.done_at` est renseigné, après revérification par `GET /v1/sales/{id}`. Une notification seule ne suffit pas. | Obligatoire (Chariow annonce 72 h maximum) |
| 2 | **Délai de retenue** écoulé, compté depuis la plus tardive de ces deux dates : consommation des crédits, ou règlement Chariow. | **14 jours** |
| 3 | **Délai renforcé pour les nouveaux contributeurs** : compte de moins de 60 jours, ou aucun retrait déjà payé. | **30 jours** |
| 4 | **Délai par moyen de paiement**, si Chariow expose le moyen de paiement d'une vente : carte bancaire (risque de rétrofacturation) ou Mobile Money. | Carte : 45 jours, à confirmer selon la réponse de Chariow sur les rétrofacturations |
| 5 | Aucun remboursement ni litige enregistré sur le lot d'origine. | Obligatoire |
| 6 | L'offre n'est pas suspendue et ne fait pas l'objet d'un signalement en cours d'examen. | Obligatoire |
| 7 | Le contributeur et l'acheteur sont en règle : comptes non suspendus, email vérifié. | Obligatoire |
| 8 | **Aucun signal de collusion**, sinon retenue pour revue manuelle. Signaux : même appareil, même téléphone, IP proches dans une même fenêtre de temps, rafale de déverrouillages d'une même offre par des comptes récents. | Retenue automatique, levée par un modérateur ou un admin |

Mise en œuvre :
- une tâche horaire évalue les commissions en attente et calcule `available_at` ;
- les retenues sont tracées dans `commission_holds` (motif, levée par qui, quand) sans multiplier les statuts ;
- toute modification de ces paramètres est historisée.

Exemple de calendrier :

| Jour | Événement |
|---|---|
| J0 | Achat du pack. |
| J0 à J3 | Règlement Chariow. |
| J10 | Déverrouillage, commission `pending`. |
| **J24** | Commission `available` (contributeur établi). |

---

## 9. Conséquences techniques

| Domaine | Conséquence |
|---|---|
| Catalogue Chariow | 2 à 4 produits License (packs). Activation désactivée, durée illimitée, stock illimité. La clé de licence est ignorée par l'application et conservée comme justificatif. |
| Expérience d'achat | Le checkout exige téléphone et indicatif pays : on les demande au moment de l'achat. L'acheteur peut recevoir un email Chariow mentionnant une « clé de licence » : il faut l'expliquer dans la description du produit ou le personnaliser (point G5). |
| Moteur de crédits | Nouveau module `credits`. Verrouillage du compte de crédits (`SELECT … FOR UPDATE`) et clé d'idempotence par demande de consommation, pour qu'un double clic ou deux onglets ne consomment jamais deux fois. |
| Grand livre | Modules `ledger` (partie double), `credits` et `commissions`. Triggers d'ajout seul. Contrôles quotidiens d'équilibre et de réconciliation avec Chariow (`GET /v1/sales?from=&to=`). |
| Paiements | Pulses `successful.sale`, `failed.sale` et `abandoned.sale`. Revérification systématique par l'API. Alerte en cas de Pulse désactivée. |
| Remboursements | Aucun événement Chariow : saisie administrative avec preuve. Seuls les crédits non consommés sont recrédités ou annulés. Les commissions concernées sont annulées par écriture compensatoire. |
| Administration | Nouveaux écrans : packs et prix, coût en crédits des services, ajustements de crédits (motif obligatoire), retenues de commissions, remboursements, retraits avec double validation, réconciliation. |
| Tests | Ajout des scénarios 29 à 36 au cahier (§22) : rachat, FIFO, solde insuffisant, concurrence, crédits gratuits, délai de sécurité, conditions du statut `paid`, équilibre du grand livre. |
| Planning | La phase 3 s'alourdit (moteur de crédits et grand livre). La phase 4 en dépend pour les exports payés en crédits, ce qui respecte l'ordre prévu. L'étape A du §4.4 peut être menée **pendant la phase 1**, sans la retarder. |

---

## 10. Conséquences financières

| Sujet | Conséquence | Mesure ou décision |
|---|---|---|
| Premier achat | Des packs d'entrée de 2 USD (20 crédits) et 5 USD (50 crédits) sont ajoutés (A4, validé). | Aucune action. |
| Gains des contributeurs | 0,15 USD par déverrouillage standard. Le seuil de 10 USD est atteint en 67 déverrouillages. | Aucune action. |
| Marge plateforme | Elle supporte seule les frais Chariow : 15 % de chaque recharge, puis 10 %. Sur une recharge entièrement consommée en déverrouillages, la plateforme garde 70 % − 15 % = **55 %** (60 % au palier de 10 %). | Assumé par la décision du propriétaire. |
| Trésorerie | Les crédits sont encaissés **avant** d'être consommés. La trésorerie est positive, mais les crédits non consommés sont une **dette** et non un chiffre d'affaires. | Suivi dans `customer_credits`. Tableau de bord administrateur dédié. |
| Expiration des crédits | Sans expiration, la dette demeure indéfiniment. Avec expiration, les crédits expirés deviennent du revenu (`revenue_breakage`), sans commission, mais la règle doit être légale et annoncée. | Décision N3 : je recommande **aucune expiration au lancement**, à revoir avec un juriste. |
| Frais Chariow | 15 % puis 10 % au-delà de 5 000 USD cumulés. Ils sont passés en charge `payment_processing_fees` à chaque recharge, avec le montant réel de chaque vente. | Traitement comptable à confirmer par l'expert-comptable (N7). |
| Conversion de devise | Payer en XOF, CDF ou une autre devise entraîne une majoration de conversion. On ignore qui la supporte. | Le grand livre reste en USD. Le montant et la devise payés sont enregistrés. À vérifier à l'étape A. |
| Remboursements | Chariow conserve peut-être ses frais lors d'un remboursement. Cette perte serait pour la plateforme. | Politique proposée : **seuls les crédits non consommés sont remboursables**, dans un délai fixé par les CGV (décision N3). |
| Annulation après paiement | Une commission annulée alors qu'elle a déjà été versée devient une créance sur le contributeur, déduite de ses gains futurs. | Décision N6. Pas de recouvrement forcé sous un seuil. |
| Coût des retraits | Les frais Mobile Money ou bancaires pour payer les contributeurs ne sont pas encore attribués. | Décision N5 : déduits du montant retiré, ou pris en charge par la plateforme. |
| Fiscalité | La TVA sur les services numériques s'applique dans plusieurs pays (Nigeria, Kenya, Afrique du Sud, etc.). Le référentiel comptable dépend du pays de l'entité. | Décision N7 : expert-comptable et juriste. |

**Simulation indicative.** Hypothèses :
- 100 recharges de 10 USD ;
- frais Chariow de 15 % ;
- 70 % des crédits consommés, dont 60 % pour des déverrouillages et 40 % pour des documents.

| Poste | Montant (USD) |
|---|---|
| Recharges encaissées | 1 000,00, soit 10 000 crédits attribués |
| Frais Chariow (charge plateforme) | 150,00 |
| Trésorerie nette reçue | 850,00 |
| Crédits consommés | 7 000 crédits, soit 700,00 de chiffre d'affaires |
| … dont déverrouillages | 4 200 crédits, soit 420,00 |
| … dont documents | 2 800 crédits, soit 280,00 |
| Commissions contributeurs (30 % de 420,00) | **126,00** |
| Résultat plateforme (700,00 − 126,00 − 150,00) | **424,00** |
| Dette sur les crédits non consommés (3 000 crédits) | 300,00 |

Contrôle : 850,00 de trésorerie = 300,00 de dette envers les utilisateurs + 126,00 de commissions dues + 424,00 de résultat.

---

## 11. Faisabilité de la stack (inchangée)

La stack Next.js + NestJS + PostgreSQL + Prisma + Tailwind est faisable et adaptée.

PostgreSQL apporte ce que le modèle de crédits exige :
- transactions atomiques et verrous de ligne ;
- type `NUMERIC` ;
- triggers d'ajout seul ;
- contraintes uniques pour l'idempotence.

Les tâches planifiées (activation, expiration, maturation des commissions, réconciliation) tournent dans un worker BullMQ.

---

## 12. Architecture cible

### 12.1 Monorepo (pnpm workspaces et Turborepo)

```
opportinities/
├─ apps/
│  ├─ web/                 Next.js 16 : partie publique, tableau de bord, administration
│  └─ api/                 NestJS 12 : API REST /v1 (main.ts) et worker BullMQ (worker.ts)
│     ├─ src/modules/      auth, users, locations, jobs, moderation, catalog, payments,
│     │                    credits, ledger, unlocks, commissions, wallet, withdrawals,
│     │                    studio, ai, files, notifications, mail, admin, audit, settings
│     └─ prisma/           schema.prisma, migrations/, seed/
├─ packages/
│  ├─ shared/              enums, constantes, pays (source unique), types communs
│  ├─ i18n/                catalogues fr/en (interface et emails)
│  ├─ api-client/          client TypeScript généré depuis l'OpenAPI
│  └─ config/              tsconfig, ESLint, Prettier
├─ infrastructure/         docker/, compose/, nginx/
└─ docs/                   cahier des charges, rapports de phase, ADR, runbooks
```

### 12.2 Routage

```
Navigateur ──HTTPS──> Cloudflare ──> Nginx ─┬─ /                       -> web (Next.js)
                                            ├─ /api/v1/*               -> api (NestJS)
                                            └─ /api/webhooks/chariow   -> api
api et worker ──> PostgreSQL 17 · Redis 7 · Stockage S3 privé · Brevo · OpenAI · Chariow
```

L'interface et l'API partagent la même origine : cookies limités à l'hôte, pas de CORS, protection CSRF plus simple.

### 12.3 Socle (inchangé depuis la version 1.0)

- Sessions serveur opaques dans un cookie `__Host-` (`HttpOnly`, `Secure`, `SameSite=Lax`), révocables.
- Mots de passe hachés en Argon2id.
- Protection CSRF par jeton double-submit et vérification de l'en-tête `Origin`.
- Rate limiting à deux niveaux : Nginx et Redis.
- Rôles et permissions stockés en base, vérifiés par des guards NestJS.
- TOTP pour les administrateurs.
- Traductions avec next-intl et des routes `/fr` et `/en`. L'API renvoie des codes d'erreur que l'interface traduit.
- Thème clair, sombre ou système, sans flash au chargement grâce à un script inline.
- IBM Plex Sans servie par `next/font`.
- Stockage S3 privé avec URLs signées de 60 secondes, scan ClamAV des fichiers, filigrane sur les PDF.
- PDF générés par Playwright/Chromium dans le worker.
- Interface `AiProvider`, avec OpenAI comme première implémentation.
- Recherche PostgreSQL full-text et `pg_trgm`.
- Journaux d'audit en ajout seul.

### 12.4 Flux d'achat de crédits

1. `POST /v1/credit-orders` : le backend vérifie que le pack est actif et que son prix correspond à `GET /v1/products/{id}` (avec un cache court). Il crée la commande avec un snapshot du prix.
2. Le backend appelle `POST /v1/checkout` (`custom_metadata.order_ref`), puis redirige vers `checkout_url`.
3. Pulse `successful.sale` : vérification de la signature sur le corps brut, déduplication sur `x-pulse-delivery-id`, réponse 200 immédiate, puis mise en file d'attente.
4. Le worker appelle `GET /v1/sales/{id}` et contrôle le statut, le produit, le montant, la devise et la référence.
5. Une seule transaction enregistre : paiement `confirmed`, lot de crédits, mouvement `purchase`, écritures du grand livre et notification.
6. La page de retour du navigateur affiche seulement « paiement en cours de vérification ». **Elle ne crédite jamais rien.**

### 12.5 Flux de consommation

`POST /v1/unlocks` ou `POST /v1/document-exports`, avec un en-tête `Idempotency-Key`. Tout se fait dans une seule transaction :

1. Verrouiller le compte de crédits de l'utilisateur.
2. Vérifier l'éligibilité :
   - l'offre est active ;
   - elle n'a pas déjà été déverrouillée par cet utilisateur (unicité utilisateur + offre) ;
   - le solde est suffisant.
3. Consommer les crédits en FIFO avec les affectations aux lots.
4. Créer le déverrouillage ou l'export.
5. Passer les écritures du grand livre.
6. Créer la commission `pending` si le déverrouillage est éligible :
   - le consommateur n'est pas le contributeur ;
   - le lot consommé est éligible aux commissions (voir l'arbitrage A2 sur les crédits gratuits) ;
   - l'offre est active.

---

## 13. Schéma de données (mis à jour)

Conventions inchangées :
- clés primaires UUID v7 ;
- dates en `timestamptz` ;
- montants en `NUMERIC(20,6)` ;
- aucune suppression en cascade sur les données financières.

Les tables d'identité, de localisation, d'offres, du Career Studio, d'IA, de notifications et d'audit restent celles de la version 1.0, rappelées en fin de section.

### Catalogue et paiements
| Table | Champs clés / contraintes |
|---|---|
| `credit_packs` | sku (unique), credits, price_usd, chariow_product_id, is_active, version, valid_from. Le taux de conversion est lu dans `financial_settings`. |
| `service_credit_costs` | service (`unlock_standard`, `unlock_premium`, `doc_cv`, `doc_cover_letter`, `doc_application_letter`, `doc_pack`, …), credits, valid_from, changed_by. **Historisé.** |
| `credit_orders` | reference (unique), user_id, pack_id, snapshot du prix, status (`pending`, `paid`, `failed`, `abandoned`, `refunded`, `cancelled`) |
| `payments` | order_id, provider, provider_sale_id (unique avec provider), amount_paid, currency_paid, amount_usd, service_fee, payment_fee, net_usd, settlement_due_at, settlement_done_at, gateway?, status, raw_snapshot |
| `payment_events` | provider, delivery_id (unique avec provider), event_type, signature_valid, payload, processed_at, error. **Ajout uniquement.** |
| `refunds` | payment_id, credits_refunded, amount_usd, fee_retained_usd, proof_file_id, recorded_by, reason |

### Crédits
| Table | Champs clés / contraintes |
|---|---|
| `credit_accounts` | user_id (unique), balance_cache. **Ligne verrouillée à chaque consommation.** |
| `credit_lots` | account_id, origin (`purchase`, `grant`, `adjustment`), payment_id? (**unique**), credits_total, credits_remaining, credit_unit_value_usd (figée à l'attribution), commissionable, purchased_at, expires_at?. `CHECK credits_remaining >= 0` |
| `credit_movements` | account_id, type (`purchase`, `consume`, `refund`, `expire`, `grant`, `adjust`), quantity (signé), reference (unlock, export, refund…), idempotency_key (unique), actor_id?, reason?. **Ajout uniquement.** |
| `credit_lot_allocations` | movement_id, lot_id, credits, value_usd. **Ajout uniquement.** |

### Déverrouillages et exports
| Table | Champs clés / contraintes |
|---|---|
| `job_unlocks` | user_id, job_offer_id, **unique (user_id, job_offer_id)**, tier, movement_id, credits, internal_value_usd, unlocked_at |
| `document_exports` | document_id, movement_id, storage_key, sha256 |

### Grand livre
| Table | Champs clés / contraintes |
|---|---|
| `ledger_accounts` | code (unique), type (`asset`, `liability`, `revenue`, `expense`), owner_user_id? |
| `ledger_transactions` | type, reference_type, reference_id, idempotency_key (unique), reverses_transaction_id?, actor_id?, reason?, occurred_at |
| `ledger_entries` | transaction_id, account_id, debit, credit (une seule des deux colonnes renseignée et positive). Équilibre vérifié par trigger différé. **Ajout uniquement.** |
| `financial_settings` | key, value, effective_from, changed_by. **Versionné.** Contient : taux de commission, délais de retenue, seuil de retrait, seuil de double validation. |

### Commissions, portefeuilles et retraits
| Table | Champs clés / contraintes |
|---|---|
| `commissions` | unlock_id (**unique**), contributor_id, job_offer_id, base_internal_value_usd, rate, amount_usd, settings_version, status (`pending`, `available`, `paid`, `reversed`), available_at, reversed_at, reversal_transaction_id? |
| `commission_holds` | commission_id, reason, created_by (système ou utilisateur), released_by?, released_at? |
| `wallets` | user_id (unique), soldes en cache (pending, available, reserved, recoverable, total_earned, total_withdrawn), réconciliés chaque jour avec le grand livre |
| `withdrawal_methods` | user_id, type, country_id, details_enc (chiffré), is_verified |
| `withdrawal_requests` | user_id, method_id, amount_usd, status (6 valeurs), approved_by, paid_marked_by, payout_reference, proof_file_id, paid_at. `CHECK` : `paid` exige la référence, la preuve et la date. |
| `withdrawal_commission_allocations` | withdrawal_id, commission_id, amount_usd |
| `withdrawal_events` | Historique des statuts. **Ajout uniquement.** |

### Rappel des autres tables (version 1.0)
- Identité : `users`, `user_profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions`, `verification_tokens`.
- Localisation : `countries`, `cities`.
- Offres : `job_categories`, `job_offers` (avec `work_mode`), `job_offer_files`, `job_offer_status_history`, `job_offer_revisions`, `job_offer_reports`, `saved_jobs`, `saved_searches`, `file_download_logs`.
- Career Studio et IA : `document_templates`, `career_documents`, `career_document_versions`, `ai_prompt_versions`, `ai_generations`.
- Communication et audit : `notifications`, `email_outbox`, `audit_logs`, `security_events`, `translation_overrides`.

---

## 14. Risques (mis à jour)

| Risque | Gravité | Mesure |
|---|---|---|
| Le rachat d'un produit License n'est pas confirmé en conditions réelles | **Élevée** | Protocole du §4.4 avant la phase 3, avec une alternative prête. |
| Pas de sandbox Chariow | Élevée | Tests avec payloads signés enregistrés, puis recette réelle à prix minimal. |
| Remboursements et rétrofacturations non détectables automatiquement | Moyenne | Saisie administrative, réconciliation, délai de sécurité. |
| Collusion entre comptes pour générer des commissions | Moyenne | Pas de commission sur ses propres achats, signaux de collusion, retenues, revue des retraits. |
| Pulse désactivée après 5 échecs | Moyenne | Alerte et réconciliation horaire par `GET /v1/sales`. |
| Commission par déverrouillage faible, programme peu attractif | Moyenne (commerciale) | Grille de packs et seuil de retrait ajustables. |
| Protection des données dans 54 pays, droits sur les PDF partagés | Moyenne | Revue juridique (D13). |
| Consommation mémoire de Chromium et ClamAV | Faible | Worker séparé, VPS de 8 Go de RAM. |

---

## 15. Infrastructure (inchangée)

- VPS de **4 vCPU, 8 Go de RAM et 160 Go SSD** en Europe (Hetzner, OVH ou Scaleway), avec Docker Compose.
- PostgreSQL 17 sauvegardé vers un stockage objet externe, avec un test de restauration mensuel.
- Redis 7.
- Stockage S3 privé.
- Cloudflare en façade.
- Brevo avec un domaine authentifié (SPF, DKIM, DMARC).
- Sentry et une surveillance de disponibilité.

Coût indicatif : **30 à 60 USD par mois**, hors OpenAI et frais Chariow.

---

## 16. Roadmap (mise à jour)

| Phase | Contenu |
|---|---|
| **Parallèle à la phase 1** | Étape A du §4.4 (propriétaire) et questions écrites au support Chariow. |
| **1 — Fondations** | 1a : Git, monorepo, Docker Compose, CI. 1b : PostgreSQL, Prisma, pays et villes. 1c : authentification, sessions, RBAC, TOTP admin. 1d : FR/EN, thèmes, design system. 1e : squelettes des tableaux de bord et journaux d'audit. |
| **2 — Offres** | Publication, fichiers, modération, doublons, historique, programmation, expiration, archives, recherche. |
| **Point de décision** | Go ou no-go sur Chariow License (critères G1 et G2), à partir des résultats des étapes A et B. |
| **3 — Monétisation** | Packs, checkout, Pulses, réconciliation, crédits FIFO, grand livre, déverrouillages, commissions et retenues, portefeuilles, retraits avec double validation, anti-fraude. |
| **4 — Career Studio** | Formulaires, modèles, IA, aperçu, exports payés en crédits, PDF. |
| **5 — Finalisation** | Emails, notifications, SEO, sécurité, performances, traductions administrables, documentation, mise en production. |

Chaque phase se termine par le rapport en 12 points de `CLAUDE.md` §21 et attend votre validation.

---

## 17. Décisions à valider

### Nouvelles décisions issues de D2 à D5
| # | Décision | Ma recommandation |
|---|---|---|
| **N1** | Approuver le protocole de validation Chariow (§4.4). Vous menez l'étape A ; j'exécute l'étape B au début de la phase 3, ou plus tôt. | Oui. Étape A pendant la phase 1. |
| ~~N2~~ | Remplacée par le modèle économique définitif et les arbitrages A1 à A5 de `docs/CORRECTION_MODELE_ECONOMIQUE.md`. | — |
| ~~N3~~ | **Décidée (A5)** : pas d'expiration au lancement, remboursement des seuls crédits non consommés sous 14 jours. Validation juridique avant la mise en production. | — |
| **N4** | Valeurs par défaut du délai de sécurité. | 14 jours (contributeur établi), 30 jours (nouveau contributeur), 45 jours (carte, si Chariow le confirme), et règlement Chariow obligatoire. |
| **N5** | Seuil de double validation des retraits, et prise en charge des frais de versement. | Double validation à partir de 50 USD. Frais de versement déduits du montant retiré et affichés avant confirmation. |
| **N6** | Recouvrement d'une commission annulée après paiement. | Déduction sur les gains futurs. Suspension des retraits si la créance dépasse 5 USD. |
| **N7** | Pays de l'entité juridique, expert-comptable (plan de comptes, TVA numérique) et juriste. | À lancer avant la phase 3. |

### Décisions toujours ouvertes (version 1.0)
| # | Décision | Ma recommandation |
|---|---|---|
| D6 | Couverture des villes | GeoNames, villes de plus de 5 000 habitants, plus ajout par l'administration. |
| D7 | 2FA TOTP | Obligatoire pour admin et super_admin. |
| D8 | Hébergement | VPS Europe et Cloudflare. |
| D9 | Hébergement du code | GitHub privé. |
| D10 | Domaine et adresse d'expédition | À fournir avant la phase 1c. |
| D11 | Questions au support Chariow | Intégrées à l'étape A (§4.3). |
| D12 | Renommer `CAHIER_DE_CHARGFE.md` en `CAHIER_DES_CHARGES.md` | Oui. |
| D13 | Revue juridique | En parallèle de la phase 2. |

---

## 18. Prérequis sur votre poste avant la phase 1

1. Installer Node.js 24 LTS.
2. Démarrer Docker Desktop (moteur WSL 2).

---

## 19. Recommandation

1. Valider les conséquences présentées aux §9 et §10 et les décisions **N1 à N7**.
2. Lancer l'étape A Chariow de votre côté.
3. M'autoriser à démarrer la **phase 1a** (Git, monorepo, Docker Compose, CI).

La validation Chariow se déroule en parallèle. Aucune logique de paiement ne sera écrite avant le point de décision prévu après la phase 2.

### Sources
- [Documentation développeur Chariow](https://chariow.dev) et [index llms.txt](https://chariow.dev/llms.txt)
- [Guide Checkout](https://chariow.dev/en/guides/checkout.md) et [Initiate Checkout](https://chariow.dev/api-reference/checkout/init-checkout.md)
- [Guide Licenses](https://chariow.dev/en/guides/licenses.md) et [SaaS License Integration](https://chariow.dev/en/guides/saas-license-integration.md)
- [Guide Products](https://chariow.dev/en/guides/products.md) et [Guide Sales](https://chariow.dev/en/guides/sales.md)
- [Guide Pulses](https://chariow.dev/en/guides/pulses.md) et [Pulse Security](https://chariow.dev/en/guides/pulse-security.md)
- [Aide Chariow : frais](https://help.chariow.com/en/articles/64-what-are-the-fees-on-chariow)
- [Aide Chariow : délai de versement des gains](https://help.chariow.com/en/articles/91-how-long-does-it-take-to-receive-my-winnings)
- [Aide Chariow : pays et moyens de paiement](https://help.chariow.com/en/articles/68-in-which-countries-can-you-sell-with-chariow)
- [Aide Chariow : moyens de retrait](https://help.chariow.com/en/articles/73-what-withdrawal-methods-are-available-on-chariow)
- [Chariow : suppression des frais de retrait opérateur](https://roadmap.chariow.com/en/changelogs/excellente-nouvelle-chariow-supprime-les-frais-de-retrait-operateur)
