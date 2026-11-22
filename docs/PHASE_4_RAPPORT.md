# Phase 4 — Rapport de clôture : Career Studio

Date : 22 novembre 2026. Commits `42fcd2d` à `199a77d`. Détails des étapes 4f : `docs/ETAPE_4F1_RAPPORT.md` et `docs/ETAPE_4F_RAPPORT.md`.

1. **Objectif** : permettre à l'utilisateur de créer ses documents de candidature, avec une IA qui n'invente rien, un aperçu gratuit et un export PDF payé en crédits.

2. **Fonctionnalités réalisées**
   - **4a à 4c, CV** : éditeur avec aperçu en direct, enregistrement automatique, reformulation par l'IA, six modèles.
   - **4d, export PDF** : payé en crédits, ré-exports gratuits pendant 7 jours (réglable), jamais de second paiement après un échec technique.
   - **4e, lettres** : sept types de lettres, deux modèles.
   - **4f, génération par l'IA** : questionnaires guidés, génération payée en crédits et remboursée en cas d'échec, photo et centres d'intérêt, usage et coûts de l'IA dans l'administration, traçabilité OpenAI de chaque appel.
   - **4g, pack CV + lettre** : un seul débit (`doc_pack`) pour un CV et une lettre de motivation ou une demande d'emploi. Le débit est réparti exactement entre les deux documents. Un document déjà payé ne peut pas entrer dans un pack.
   - **4g, « Mes documents »** : historique des PDF, filtre par type, pagination, téléchargement, y compris après suppression du document dans le Studio.
   - **Vue d'ensemble** : nombre réel de documents et étape « Préparer votre CV » reliée au Studio.
   - **Corrections du 14 novembre** : frais de paiement inclus dans le prix des packs de crédits, en-tête, champs et fenêtres, lisibilité sur mobile.

3. **Fichiers créés** (principaux)
   - API : modules `ai` et `studio` (documents, génération, photo, exports, packs, usage), 3 suites d'intégration.
   - Web : `features/studio` (éditeurs, questionnaires, modèles, export, pack), pages Studio, « Mes documents », impression et « Usage de l'IA ».
   - Partagé : `packages/shared/src/studio.ts`, catalogues `studio.json` FR et EN.

4. **Fichiers modifiés** : schéma Prisma, registre des crédits et grand livre, administration financière, navigation, composants de formulaire, catalogues FR et EN.

5. **Migrations** (appliquées en local) : `20261112170000_add_career_documents`, `20261113090000_add_ai_requests`, `20261113140000_add_career_exports`, `20261113160000_add_other_letter_service`, `20261113180000_add_paid_ai_generations`, `20261114090000_add_cv_photo`, `20261114120000_add_ai_request_trace`, `20261114150000_add_payment_fee_rate`, `20261122100000_add_career_packs`.

6. **Dépendance** : `puppeteer-core` 25.17.0 (impression PDF par Chromium).

7. **Tests exécutés** : API unitaires, API intégration, web, traductions, types, lint, formatage. Essai réel de l'étape 4g dans le navigateur avec un compte de test local : pack payé, deux PDF créés, historique, anglais et écran de 375 px.

8. **Résultats** : API unitaires 155/155, intégration 127/127, web 72/72, traductions 5/5. L'essai réel a débité 25 crédits (solde de 40 à 15).

9. **Problèmes rencontrés**
   - Des exécutions groupées des tests ont échoué de façon isolée (API le 22 novembre, web le 14), puis ont réussi. Cause non identifiée, probablement la charge de la machine.
   - Le port 6380 de Redis est utilisé par un autre projet local : le Redis d'Umoja Jobs est passé sur 6381 dans `.env` (non versionné).
   - Les modèles de CV avaient été modifiés par erreur lors de l'agrandissement mobile ; ils ont été rétablis (`881a0ae`).

10. **Risques**
    - **Frais Chariow** : avec 1 crédit à 0,20 USD et des packs à 2, 6 et 10 USD, le prix égale la valeur des crédits. Les 15 % de frais ne sont pas couverts.
    - **Prix des exports** : à 0,20 USD le crédit, le CV (15 crédits) vaut 3 USD, une lettre 2 USD et le pack 5 USD, le double des prix indicatifs (1,50, 1 et 2,50 USD).
    - **Pack sans avantage** : 25 crédits, comme un CV (15) et une lettre (10) achetés séparément.
    - Chromium est à installer dans l'image de production de l'API.
    - Les exports sont rendus pendant la requête : prévoir une file d'attente si le volume augmente.

11. **Décisions nécessaires**
    - Valider la clôture de la phase 4.
    - Choisir la valeur du crédit et les tarifs (0,10 ou 0,20 USD).
    - Fixer le prix du pack CV + lettre (par exemple moins de 25 crédits pour créer une économie).

12. **Recommandation** : trancher les prix, puis construire les pages d'administration encore annoncées « à venir » (utilisateurs, rôles, paiements, déverrouillages, commissions, catégories et pays) avant la phase 5.
