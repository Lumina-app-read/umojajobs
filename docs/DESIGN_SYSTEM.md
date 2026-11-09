# OPPORTINITIES — Direction artistique et design system

- Version : 1.0, 9 novembre 2026
- Statut : **direction validée par le propriétaire** (lancement de l'étape D1). Mise en œuvre : `apps/web/src/app/globals.css` (jetons) et `apps/web/src/components/ui` (composants), page de référence `/fr/design` en développement.
- Planche visuelle interactive (palette, typographie, composants et maquettes, en clair et en sombre) : https://claude.ai/artifact/Ar2tdavo899LhPk9c4sDin

---

## 1. Diagnostic des interfaces actuelles

| Écran | Problèmes constatés |
|---|---|
| **Landing** | Un titre centré, deux boutons et une phrase : aucune proposition de valeur structurée, aucun visuel, aucune preuve, aucune section. Écran vide sous la ligne de flottaison. Aucune raison de s'inscrire. |
| **En-tête** | Deux groupes de boutons pour la langue (FR et EN) et le thème (trois icônes). Le même choix est éclaté en plusieurs boutons, et une seconde barre est ajoutée sur mobile. Pas de navigation produit, pas de logo, seulement un mot en gras. |
| **Typographie** | IBM Plex Sans, avec une échelle typographique non définie (tailles choisies au cas par cas). Titres du landing trop longs et peu affirmés. |
| **Formulaires** | Champs de 44 px en texte 16 px partout, cartes avec 32 px de marge intérieure, boutons « lg » de 48 px : un ensemble lourd. Aucune icône dans les champs, pas d'état « valide », pas de mesure de solidité du mot de passe. |
| **Inscription** | Sept champs sur un seul long formulaire, sans progression ni hiérarchie. |
| **Tableau de bord** | Une seule carte provisoire : pas de structure d'application (barre latérale, barre supérieure, navigation mobile). Bouton « Déconnexion » en double (en-tête et page). |
| **Mode sombre** | Fonctionnel, mais surfaces trop proches du fond, peu de hiérarchie entre niveaux, et logo bleu clair qui perd l'identité. |
| **Système** | Jetons de couleur présents, mais pas d'échelle d'espacement, de rayons, d'ombres ni d'animations. Pas de composants de menu, modale, badge, tableau, squelette ou notification. |

Conclusion : les fondations techniques (thème sans flash, i18n, accessibilité de base) sont saines. **La couche visuelle doit être reconstruite à partir d'un système**, pas retouchée page par page.

---

## 2. Direction artistique : « Clarté et élan »

OPPORTINITIES doit inspirer **confiance** (offres vérifiées, paiements, données personnelles) et **ambition** (carrière, progression).

- **Le bleu porte la confiance** : un bleu azur franc pour l'action, et un bleu nuit profond pour l'identité et les grandes surfaces sombres.
- **Une touche chaude, rare** : l'ambre, réservé aux moments de gain et d'élan (commissions, nouveautés, mise en avant). Jamais en aplat large.
- **Le produit comme illustration principale** : des compositions d'interface réelles (cartes d'offres avec drapeau et date limite, aperçu de CV) plutôt que des illustrations génériques.
- **Une précision suisse** : grille de 4 px, bordures fines, rayons modérés (16 px au maximum), ombres à peine perceptibles, beaucoup d'air mais aucun vide inutile.
- **Un ancrage africain sans cliché** : 54 drapeaux, villes réelles, montants en monnaies locales, visages réels. Pas de motifs « wax » décoratifs ni de cartes d'Afrique stylisées partout.

---

## 3. Typographie

### Choix : **Plus Jakarta Sans**, famille unique

| Critère | Plus Jakarta Sans | Poppins |
|---|---|---|
| Lisibilité à 13-14 px (tableaux de bord) | Très bonne : chasse plus étroite, ouvertures nettes | Moyenne : lettres larges et rondes, lignes longues |
| Caractère | Moderne, précis, « SaaS international » | Géométrique, amical, très répandu (aspect générique) |
| Graisses | Police variable 200 à 800 : un seul fichier, toutes les graisses | Neuf fichiers statiques séparés |
| Densité en interface | Compacte, adaptée aux formulaires et tableaux | Prend beaucoup de place horizontale |
| Langues | Latin étendu (français, langues d'Afrique de l'Ouest à diacritiques courants) | Latin étendu |

**Recommandation : Plus Jakarta Sans pour tout** (titres en 700-800 avec un léger resserrement, texte en 400-500). Pas de seconde police. Les chiffres alignés en colonne utilisent `font-variant-numeric: tabular-nums`. Les codes (TOTP, références) utilisent la police à chasse fixe du système.

