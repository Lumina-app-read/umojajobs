# Attribution des données

## Villes — GeoNames

Le fichier `cities-africa.tsv` est dérivé de la base [GeoNames](https://www.geonames.org/), publiée sous licence
[Creative Commons Attribution 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

- Sources : `cities5000.zip` et `admin1CodesASCII.txt` sur https://download.geonames.org/export/dump/
- Extraction : 9 novembre 2026.
- Transformations :
  - limitation aux 54 États africains membres de l'ONU ;
  - exclusion des codes `PPLX`, `PPLH`, `PPLQ`, `PPLW` et `PPLCH` (quartiers, lieux historiques, abandonnés ou détruits) ;
  - ajout du nom de la région (admin1) ;
  - sélection des colonnes utiles.
- Régénération : `pnpm --filter @opportinities/api cities:build <cities5000.txt> <admin1CodesASCII.txt>`

**Obligation :** la licence CC BY 4.0 impose de mentionner GeoNames dans l'application (page « À propos » ou pied de page), avec un lien vers geonames.org. À intégrer en phase 1d.
