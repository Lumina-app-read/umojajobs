# OPPORTINITIES — Rapport de correction du modèle économique

- Date : 9 novembre 2026
- Portée : modèle économique uniquement. Aucun code, aucune dépendance, aucune nouvelle phase.

## 1. Documents modifiés

| Document | Modifications |
|---|---|
| `docs/CAHIER_DE_CHARGFE.md` (passe en **v1.2**) | Historique des versions. §8.3 réécrit (séparation Chariow / portefeuille, conversion, packs, frais, parcours de recharge, utilisation des crédits). §9.1 (calcul de la commission). §10 (colonnes de l'historique). §11.8 (coûts des documents en crédits). §12 (rôle de Chariow). §14 (paramètres administrables). §22 (tests 30 et 37 à 39). §25-H. |
| `CLAUDE.md` §10 | Le « partage du revenu net distribuable » et la mention « frais pris en compte selon les règles configurées » contredisaient la décision. Ils sont remplacés par le modèle définitif. |
| `docs/PHASE_0_AUDIT.md` (passe en **v2.1**) | §5 (principes et exemples). §6 (plan de comptes et écritures). §10 (conséquences et simulation). §12.5 et §13 (champs des tables). Décision N2 remplacée. |

## 2. Modèle corrigé

### 2.1 Qui fait quoi

| Chariow (prestataire de paiement) | OPPORTINITIES (portefeuille interne) |
|---|---|
| Encaisser les recharges de crédits (produits License : 10, 20, 50, 100 USD) | Attribuer et conserver les crédits |
| Notifier le paiement (Pulse) | Déverrouillages, packs d'offres, exports de documents |
| Verser les fonds sur le portefeuille Chariow de la plateforme | Débit des crédits, commissions, soldes, retraits, grand livre |

Après la recharge, **aucune autre opération ne fait appel à Chariow**.

### 2.2 Règles

- **Valeur interne d'un crédit** configurable (référence : 0,10 USD). Elle est figée sur chaque lot à l'attribution.
- **Crédits attribués = crédits du pack**, quels que soient les frais Chariow. Exemple : 10 USD donnent toujours 100 crédits.
- **Frais Chariow** : charge de paiement de la plateforme. Ils sont exclus du calcul des crédits et des commissions.
- **Commission** = 30 % × crédits consommés × valeur interne, pour un déverrouillage éligible. Les règles d'éligibilité et le délai de sécurité D5 sont inchangés : une commission devient disponible seulement après le règlement Chariow de la recharge d'origine et la fin du délai de retenue.
- Les exports de documents ne génèrent aucune commission.

### 2.3 Calculs de référence (1 crédit = 0,10 USD)

| Opération | Crédits | Valeur | Commission | Part plateforme |
|---|---|---|---|---|
| Déverrouillage standard | 5 | 0,50 | 0,15 | 0,35 |
| Déverrouillage premium | 10 | 1,00 | 0,30 | 0,70 |
| CV PDF | 15 | 1,50 | 0 | 1,50 |
| Lettre de motivation / demande d'emploi | 10 | 1,00 | 0 | 1,00 |
| Pack documentaire | 25 | 2,50 | 0 | 2,50 |

Les frais Chariow sont de 15 %, puis 10 % au-delà de 5 000 USD cumulés. Sur une recharge entièrement consommée en déverrouillages, la plateforme conserve donc **55 %** de la valeur au palier de 15 % (**60 %** au palier de 10 %), et le contributeur 30 %.

Il faut **67 déverrouillages standard** pour atteindre le seuil de retrait de 10 USD.

**Simulation.** Hypothèses : 100 recharges de 10 USD, frais de 15 %, 70 % des crédits consommés, dont 60 % pour des déverrouillages et 40 % pour des documents.

| Poste | USD |
|---|---|
| Recharges encaissées (10 000 crédits) | 1 000,00 |
| Frais Chariow (charge plateforme) | 150,00 |
| Trésorerie nette | 850,00 |
| Chiffre d'affaires reconnu (7 000 crédits consommés) | 700,00 |
| Commissions (30 % de 420,00 de déverrouillages) | 126,00 |
| **Résultat plateforme** (700 − 126 − 150) | **424,00** |
| Dette sur les crédits non consommés (3 000 crédits) | 300,00 |

Contrôle : 850 = 300 + 126 + 424.

## 3. Parcours de recharge et attribution unique des crédits

1. **Commande.** `POST /v1/credit-orders` crée une commande `pending` avec une référence unique et un snapshot du montant, des crédits, de la valeur interne et du produit Chariow. Le backend vérifie que le prix du pack correspond au produit Chariow.
2. **Paiement.** Le backend appelle `POST /v1/checkout` avec `custom_metadata.order_ref`, puis redirige vers la page Chariow. Le retour du navigateur affiche seulement « vérification en cours » et interroge le statut de la commande. **Il n'attribue jamais de crédits.**
3. **Notification.** La Pulse `successful.sale` arrive. Le backend :
   - vérifie la signature HMAC sur le corps brut ;
   - insère l'événement dans `payment_events` (unicité provider + `x-pulse-delivery-id`) ;
   - répond 200 ;
   - met le traitement en file d'attente.
4. **Confirmation serveur.** Le worker appelle `GET /v1/sales/{id}` et vérifie que :
   - la vente est payée (`completed` ou `settled`) ;
   - le produit est celui du pack ;
   - le montant et la devise correspondent au snapshot ;
   - la référence de commande appartient bien à cette commande.

   En cas d'écart, la commande passe en `anomaly`, aucun crédit n'est attribué et une alerte est envoyée à l'administration.
5. **Attribution.** Une seule transaction PostgreSQL :
   - fait passer la commande de `pending` à `paid` (mise à jour conditionnelle) ;
   - crée le paiement ;
   - crée le lot de crédits ;
   - enregistre le mouvement `purchase` ;
   - passe les écritures comptables.

   Une notification interne est ensuite envoyée à l'utilisateur.

Les crédits sont attribués dès la confirmation du paiement, sans attendre le règlement Chariow. Le règlement ne conditionne que la disponibilité des commissions (D5).

**Les crédits ne peuvent être attribués qu'une fois.** Chaque niveau est protégé par une contrainte d'unicité en base, et non par une simple vérification dans le code :

| Situation | Protection |
|---|---|
| Même notification livrée plusieurs fois (tentatives Chariow) | Unicité de `payment_events (provider, delivery_id)`. Le doublon est ignoré. |
| Plusieurs notifications pour la même vente, rejeu manuel (nouvel identifiant de livraison) | Unicité de `payments (provider, provider_sale_id)`. Le second traitement ne fait rien. |
| Notification et réconciliation planifiée en parallèle | Mise à jour conditionnelle `pending -> paid` sur la commande, unicité de `credit_lots.payment_id`, `credit_movements.idempotency_key = purchase:{sale_id}` et `ledger_transactions.idempotency_key`. Une seule transaction aboutit ; l'autre échoue sur la contrainte et est classée « déjà traitée ». |
| Vente rouverte par Chariow (`failed` -> `awaiting_payment` -> `completed`) | Le statut est relu par l'API au moment du traitement. Les mêmes clés d'unicité s'appliquent. |

Les tests correspondants sont ajoutés au cahier (n° 14, 37, 38 et 39).

## 4. Implications comptables

Les écritures sont détaillées dans le rapport d'audit, §6.3.

| Élément | Traitement |
|---|---|
| **Recharge** | Une dette envers l'utilisateur (`customer_credits`) est constatée pour la valeur interne totale des crédits (10,00 USD). Les frais Chariow (1,50 USD) sont passés en charge `payment_processing_fees`. La créance sur Chariow vaut le montant net (8,50 USD). |
| **Crédits non consommés** | Ils restent une **dette** : ils ne sont pas du chiffre d'affaires et ne génèrent pas de commission. Ils apparaissent au tableau de bord administrateur (encours de crédits). |
| **Crédits consommés** | La dette diminue et un chiffre d'affaires est reconnu : `revenue_unlocks` ou `revenue_documents`, pour la valeur interne. |
| **Commissions** | Une charge `contributor_commissions` est passée face à une dette envers le contributeur (en attente, puis disponible, puis réservée). Elle est soldée par le retrait **payé**. Une annulation passe par une écriture compensatoire. |
| **Frais Chariow** | Ils sont passés en charge à la recharge, y compris pour les crédits pas encore consommés. **L'expert-comptable doit confirmer** ce choix ou demander un étalement (décision N7 déjà ouverte). |
| **Remboursement de crédits non utilisés** | La dette diminue de la valeur interne restante, contre une sortie de trésorerie. Les frais Chariow non restitués restent une charge de la plateforme. |

## 5. Arbitrages

> **Validés par le propriétaire le 9 novembre 2026.** Les recommandations ci-dessous sont retenues telles quelles et intégrées au cahier des charges v1.2 (§8.3.2, §8.3.3, §8.3.6 et §8.3.7).

| # | Question | Décision retenue |
|---|---|---|
| **A1** | Si l'administration change le taux de conversion, quelle valeur appliquer aux crédits déjà détenus : celle du lot ou le nouveau taux ? | **Valeur figée par lot.** La dette et les commissions restent exactes, et le changement ne s'applique qu'aux nouvelles recharges. |
| **A2** | Crédits gratuits (promotions, gestes commerciaux) et éventuels bonus dans les packs (par exemple 50 USD = 550 crédits) : génèrent-ils une commission ? | **Non.** Ces lots sont marqués non commissionnables, sinon la plateforme paierait des commissions sur des sommes non encaissées. Pas de bonus de pack au lancement. |
| **A3** | Coûts en crédits des services et contenu des **packs d'offres**. | Coûts : déverrouillage 5 ou 10 crédits, CV 15, lettres 10, pack documentaire 25. Packs d'offres : par exemple 5 déverrouillages standard pour 20 crédits. La commission est versée à chaque utilisation, sur la valeur réellement payée par déverrouillage (20 ÷ 5 = 4 crédits, soit 0,12 USD de commission). |
| **A4** | La recharge minimale de 10 USD est-elle acceptable pour un premier achat ? | Ajouter des packs de 2 USD (20 crédits) et 5 USD (50 crédits). D'après la documentation, les frais Chariow sont proportionnels : un petit pack ne coûte pas plus cher en pourcentage. |
| **A5** | Expiration et remboursement des crédits non consommés (ancienne décision N3). | Pas d'expiration au lancement. Remboursement des seuls crédits non consommés, dans les 14 jours suivant la recharge. Validation juridique nécessaire. |

Les autres décisions déjà ouvertes (N1, N4 à N7, D6 à D13) ne sont pas modifiées par cette correction.

La validation technique du rachat des produits License (étape A) reste un prérequis avant la phase 3.