> **Décidé** : `CLAUDE.md` §14 et le cahier des charges §3 ont été mis à jour (Plus Jakarta Sans, famille unique).

### Échelle typographique

| Jeton | Taille / interligne | Graisse | Usage |
|---|---|---|---|
| `display-xl` | 56 / 64 (mobile 36 / 44) | 800, -0,03 em | Titre du hero |
| `display-lg` | 40 / 48 (mobile 30 / 38) | 700, -0,02 em | Titres de section du landing |
| `heading-lg` | 28 / 36 | 700, -0,015 em | Titres de page (tableau de bord) |
| `heading-md` | 20 / 28 | 600 | Titres de carte et de panneau |
| `heading-sm` | 16 / 24 | 600 | Sous-titres, en-têtes de liste |
| `body-lg` | 18 / 28 | 400 | Introduction du landing |
| `body` | 16 / 24 | 400 | Texte courant (marketing, mobile) |
| `body-sm` | 14 / 20 | 400-500 | Texte d'interface par défaut (tableau de bord, formulaires sur ordinateur) |
| `caption` | 12 / 16 | 500 | Libellés secondaires, badges, aides |
| `overline` | 12 / 16 | 600, +0,06 em, majuscules | Sur-titres de section (avec parcimonie) |

---

## 4. Couleurs

Toutes les couleurs sont des **jetons sémantiques** (`--bg`, `--surface`, `--text`, `--primary`…) redéfinis pour chaque thème. Aucun composant n'utilise une couleur brute.

### Marque

| Jeton | Clair | Sombre | Rôle |
|---|---|---|---|
| `primary` | `#2452E6` | `#3866F5` | Aplats : boutons principaux, sélection, focus |
| `primary-hover` | `#1C40C2` | `#4D7BFF` | Survol |
| `brand` | `#2452E6` | `#8AA8FF` | Texte et icônes colorés : liens, badges, éléments actifs |
| `primary-soft` | `#EEF3FF` | `#16224A` | Fonds de badge, sélection discrète |
| `navy` | `#0D1B4C` | `#0D1B4C` | Identité, bandeaux, panneau d'inscription |
| `accent` (ambre) | `#9A5B00` | `#F5B544` | Gains, nouveautés : usage rare |

### Neutres (légèrement teintés de bleu, jamais de gris pur)

| Jeton | Clair | Sombre |
|---|---|---|
| `canvas` (fond de page) | `#F6F7FA` | `#0A0F1D` |
| `surface` (cartes, champs) | `#FFFFFF` | `#111829` |
| `surface-2` (zones secondaires, survol) | `#F0F2F6` | `#162036` |
| `surface-raised` (menus, modales) | `#FFFFFF` | `#1A2540` |
| `line` (bordures) | `#E3E6ED` | `#222D45` |
| `line-strong` | `#CBD1DC` | `#33405E` |
| `fg` (texte) | `#0E1525` | `#E7EBF3` |
| `fg-muted` | `#4A5468` | `#A5AEC3` |
| `fg-subtle` (aides, désactivé) | `#646D80` | `#8A94AA` |

### États

| Jeton | Clair (texte / fond) | Sombre (texte / fond) |
|---|---|---|
| `success` | `#067647` / `#ECFDF3` | `#47CD89` / `#0C2A1D` |
| `warning` | `#B54708` / `#FFFAEB` | `#FDB022` / `#2E2008` |
| `danger` | `#B42318` / `#FEF3F2` | `#F97066` / `#2F1214` |
| `info` | = `brand` / `primary-soft` | = `brand` / `primary-soft` |
| `danger-solid` (aplat des actions destructives) | `#D92D20` | `#D92D20` |

Contrastes mesurés (étape D1) : texte principal ≥ 15:1, texte secondaire ≥ 7,6:1, texte discret ≥ 4,6:1, textes colorés et boutons ≥ 4,5:1, bordure de focus ≥ 3:1, dans les deux thèmes. Pour y parvenir, le bleu des aplats (`primary`) et le bleu du texte (`brand`) sont distincts en mode sombre.

**Mode sombre** : ce n'est pas une inversion. Trois niveaux de surface (`bg` < `surface` < `surface-raised`), séparés par la luminosité et des bordures fines plutôt que par des ombres, un reflet intérieur de 1 px en haut des surfaces élevées, et un bleu primaire éclairci pour rester lisible.

---

