# Outils de données

## Dictionnaire phonétique (`data/lexique-min.json`)

Dérivé de **Lexique 3.83** — http://www.lexique.org, licence **CC-BY-SA 4.0**.
Attribution dans l'app : « Données : Lexique.org (CC-BY-SA) ».

### Régénérer l'asset

1. Télécharger la base (≈ 26 Mo, non versionnée) :
   ```
   mkdir -p tools/.src
   curl -L -o tools/.src/Lexique383.tsv \
     https://www.lexique.org/databases/Lexique383/Lexique383.tsv
   ```
2. Générer :
   ```
   node tools/build-dico.mjs
   ```

Colonnes utilisées : `ortho`, `phon` (SAMPA), `nbsyll`. Par orthographe, on garde
l'entrée la plus fréquente (`freqfilms2 + freqlivres`).

Dernière génération : ~125 600 entrées, `data/lexique-min.json` ≈ 4,3 Mo
(≈ 0,65 Mo gzip). Un seuil de fréquence optionnel réduit encore la taille :
`node tools/build-dico.mjs tools/.src/Lexique383.tsv data/lexique-min.json 1`.
