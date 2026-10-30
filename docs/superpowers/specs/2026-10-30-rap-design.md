# Rap — doc de conception

*2026-10-30 · brainstorm Bruce + Claude · validé*

## Intention et pourquoi

Bruce écrit du rap, quasi exclusivement sur le bloc-notes de son téléphone.
Problème : tout s'empile au même endroit — le texte abouti, les idées jetées en
vrac, et les brouillons pas encore en forme (vers qui ne riment pas encore).
Ça devient vite illisible. Il contourne en surlignant son « vrai » texte en
jaune, mais ça ne suffit plus. Il aime quand ça rime, et il bute souvent sur la
mise en rime.

L'app doit faire ce qu'aucun outil existant ne fait **en français** : ranger le
bordel sans le jeter (« bordel rangé »), aider à rimer, et montrer les schémas
de rime en couleur. Les éditeurs de paroles sérieux (Rappad, Rhymer's Block)
sont anglophones et leur aide à la rime ne vaut rien en FR ; les dicos de rimes
FR (rimessolides, CRISCO) ne rangent pas les textes. Le cœur de valeur est à
l'intersection des deux, en français.

## Forme

- **PWA** mobile-first, installable, **fonctionne hors ligne**. JavaScript, sans
  étape de build, dans la lignée du carnet FitTracking de Bruce (GitHub Pages).
- **Cible : Android / Chrome** (confirmé). Le stockage local y est durable, ce
  qui valide la stratégie « tout en local + export » sans cloud.
- Conçue pour le pouce, sur un clavier de téléphone. La **capture rapide d'une
  idée** prime sur tout le reste.

## Ce qui est décidé

### Écran d'accueil — vue d'ensemble
À l'ouverture, Bruce voit tout d'un coup (validé sur maquette) :
- En haut, le **coffre à idées transversal** : les idées en vrac qui
  n'appartiennent à aucun morceau.
- En dessous, ses **morceaux**, groupés **en cours** puis **terminés** : titre,
  aperçu de la 1re ligne, et pour les morceaux en cours un ruban des couleurs de
  rimes + le nombre de placards ouverts + date.
- Bouton **+ Nouveau morceau** ; action **+ jeter une idée** dans le coffre.

### Écran d'un morceau — « bordel rangé »
Validé sur maquette :
- Le **texte propre** en surface, lisible. Les lignes **validées** sont
  surlignées jaune (reprend l'habitude de Bruce) ; les lignes **en travaux** ont
  un état visuel distinct.
- Sous une ligne, un **placard** repliable (accordéon) qui contient les essais /
  brouillons / variantes de cette ligne. Replié par défaut ; on le déplie au
  besoin pour garder le texte propre sous les yeux.
- **Placards imbriqués** : une idée dans l'idée (placard dans un placard).
- Un placard est accroché à **une ligne précise**.
- **Jamais jeté en silence** : si la ligne porteuse est supprimée ou fortement
  réécrite, son placard n'est pas perdu — il devient un **« brouillon détaché »**
  conservé dans le morceau (cœur de la promesse « ranger sans jeter »). La
  suppression d'un brouillon reste une action explicite de Bruce.

### Coffre à idées
- Vit à l'accueil, **transversal** (au-dessus des morceaux).
- Sur une idée : action **« envoyer vers un morceau »** (on choisit la
  destination). L'idée atterrit comme une **nouvelle ligne en travaux en fin de
  texte** du morceau, que Bruce retravaille ensuite. Sinon, il recopie à la
  main. **Pas de glisser-déposer.**

### Rimes
- **Surlignage automatique en continu** : à mesure que Bruce écrit, les groupes
  de vers qui riment prennent chacun une couleur. **Débrayable** d'un geste
  (réglage) pour basculer en mode « à la demande » si l'auto le gêne — à tester.
- **Moteur de rimes intégré, hors ligne** : Bruce tape/sélectionne un mot →
  liste de rimes **classées par richesse** (pauvres / suffisantes / riches) et
  par nombre de syllabes communes, sans quitter le texte ni dépendre du réseau.
  Préféré à un simple lien vers rimessolides.
- Repose sur un **dictionnaire phonétique français libre embarqué** (type
  Lexique) + une **phonétisation par règles (G2P)** pour les mots hors-dico —
  essentiel en rap (argot, verlan, anglicismes).

### Syllabes
- **Compteur de pieds par vers**, discret, affiché en gris en bout de ligne.
  Aide à caler le flow (voir si deux vers « tombent » pareil). Dérivé du même
  dico phonétique, donc quasi gratuit.

### Stockage
- **Local sur le téléphone** (IndexedDB). Pas de compte, pas de cloud, pas de
  réseau requis en v1. Cible Android confirmée : le stockage local y est durable
  (on demandera quand même `navigator.storage.persist()`).
- **Bouton « exporter »** : sort tous les textes dans un fichier, comme filet de
  sécurité manuel.
- L'architecture ne doit pas fermer la porte à une synchro cloud ultérieure
  (option 3 écartée pour le v1, pas pour toujours).

## Non-goals (hors périmètre v1)

- Pas de compte, de cloud, ni de synchro automatique.
- Pas de lecteur de beats / instru, pas d'enregistrement audio.
- Pas de collaboration ni de partage multi-utilisateur.
- Pas de glisser-déposer.
- Pas de version iOS/Android native : c'est une PWA.

## Anti-goals (ce qui serait un échec même si ça « marche »)

- Que l'aide à la rime devienne **intrusive** et casse le flow d'écriture.
- Que l'app soit **plus lente ou plus lourde** à l'usage que le bloc-notes
  qu'elle remplace (surtout : capture d'une idée instantanée).
- Que le surlignage automatique rende le texte **illisible** (trop de couleurs,
  faux positifs).

## Contraintes

- Hors ligne total ; tout embarqué, y compris le dico phonétique (compressé à
  une taille raisonnable pour une PWA).
- Français d'abord : rimes et syllabes doivent être justes en FR.
- Perf : le surlignage en continu doit rester fluide pendant la frappe
  (re-calcul incrémental, pas tout le texte à chaque touche).
- **Démarrage découplé** : l'app et la capture d'idée s'ouvrent instantanément ;
  le dico phonétique (rimes + syllabes) se charge **en différé**, juste après,
  pour ne jamais être plus lent que le bloc-notes.
- Mobile-first, utilisable à une main.

## Choix que j'ai tranchés (à confirmer en passant)

- PWA installable + service worker pour le hors ligne.
- IndexedDB pour le stockage local.
- **Rimes de fin de vers par défaut** ; les rimes internes (plus bruitées) sont
  reportées ou mises en option réglable — on ne les active pas d'office en v1.
- Palette et typo issues des maquettes (jaune surligneur, etc.) : provisoires,
  ajustables.
- Ressource phonétique : Lexique ou équivalent libre — licence à vérifier à
  l'implémentation.

## Laissé au builder

- Choix exact de la ressource phonétique et du format d'index embarqué.
- Algorithme de classement des rimes (définition de pauvre/suffisante/riche).
- Mécanique d'édition du texte (textarea, contenteditable, ou éditeur ligne par
  ligne) — gros point technique à trancher au plan.
- Schéma de données exact (morceaux, lignes, placards, idées).
- Détail du format d'export.

## Nom

**Rap** (validé).

## Résolu par la relecture (2026-10-30)

- **Appareil** : Android / Chrome → stratégie « tout en local + export » validée.
- **Placard orphelin** : jamais jeté, devient « brouillon détaché » (voir Écran
  d'un morceau).
- **« Envoyer vers un morceau »** : dépose une ligne en travaux en fin de texte.
- **Chargement du dico** : différé, pour garder l'ouverture instantanée.