## 5. Espacements, rayons, ombres, tailles

- **Grille de 4 px.** Échelle : 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96.
- **Sections du landing** : 96 px sur ordinateur, 64 px sur mobile. Conteneur marketing 1200 px ; contenu du tableau de bord fluide, 1440 px au maximum.
- **Rayons** :
  - 6 px : boutons et champs ;
  - 8 px : menus et petites cartes ;
  - 12 px : cartes et modales ;
  - 16 px : panneaux de présentation du landing uniquement ;
  - pilule : badges et avatars.
  - **Jamais plus de 16 px.**
- **Ombres (clair)** :
  - `xs` `0 1px 2px rgb(16 24 40 / .05)` ;
  - `sm` (cartes) ;
  - `md` (menus) ;
  - `lg` (modales).
  - **Sombre** : bordure et reflet intérieur, quasiment pas d'ombre.
- **Anneau de focus** : 3 px en `primary` à 25 % d'opacité, en plus de la bordure `primary`. Toujours visible au clavier.
- **Hauteurs de contrôle** :

| Taille | Hauteur | Usage |
|---|---|---|
| `sm` | 32 px | Filtres, actions de tableau |
| `md` | 36 px | Défaut du tableau de bord |
| `lg` | 40 px | Formulaires d'authentification et du landing |
| `xl` | 48 px | Appel à l'action principal du hero uniquement |

Sur mobile, le texte des champs passe à **16 px** (sinon iOS zoome automatiquement) et les zones tactiles font au moins 40 px.

---

## 6. Icônes et animations

- **Icônes : Lucide uniquement** (déjà installée). Trait de 1,75 ; 16 px dans les contrôles, 18-20 px dans la navigation. Aucun emoji fonctionnel ; les drapeaux restent la seule exception.
- **Animations : CSS uniquement, sans bibliothèque.**

| Jeton | Durée | Courbe | Usage |
|---|---|---|---|
| `fast` | 120 ms | ease-out | Survol, pression |
| `base` | 200 ms | `cubic-bezier(.16,1,.3,1)` | Menus, onglets, alertes |
| `slow` | 320 ms | idem | Changement d'étape, apparition des sections |

  - Apparition au défilement : fondu et translation de 8 px, **une seule fois** (Intersection Observer natif). Le contenu reste visible sans JavaScript.
  - Pas d'animation permanente, à l'exception de l'indicateur de chargement.
  - `prefers-reduced-motion` : toutes les translations sont supprimées et les durées ramenées à zéro.

---

## 7. Composants fondamentaux

Tous les composants sont construits une fois dans `apps/web/src/components/ui`, documentés sur une page interne `/design` (visible uniquement en développement), et réutilisés partout.

| Composant | Spécification |
|---|---|
| **Button** | Variantes `primary`, `secondary` (bordure), `ghost`, `danger`, `link`. Tailles `sm`/`md`/`lg`/`xl`. Icône facultative à gauche ou à droite, état de chargement qui garde la largeur, état désactivé. |
| **IconButton** | Carré (32/36/40 px), libellé accessible obligatoire, info-bulle. |
| **Input** | Libellé visible au-dessus, icône facultative à gauche (Mail, Lock, User, Search), action à droite (afficher le mot de passe, effacer). États : repos, survol, focus, erreur (bordure et message avec icône), valide (coche discrète), désactivé. Aide sous le champ. |
| **Select et Combobox** | Même apparence que l'Input. Liste en `surface-raised` (rayon 8, ombre `md`), recherche, élément actif, coche, état vide. Sélecteur de pays avec drapeau et indicatif. |
| **Checkbox, Radio, Switch** | 16 px, coche animée en 120 ms, libellé cliquable. |
| **Menu déroulant** | Headless UI : clavier, fermeture à l'Échap, alignement automatique. Base des menus de thème, de langue et d'utilisateur. |
| **ThemeMenu** | **Un seul bouton-icône** : soleil, lune ou écran selon la préférence. Il ouvre un menu à trois choix (Clair, Sombre, Système) avec une coche. |
| **LanguageMenu** | **Un seul bouton** (globe et « FR » ou « EN ») qui ouvre « Français » et « English », chacun écrit dans sa propre langue. Je déconseille les drapeaux pour les langues : le français et l'anglais sont parlés dans des dizaines de pays africains. |
| **Card** | Surface, bordure de 1 px, rayon 12, ombre `xs` (clair) ; en-tête, contenu et pied facultatifs. Variante interactive avec survol (bordure plus marquée et ombre `sm`). |
| **Badge** | Pilule de 20 px, texte de 12 px en graisse 500. Tons `neutral`, `primary`, `success`, `warning`, `danger`, `accent`. Point facultatif. Pour les statuts d'offre, de commission et de retrait. |
| **Alert** | Icône, titre, texte et action facultatifs. Tons d'état. Un style « bandeau » pleine largeur. |
| **Toast** | Retour immédiat après une action (« Offre enregistrée »). En haut à droite sur ordinateur, en bas sur mobile. Disparaît après 5 s, sauf pour les erreurs. |
| **Modal et Drawer** | Headless UI Dialog : fond flouté, piège du focus, tiroir latéral sur mobile. |
| **Tabs et SegmentedControl** | Pour les filtres de vue (Toutes, Actives, Expirées). |
| **Table** | En-tête collant, lignes de 44 px, chiffres alignés, actions de ligne au survol. Devient une liste de cartes sur mobile. |
| **StatCard** | Libellé, valeur (chiffres alignés), évolution facultative et mini-courbe SVG. **Quatre au maximum par écran.** |
| **EmptyState** | Icône dans un cercle teinté, une phrase utile, une action principale. |
| **Skeleton** | Blocs de la forme du contenu final, reflet discret de 1,2 s (désactivé si les animations sont réduites). |
| **Stepper** | Barre segmentée, « Étape 1 sur 2 » et titre de l'étape. |
| **Avatar** | Initiales sur fond teinté si aucune photo. |
| **Navigation** | Barre latérale du tableau de bord, barre d'onglets mobile, en-tête du site, fil d'Ariane. |
| **Graphiques** | Petits composants SVG maison (courbe, barres) dans un premier temps ; pas de bibliothèque lourde tant que l'administration n'en a pas besoin. |

