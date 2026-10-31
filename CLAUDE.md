# Rap — instructions Claude

App d'écriture de rap pour Bruce, pensée pour le téléphone.

## En deux mots

Le bloc-notes où Bruce écrit ses textes devient vite le bordel : texte abouti,
idées en vrac et brouillons pas encore en rime, tout mélangé. « Rap » range ce
bordel sans le jeter, aide à rimer en **français**, et montre les schémas de
rime en couleur.

## Stack

- **PWA** mobile-first (Android / Chrome), installable, **hors ligne**.
- JavaScript, **sans étape de build**, dans la lignée du carnet FitTracking
  (destinée à GitHub Pages).
- Stockage **local** (IndexedDB) + bouton d'export.
- Aide à la rime et compteur de syllabes : **dico phonétique FR embarqué**
  (chargé en différé) + phonétisation par règles pour les mots hors-dico.
- **En ligne** : dépôt public `BruceMong/rap`, GitHub Pages → https://brucemong.github.io/rap/

## Sauvegarde cloud (filet de sécurité, v2)

- Projet **Supabase « rap »** (id `mttoschvyjnzamtehajy`, eu-west-3) — `js/backup.js`.
- Table `sauvegardes` **fermée** (RLS sans policy) ; la base ne garde que l'empreinte
  sha256 de la clé. Deux fonctions `SECURITY DEFINER` : `rap_sauver(p_cle, p_donnees)`,
  `rap_restaurer(p_cle)`, appelées via l'API publique (clé `sb_publishable_…`, publique
  par design, en clair dans le code).
- La **clé secrète** vit sur l'appareil (localStorage `rap.cle`), jamais dans le code.
  Pattern du carnet FitTracking. Sauvegarde auto débouncée + restauration (écran À propos).
- **Textes seulement** (morceaux + coffre) : les MP3 ne partent pas dans le cloud.

## Lecteur d'instru (v2)

- Un MP3 par morceau, stocké en IndexedDB (store `instrus`, clé = id du morceau),
  **hors backup/export** — `js/ui-instru.js`.
- Barre de lecture fixe **hors de `#app`** (ne se recrée pas au redessin, donc la
  lecture ne se coupe pas). Mode normal (tout en boucle) ou **boucle A-B** persistée.

## État

- v1 (écriture, placards, rimes, pieds, local + export) et v2 (sauvegarde cloud,
  lecteur d'instru) **livrées et en ligne**.
- Conception v1 : `docs/superpowers/specs/2026-10-30-rap-design.md` ·
  plan : `docs/superpowers/plans/2026-10-30-rap.md`.

## Préférences de Bruce

- Réponses concises et directes, en français. Pas d'emojis sauf demande.
- Vérifier avant toute action destructive ; commit/push seulement sur demande.
