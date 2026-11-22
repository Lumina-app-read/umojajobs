# Phase 4 — Rapport de clôture : Career Studio

**Phase validée et close par le propriétaire le 22 novembre 2026**, avec l'ajout des deux demandes de l'étape 4h (dossiers rassemblés et images dans les offres).

Date : 22 novembre 2026. Commits `42fcd2d` à `199a77d`. Détails des étapes 4f : `docs/ETAPE_4F1_RAPPORT.md` et `docs/ETAPE_4F_RAPPORT.md`.

1. **Objectif** : permettre à l'utilisateur de créer ses documents de candidature, avec une IA qui n'invente rien, un aperçu gratuit et un export PDF payé en crédits.

2. **Fonctionnalités réalisées**
   - **4a à 4c, CV** : éditeur avec aperçu en direct, enregistrement automatique, reformulation par l'IA, six modèles.
   - **4d, export PDF** : payé en crédits, ré-exports gratuits pendant 7 jours (réglable), jamais de second paiement après un échec technique.
   - **4e, lettres** : sept types de lettres, deux modèles.
   - **4f, génération par l'IA** : questionnaires guidés, génération payée en crédits et remboursée en cas d'échec, photo et centres d'intérêt, usage et coûts de l'IA dans l'administration, traçabilité OpenAI de chaque appel.
   - **4g, pack CV + lettre** : un seul débit (`doc_pack`) pour un CV et une lettre de motivation ou une demande d'emploi. Le débit est réparti exactement entre les deux documents. Un document déjà payé ne peut pas entrer dans un pack.
   - **4g, « Mes documents »** : historique des PDF, filtre par type, pagination, téléchargement, y compris après suppression du document dans le Studio.
   - **4h, dossiers rassemblés** (« Rassembler en PDF ») : l'utilisateur réunit les documents qu'il possède déjà (PDF, JPG, PNG, WebP), choisit leur ordre, puis exporte un seul PDF pour 30 crédits (`doc_bundle`, réglable). Ré-exports gratuits pendant la même période de 7 jours, aucun second débit après un échec. Fichiers privés, jamais envoyés à l'IA, effacés du stockage quand ils sont retirés ou que le dossier est supprimé. Limites : 5 dossiers, 20 fichiers, 10 Mo par fichier, 40 Mo et 100 pages par dossier.
   - **4h, images dans les offres** : l'annonce originale et les documents complémentaires peuvent être des images (JPG, PNG, WebP), ré-encodées sans métadonnées ; consultation avec la même mention incrustée que les PDF.
   - **Vue d'ensemble** : nombre réel de documents et étape « Préparer votre CV » reliée au Studio.
   - **Corrections du 14 novembre** : frais de paiement inclus dans le prix des packs de crédits, en-tête, champs et fenêtres, lisibilité sur mobile.

3. **Fichiers créés** (principaux)
   - API : modules `ai` et `studio` (documents, génération, photo, exports, packs, usage), 3 suites d'intégration.
   - Web : `features/studio` (éditeurs, questionnaires, modèles, export, pack), pages Studio, « Mes documents », impression et « Usage de l'IA ».
   - Partagé : `packages/shared/src/studio.ts`, catalogues `studio.json` FR et EN.

4. **Fichiers modifiés** : schéma Prisma, registre des crédits et grand livre, administration financière, navigation, composants de formulaire, catalogues FR et EN.

5. **Migrations** (appliquées en local) : `20261112170000_add_career_documents`, `20261113090000_add_ai_requests`, `20261113140000_add_career_exports`, `20261113160000_add_other_letter_service`, `20261113180000_add_paid_ai_generations`, `20261114090000_add_cv_photo`, `20261114120000_add_ai_request_trace`, `20261114150000_add_payment_fee_rate`, `20261122100000_add_career_packs`, `20261122140000_add_document_bundles`.

6. **Dépendances** : `puppeteer-core` 25.17.0 (impression PDF par Chromium) ; `pdf-lib` 1.17.1 (assemblage de PDF, licence MIT). `pdf-lib` n'est plus mis à jour depuis 2022 : il s'exécute dans un fil isolé, sans variables d'environnement, limité en temps.

7. **Tests exécutés** : API unitaires, API intégration, web, traductions, types, lint, formatage. Essai réel de l'étape 4g dans le navigateur avec un compte de test local : pack payé, deux PDF créés, historique, anglais et écran de 375 px.

8. **Résultats** : API unitaires 155/155, intégration 134/134, web 77/77, traductions 5/5. Essais réels avec des comptes de test : pack (25 crédits débités) et dossier rassemblé (30 crédits débités, PDF de trois pages contrôlé visuellement) ; image ajoutée à une offre.

9. **Problèmes rencontrés**
   - Des exécutions groupées des tests ont échoué (web le 14 novembre, API le 22), puis ont réussi. Le 22, dix tests d'intégration ont échoué pendant que le serveur de développement tournait sur la même machine (neuf minutes au lieu de trois) ; les 134 ont réussi une fois ce serveur arrêté. Cause probable : la charge, sans preuve directe.
   - Le port 6380 de Redis est utilisé par un autre projet local : le Redis d'Umoja Jobs est passé sur 6381 dans `.env` (non versionné).
   - Les modèles de CV avaient été modifiés par erreur lors de l'agrandissement mobile ; ils ont été rétablis (`881a0ae`).

10. **Risques**
    - **Frais Chariow** : avec 1 crédit à 0,20 USD et des packs à 2, 6 et 10 USD, le prix égale la valeur des crédits. Les 15 % de frais ne sont pas couverts.
    - **Prix des exports** : à 0,20 USD le crédit, le CV (15 crédits) vaut 3 USD, une lettre 2 USD et le pack 5 USD, le double des prix indicatifs (1,50, 1 et 2,50 USD).
    - **Pack sans avantage** : 25 crédits, comme un CV (15) et une lettre (10) achetés séparément.
    - Chromium est à installer dans l'image de production de l'API.
    - Les exports sont rendus pendant la requête : prévoir une file d'attente si le volume augmente.

    - **Documents personnels** : les dossiers peuvent contenir des pièces d'identité. Durée de conservation et mention dans la politique de confidentialité à définir avant la mise en ligne.
    - **Dossier réutilisable** : pendant la période gratuite, l'utilisateur peut changer les fichiers d'un dossier déjà payé (même règle que pour le CV et les lettres).
    - **Mémoire** : un PDF construit pour se décompresser à l'excès est interrompu au bout d'un délai, sans limite stricte de mémoire ; prévoir une limite de mémoire du conteneur en production.

11. **Décisions nécessaires**
    - Choisir la valeur du crédit et les tarifs (0,10 ou 0,20 USD).
    - Durée de conservation des dossiers rassemblés.

12. **Recommandation** : trancher les prix, puis construire les pages d'administration encore annoncées « à venir » (utilisateurs, rôles, paiements, déverrouillages, commissions, catégories et pays) avant la phase 5.