---

## 8. Landing : recommandations

Objectif unique : **faire créer un compte**, et secondairement faire explorer les offres.

| # | Section | Contenu et intention |
|---|---|---|
| 1 | **En-tête collant** | Logo, puis Opportunités · Career Studio · Contribuer · FAQ, puis langue, thème, « Se connecter » et « Créer un compte ». Sur mobile : menu en tiroir. Fond translucide légèrement flouté au défilement. |
| 2 | **Hero** | Sur-titre : « Offres vérifiées dans 54 pays africains ». Titre : « Trouvez votre prochaine opportunité, partout en Afrique. » Sous-titre sur la vérification, la communauté et le Career Studio. Boutons « Créer mon compte gratuit » (principal) et « Découvrir les opportunités ». Mention « Gratuit · Français et anglais ». **Visuel** : composition de cartes d'offres réelles (drapeau, ville, badge « Vérifiée », date limite), d'une barre de recherche et d'un aperçu de CV, avec la photo d'une professionnelle ou d'un professionnel africain. |
| 3 | **Bandeau de confiance** | Uniquement des faits vrais : 54 pays couverts, offres vérifiées avant publication, paiement sécurisé, français et anglais. Les chiffres de la communauté (offres actives, contributeurs) s'afficheront **depuis l'API** quand ils existeront ; jamais de chiffres inventés. |
| 4 | **Comment ça marche** | Trois étapes, numérotées car c'est un vrai parcours : créer un compte, trouver et débloquer une offre vérifiée, postuler avec un dossier professionnel. |
| 5 | **Opportunités** | Recherche (poste, pays), catégories et pays populaires, cartes d'offres. Données réelles à partir de la phase 2. |
| 6 | **Career Studio** | Aperçu d'un CV et d'une lettre. L'IA reformule sans jamais inventer. Modèles, export PDF, prix en crédits tirés de la configuration. |
| 7 | **Contribuer** | « Partagez une offre, recevez 30 % de chaque déblocage. » Explication honnête : modération, conditions, délai de sécurité, exemple de calcul issu des paramètres. |
| 8 | **Témoignages** | Composant prêt mais **masqué** tant qu'il n'y a pas de témoignages authentiques et consentis. |
| 9 | **FAQ** | Accordéon de 6 à 8 questions (vérification, prix, crédits, commissions, données, langues). |
| 10 | **Appel à l'action final** | Bandeau bleu nuit, un bouton. |
| 11 | **Pied de page** | Quatre colonnes (Produit, Ressources, Société, Légal), langue, thème, attributions, réseaux. |

### Visuels

1. **Compositions d'interface en code** (recommandé tout de suite) : nettes, légères, traduites, compatibles avec le mode sombre, toujours fidèles au produit réel.
2. **Photographie authentique** de professionnels africains, avec licence et autorisation des personnes photographiées : une séance commandée ou une sélection exigeante dans une banque d'images payante (pas de visuels « génériques » gratuits).
3. **Série d'illustrations commandée** (personnages, états vides) pour une identité propre et durable.

