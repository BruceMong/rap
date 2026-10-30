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
- Stockage **local** (IndexedDB) + bouton d'export. Pas de cloud en v1.
- Aide à la rime et compteur de syllabes : **dico phonétique FR embarqué**
  (chargé en différé) + phonétisation par règles pour les mots hors-dico.

## État

- Conception **validée** : `docs/superpowers/specs/2026-10-30-rap-design.md`
  (source de vérité du périmètre v1 — la lire avant de coder).
- Plan technique : à écrire (superpowers:writing-plans).

## Préférences de Bruce

- Réponses concises et directes, en français. Pas d'emojis sauf demande.
- Vérifier avant toute action destructive ; commit/push seulement sur demande.
