# Rapport des étapes 4f-2 à 4f-4 : Career Studio assisté par l'IA

Date : 13 novembre 2026. Suite du rapport 4f-1 (`docs/ETAPE_4F1_RAPPORT.md`).

## 1. Objectif

Faire de la génération par l'IA le parcours principal du Career Studio : l'utilisateur répond à un
questionnaire guidé, l'IA rédige, l'utilisateur relit et ajuste librement. Facturation en crédits
selon la grille validée (4f-1), sans modifier les autres tarifs.

## 2. Fonctionnalités réalisées

**4f-2 : lettres** (commit `4280f0b`)
- Questionnaire en étapes pour les 7 lettres, validation progressive, champs facultatifs signalés.
- « Reprendre mon CV » : remplit les champs vides depuis un CV du Studio (dates en clair).
- « Générer ma lettre · N crédits » : confirmation avec prix et solde, avertissement de remplacement,
  lien de recharge ; annulation et rétablissement de la génération.
- Régénération de l'objet, du corps ou de la formule (1 crédit), avec confirmation et retour arrière.
- Ton (formel, dynamique, sobre) et longueur (courte, standard, détaillée).
- Coupure réseau : l'état de l'opération est vérifié par sa clé avant toute relance.
- Lettre de recommandation : le signataire est l'expéditeur ; le titulaire du compte est le candidat.

**4f-3 : CV** (commit `b682a3e`)
- Questionnaire en 7 étapes ; des notes suffisent pour les expériences.
- « Générer mon CV · 5 crédits » : profil impersonnel, descriptions, compétences ordonnées, adaptation
  à une offre collée ; une description sans notes reste vide.
- Photo facultative (décision du 13 novembre 2026) : dimensions lues avant décodage, image recadrée et
  ré-encodée sans métadonnées, stockage privé, jamais envoyée à l'IA, affichée dans les modèles Moderne,
  Jeune diplômé et Cadre, figée dans les exports.
- Centres d'intérêt dans le CV et les six modèles.

**4f-4 : finitions**
- Page d'administration « Usage de l'IA » (commit `996552d`) : générations réussies et échouées,
  crédits débités, remboursés et nets, recette, coût OpenAI estimé distinct, tokens, répartition par
  type et par action, période de 7, 30 ou 90 jours ; agrégats seulement.
- Sauts de page des PDF (commit `ed84797`) : marges reprises sur chaque page, aucune page vide ajoutée,
  colonne sombre du modèle Moderne sur toute la hauteur de chaque page, lignes orphelines évitées.

## 3. Tests et résultats

- API : 149 tests unitaires et 123 d'intégration ; web : 70 ; traductions : 5 ; tous réussis.
- Essais réels avec OpenAI (`gpt-6-luna`, données fictives, compte de test local) : lettre générée,
  régénérée, objet régénéré, CV généré, exports PDF vérifiés visuellement (photo, centres d'intérêt,
  CV de deux pages, lettre d'une page). Chaque action a débité exactement son tarif.

## 4. Coûts mesurés

Sur la période d'essai : 8 générations, 22 crédits nets (2,20 USD de recette), 8 209 tokens
(4 608 en entrée, 3 601 en sortie), soit environ 1 000 tokens par génération. Le coût OpenAI reste à
calculer : renseigner les tarifs de `gpt-6-luna` (`OPENAI_PRICE_INPUT_USD_PER_MTOK`,
`OPENAI_PRICE_OUTPUT_USD_PER_MTOK`) ; la page « Usage de l'IA » l'affichera alors.

## 5. Problèmes corrigés pendant les essais

- Dates au format brut (« 2021-03 ») dans une lettre : écrites en toutes lettres.
- Bouton « Régénérer mon CV » affiché dès la présence de notes : « Générer » tant que le profil est vide.
- Colonne du modèle Moderne interrompue en page 2 et texte collé en haut de page : corrigés.

## 6. Points restants

- Tarifs OpenAI à renseigner (coût réel et marge).
- Phase 4 : page « Mes documents » et pack CV + lettre, puis rapport de fin de phase.
- Au déploiement : Chromium dans l'image de l'API (export PDF).
