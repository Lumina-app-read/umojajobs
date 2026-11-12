# Phase 3 — Rapport de clôture : monétisation

Date : 12 novembre 2026. Commits `2f4440a` à `c3bd4b6`, puis renommage en Umoja Jobs (`81f5c72`, `1fb188e`, `d32b348`).

1. **Objectif** : permettre l'achat de crédits par Chariow, le déverrouillage des offres en crédits, la rémunération des contributeurs et le retrait de leurs gains, avec une comptabilité exacte et vérifiable.

2. **Réalisé**
   - **Paramètres financiers** administrables et historisés (auteur, motif, avant/après) : valeur du crédit 0,10 USD, part contributeur 30 %, seuil de retrait 10 USD, retenue 14 jours (30 pour un nouveau contributeur de moins de 60 jours), double validation dès 50 USD. Coûts des services en crédits (déverrouillage 5, CV 15, lettres 10, pack 25).
   - **Crédits** par lots consommés du plus ancien au plus récent, valeur figée par lot ; registre en ajout seul.
   - **Grand livre** en partie double : équilibre et ajout seul garantis par la base.
   - **Dotations** gratuites par l'administration, jamais commissionnables, interdites sur son propre compte.
   - **Déverrouillage** une seule fois par offre, même sous clics simultanés.
     - Règlement des candidats présenté après le paiement.
     - Documents consultables dans le site uniquement, pages rendues avec la mention « Publiée par … sur Umoja Jobs », sans téléchargement.
   - **Commissions** de 30 % sur les crédits payés uniquement, en attente puis disponibles après règlement Chariow et délai de sécurité.
   - **Mes revenus** (aperçu, commissions, retraits).
     - Retraits par Mobile Money ou virement, coordonnées chiffrées.
     - Montant réservé dès la demande.
     - Traitement manuel : examen, approbation, versement avec référence, refus motivé.
     - Deux administrateurs distincts dès 50 USD.
   - **Recharges Chariow** (produits License).
     - Commande au prix figé et paiement ouvert par l'API.
     - Notifications Pulse signées et dédoublonnées.
     - Vente toujours relue chez Chariow avant tout crédit ; tout écart (produit, montant, devise) place la commande en anomalie.
     - Vérification immédiate pendant que la page de retour attend, et réconciliation toutes les 5 minutes.
     - Règlement Chariow (frais, net) comptabilisé.
   - **Administration** : « Tarifs et paramètres » (paramètres, coûts, packs, dotations), file des retraits.
   - **Discrétion des revenus** : rien de financier sur le tableau de bord ; la page d'accueil présente le partage d'offres comme une aide aux candidats.

3. **Fichiers créés** (principaux)
   - API :
     - modules `finance` (paramètres, crédits, grand livre) ;
     - `unlocks` (déverrouillages, commissions, portefeuille) ;
     - `withdrawals` ;
     - `payments` (client Chariow, recharges, Pulses, réconciliation, planificateur) ;
     - `documents` (rendu des PDF) ;
     - 5 suites d'intégration (`finance`, `unlocks`, `withdrawals`, `payments`) et leurs aides de test.
   - Web :
     - pages « Mes crédits », « Déverrouillées » et « Mes revenus » (aperçu, commissions, retraits) ;
     - administration « Tarifs et paramètres » et « Retraits » ;
     - composants de déverrouillage, règlement des candidats, visionneuse, packs et retraits.

4. **Fichiers modifiés** : schéma Prisma, contrats partagés (`finance.ts`, `errors.ts`, `auth.ts`), catalogues FR/EN, navigation, fiche d'offre, formulaire de publication (lien ou email obligatoire, téléphone, conseils du contributeur), configuration (variables Chariow, corps brut des requêtes).

5. **Migrations** (appliquées en local, sans perte de données) : `20261111140000_add_credits_ledger`, `20261111141000_add_finance_events`, `20261111143000_fix_ledger_balance_trigger`, `20261111160000_add_unlocks_commissions`, `20261111180000_add_application_phone_tips_candidate_terms`, `20261112100000_add_withdrawals`, `20261112140000_add_credit_purchases`.

6. **Dépendances** : `pdfjs-dist` 6.4.299 et `@napi-rs/canvas` 1.0.12 (rendu des pages de documents côté serveur).

7. **Tests exécutés** : API unitaires, API intégration (PostgreSQL, Redis, stockage et faux serveur Chariow réels), web, traductions, lint, types. Essais réels : deux achats Chariow de 1 USD avec le même compte.

8. **Résultats** : API unitaires 133/133, intégration 105/105, web 67/67, traductions 5/5. Achats réels : rachat accepté par Chariow (critère G1 validé), 20 crédits attribués sans doublon, grand livre équilibré.

9. **Problèmes rencontrés**
   - La documentation Chariow diffère du réel : identifiant de vente `SALE…` au lieu de `sal_…` ; frais retenus supérieurs aux frais affichés (net 0,85 et frais 0,07 sur 1,00). Corrigé.
   - Un déclencheur comptable a nécessité une migration corrective.
   - Un serveur de développement en double a interrompu l'API locale.
   - Un commit a inclus par erreur des fichiers de logo du propriétaire (sans perte).

10. **Risques**
    - Coût réel de Chariow : environ 15 % sur 1 USD. Les packs de faible montant réduisent la marge.
    - Format des notifications Pulse jamais observé : la Pulse sera à créer et à vérifier à la mise en ligne (la relecture des ventes couvre son absence).
    - Remboursements et rétrofacturations non signalés automatiquement par Chariow : procédure administrative à définir.
    - Plan comptable (crédits offerts en charge commerciale, frais) à faire valider par un expert-comptable (N7).
    - Offres « premium » non définies : tout déverrouillage est au tarif standard.
    - Documents du contributeur et de la modération encore téléchargeables (choix à confirmer).

11. **Décisions nécessaires**
    - Valider la clôture de la phase 3.
    - Fixer les packs définitifs (prix et crédits) dans l'administration et dans Chariow.
    - Renommer la boutique Chariow « Safetrade v2 » et ses produits au nom Umoja Jobs.
    - Politique de remboursement des crédits non utilisés (A5) et validation juridique.
    - Lancer la **phase 4 — Career Studio**.

12. **Recommandation** : commencer la phase 4 par les formulaires et les modèles de documents (CV, lettre de motivation), avec un aperçu gratuit, avant l'IA et l'export PDF payé en crédits, qui réutilisera le registre et les coûts déjà en place.
