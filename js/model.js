// Modèle de données et opérations pures (immuables) pour un morceau.
// Types :
//   Idee    = { id, texte, enfants: Idee[] }          (un placard, récursif)
//   Ligne   = { id, texte, valide: boolean, placards: Idee[] }
//   Morceau = { id, titre, statut:'en_cours'|'fini', ordre, lignes: Ligne[],
//               detaches: Idee[], creeLe, modifieLe }

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function touch(m, patch) {
  return { ...m, ...patch, modifieLe: Date.now() };
}

export function creerMorceau(titre) {
  const now = Date.now();
  return {
    id: uid(), titre: titre ?? '', statut: 'en_cours', ordre: now,
    lignes: [], detaches: [], creeLe: now, modifieLe: now,
  };
}

export function ajouterLigne(m, texte) {
  const ligne = { id: uid(), texte: texte ?? '', valide: false, test: false, placards: [] };
  return touch(m, { lignes: [...m.lignes, ligne] });
}

export function modifierLigne(m, ligneId, texte) {
  return touch(m, {
    lignes: m.lignes.map((l) => (l.id === ligneId ? { ...l, texte } : l)),
  });
}

// États d'une ligne : brouillon → à tester (vert) → gardé/validé (jaune).
// valide et test s'excluent.
export function basculerValide(m, ligneId) {
  return touch(m, {
    lignes: m.lignes.map((l) => (l.id === ligneId
      ? { ...l, valide: !l.valide, test: l.valide ? l.test : false }
      : l)),
  });
}

export function basculerTest(m, ligneId) {
  return touch(m, {
    lignes: m.lignes.map((l) => (l.id === ligneId
      ? { ...l, test: !l.test, valide: l.test ? l.valide : false }
      : l)),
  });
}

// Insère une nouvelle ligne (en travaux) juste après la ligne donnée.
export function insererLigneApres(m, ligneId, texte = '') {
  const i = m.lignes.findIndex((l) => l.id === ligneId);
  if (i < 0) return ajouterLigne(m, texte);
  const ligne = { id: uid(), texte, valide: false, test: false, placards: [] };
  const lignes = [...m.lignes];
  lignes.splice(i + 1, 0, ligne);
  return touch(m, { lignes });
}

export function supprimerLigne(m, ligneId) {
  const l = m.lignes.find((x) => x.id === ligneId);
  const detaches = l && l.placards.length
    ? [...m.detaches, ...l.placards]
    : m.detaches;
  return touch(m, { lignes: m.lignes.filter((x) => x.id !== ligneId), detaches });
}

function insererIdee(idees, parentId, nouvelle) {
  if (parentId === null) return [...idees, nouvelle];
  return idees.map((i) =>
    i.id === parentId
      ? { ...i, enfants: [...i.enfants, nouvelle] }
      : { ...i, enfants: insererIdee(i.enfants, parentId, nouvelle) });
}

export function ajouterPlacard(m, ligneId, texte, parentPlacardId = null) {
  const nouvelle = { id: uid(), texte: texte ?? '', enfants: [] };
  return touch(m, {
    lignes: m.lignes.map((l) =>
      l.id === ligneId
        ? { ...l, placards: insererIdee(l.placards, parentPlacardId, nouvelle) }
        : l),
  });
}

// Crée un morceau à partir d'un bloc de texte : une ligne (en travaux) par ligne
// non vide. Pour importer un texte depuis le bloc-notes.
export function morceauDepuisTexte(texte, titre = '') {
  const m = creerMorceau(titre);
  const lignes = String(texte).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    .map((t) => ({ id: uid(), texte: t, valide: false, test: false, placards: [] }));
  return { ...m, lignes, modifieLe: Date.now() };
}

// Range une ligne DANS une autre : la ligne source devient un essai (placard) de
// la ligne cible (ses propres placards deviennent des sous-essais). Pour le drag.
export function rangerDansLigne(m, sourceId, cibleId) {
  if (sourceId === cibleId) return m;
  const src = m.lignes.find((l) => l.id === sourceId);
  const cible = m.lignes.find((l) => l.id === cibleId);
  if (!src || !cible) return m;
  const idee = { id: uid(), texte: src.texte, enfants: src.placards };
  return touch(m, {
    lignes: m.lignes
      .filter((l) => l.id !== sourceId)
      .map((l) => (l.id === cibleId ? { ...l, placards: [...l.placards, idee] } : l)),
  });
}

// Retire l'idée du coffre et l'ajoute en nouvelle ligne en travaux en fin de m.
export function envoyerIdeeVersMorceau(coffre, ideeId, m) {
  const idee = coffre.find((i) => i.id === ideeId);
  const coffre2 = coffre.filter((i) => i.id !== ideeId);
  const morceau = idee ? ajouterLigne(m, idee.texte) : m;
  return { coffre: coffre2, morceau };
}