> **Décision nécessaire** : budget et source des visuels (points 2 et 3). Je ne génère pas d'images et je n'utiliserai aucun visuel sans licence vérifiée.

---

## 9. Inscription en deux étapes

- **Mise en page** :
  - ordinateur : panneau gauche bleu nuit (logo, trois bénéfices, mention de sécurité) et formulaire à droite (440 px) ;
  - mobile : formulaire seul, actions en bas.
- **Indicateur** : barre en deux segments, « Étape 1 sur 2 · Vos informations ».
- **Étape 1, « Vous »** : prénom, nom, pays de résidence (sélecteur avec drapeaux, pays proposé selon la langue du navigateur si possible). Bouton « Continuer ».
- **Étape 2, « Votre compte »** : email, mot de passe (liste de règles cochée en direct : 12 caractères minimum, sans votre nom ni votre email), confirmation, conditions. Boutons « Retour » et « Créer mon compte ».
- **Comportement** :
  - validation par champ à la sortie du champ et à la soumission ;
  - données conservées au retour en arrière ;
  - transition de 320 ms (fondu et glissement de 12 px) ;
  - focus placé sur le premier champ de l'étape ;
  - une erreur de l'API concernant l'étape 1 y ramène automatiquement ;
  - écran de confirmation soigné (icône d'email, adresse en gras, renvoi de l'email).
- **Rien de plus n'est demandé** que les champs exigés par `CLAUDE.md` §6.

---

## 10. Tableau de bord

- **Structure** :
  - barre latérale de 256 px sur ordinateur, repliable en icônes ;
  - barre supérieure : titre de la page, recherche, notifications, menu utilisateur ;
  - mobile : barre supérieure, tiroir de navigation et **barre d'onglets en bas** (Accueil, Offres, Publier, Studio, Compte).
- **Navigation groupée** :
  - Accueil ;
  - Offres (Rechercher, Enregistrées, Débloquées) ;
  - Contribuer (Mes publications, Publier) ;
  - Finances (Portefeuille, Commissions, Retraits) ;
  - Career Studio (Studio, Mes documents) ;
  - Paramètres.
  - L'administration est une section distincte, visible selon les permissions.
- **Vue d'ensemble, par ordre de priorité** :
  1. accueil et **une** action principale ;
  2. liste « À faire » tant que le profil est incomplet ;
  3. **quatre indicateurs au maximum** (crédits, offres débloquées, gains disponibles si contributeur, documents) ;
  4. colonne principale : offres recommandées **sous forme de liste**, activité récente ;
  5. colonne latérale : résumé du portefeuille avec mini-courbe, dernières notifications.
- **Règles** :
  - pas d'empilement de cartes : une carte ne sert qu'à isoler un objet ;
  - états vides utiles ;
  - squelettes au chargement ;
  - notification de confirmation après chaque action ;
  - statuts sous forme de badges colorés.

---

## 11. Plan de mise en œuvre proposé (après validation)

| Étape | Contenu |
|---|---|
| **D1 — Fondations** | Jetons (couleurs, typographie, espacements, rayons, ombres, animations), Plus Jakarta Sans, composants fondamentaux, page `/design` de référence. |
| **D2 — Navigation** | En-tête, menus de thème et de langue uniques, pied de page. |
| **D3 — Authentification** | Inscription en deux étapes, connexion, mot de passe, double authentification. |
| **D4 — Landing** | Sections 1 à 11, compositions d'interface, apparitions au défilement. |
| **D5 — Tableau de bord** | Structure (phase 1e) : barre latérale, barre mobile, vue d'ensemble, états vides, squelettes, notifications. |

Chaque étape sera présentée avec des captures en clair et en sombre, sur ordinateur et sur mobile, avant de passer à la suivante.

## 12. Décisions nécessaires

1. **Typographie** : valider Plus Jakarta Sans et la mise à jour de `CLAUDE.md` §14 et du cahier §3.
2. **Palette** : valider le bleu azur, le bleu nuit et l'accent ambre.
3. **Visuels** : budget et source des photographies et illustrations.
4. **Logo** : aucun logo n'existe. Je propose un logotype provisoire en Plus Jakarta Sans 800. Un vrai logo, conçu par un designer, est recommandé avant le lancement.
5. **Ordre de réalisation** : D1 à D5 comme ci-dessus.
