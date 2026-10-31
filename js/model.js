// Modèle de données et opérations pures (immuables) pour un morceau.
// Types :
//   Idee    = { id, texte, enfants: Idee[] }                 (un placard, récursif)
//   Ligne   = { id, texte, valide, test, placards: Idee[] }
//   Version = { id, nom, lignes: Ligne[], detaches: Idee[] }
//   Morceau = { id, titre, statut, ordre, versions: Version[], versionActiveId,
//               creeLe, modifieLe, epingle?, ouvertLe? }
// Les opérations sur les lignes agissent toujours sur la VERSION ACTIVE.

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function touch(m, patch) {
  return { ...m, ...patch, modifieLe: Date.now() };
}

// Migre un morceau d'avant les versions (lignes/detaches à la racine) vers le
// format versionné. Idempotent.
export function migrerMorceau(m) {
  if (m.versions) return m;
  const v = { id: uid(), nom: 'Version 1', lignes: m.lignes || [], detaches: m.detaches || [] };
  const { lignes, detaches, ...reste } = m;
  return { ...reste, versions: [v], versionActiveId: v.id };
}

export function versionActive(m) {
  const vs = m.versions || [];
  return vs.find((v) => v.id === m.versionActiveId) || vs[0];
}

function majActive(m, patch) {
  const id = m.versionActiveId;
  return touch({ ...m, versions: m.versions.map((v) => (v.id === id ? { ...v, ...patch } : v)) });
}

export function creerMorceau(titre) {
  const now = Date.now();
  const v = { id: uid(), nom: 'Version 1', lignes: [], detaches: [] };
  return {
    id: uid(), titre: titre ?? '', statut: 'en_cours', ordre: now,
    versions: [v], versionActiveId: v.id, creeLe: now, modifieLe: now,
  };
}

export function ajouterLigne(m, texte) {
  m = migrerMorceau(m);
  const va = versionActive(m);
  const ligne = { id: uid(), texte: texte ?? '', valide: false, test: false, placards: [] };
  return majActive(m, { lignes: [...va.lignes, ligne] });
}

export function modifierLigne(m, ligneId, texte) {
  m = migrerMorceau(m);
  return majActive(m, {
    lignes: versionActive(m).lignes.map((l) => (l.id === ligneId ? { ...l, texte } : l)),
  });
}

// États d'une ligne : brouillon → à tester (vert) → gardé/validé (jaune). valide et test s'excluent.
export function basculerValide(m, ligneId) {
  m = migrerMorceau(m);
  return majActive(m, {
    lignes: versionActive(m).lignes.map((l) => (l.id === ligneId
      ? { ...l, valide: !l.valide, test: l.valide ? l.test : false } : l)),
  });
}

export function basculerTest(m, ligneId) {
  m = migrerMorceau(m);
  return majActive(m, {
    lignes: versionActive(m).lignes.map((l) => (l.id === ligneId
      ? { ...l, test: !l.test, valide: l.test ? l.valide : false } : l)),
  });
}

export function insererLigneApres(m, ligneId, texte = '') {
  m = migrerMorceau(m);
  const lignes = [...versionActive(m).lignes];
  const i = lignes.findIndex((l) => l.id === ligneId);
  if (i < 0) return ajouterLigne(m, texte);
  lignes.splice(i + 1, 0, { id: uid(), texte, valide: false, test: false, placards: [] });
  return majActive(m, { lignes });
}

export function supprimerLigne(m, ligneId) {
  m = migrerMorceau(m);
  const va = versionActive(m);
  const l = va.lignes.find((x) => x.id === ligneId);
  const detaches = l && l.placards.length ? [...va.detaches, ...l.placards] : va.detaches;
  return majActive(m, { lignes: va.lignes.filter((x) => x.id !== ligneId), detaches });
}

// Déplace une ligne à l'index voulu (réordonnancement).
export function deplacerLigne(m, ligneId, index) {
  m = migrerMorceau(m);
  const lignes = [...versionActive(m).lignes];
  const from = lignes.findIndex((l) => l.id === ligneId);
  if (from < 0) return m;
  const [item] = lignes.splice(from, 1);
  const to = Math.max(0, Math.min(index, lignes.length));
  lignes.splice(to, 0, item);
  return majActive(m, { lignes });
}

function insererIdee(idees, parentId, nouvelle) {
  if (parentId === null) return [...idees, nouvelle];
  return idees.map((i) =>
    i.id === parentId
      ? { ...i, enfants: [...i.enfants, nouvelle] }
      : { ...i, enfants: insererIdee(i.enfants, parentId, nouvelle) });
}

export function ajouterPlacard(m, ligneId, texte, parentPlacardId = null) {
  m = migrerMorceau(m);
  const nouvelle = { id: uid(), texte: texte ?? '', enfants: [] };
  return majActive(m, {
    lignes: versionActive(m).lignes.map((l) =>
      l.id === ligneId
        ? { ...l, placards: insererIdee(l.placards, parentPlacardId, nouvelle) }
        : l),
  });
}

// Range une ligne DANS une autre : la source devient un essai (placard) de la cible.
export function rangerDansLigne(m, sourceId, cibleId) {
  if (sourceId === cibleId) return m;
  m = migrerMorceau(m);
  const va = versionActive(m);
  const src = va.lignes.find((l) => l.id === sourceId);
  const cible = va.lignes.find((l) => l.id === cibleId);
  if (!src || !cible) return m;
  const idee = { id: uid(), texte: src.texte, enfants: src.placards };
  return majActive(m, {
    lignes: va.lignes
      .filter((l) => l.id !== sourceId)
      .map((l) => (l.id === cibleId ? { ...l, placards: [...l.placards, idee] } : l)),
  });
}

// Crée un morceau à partir d'un bloc de texte (une ligne par ligne non vide).
export function morceauDepuisTexte(texte, titre = '') {
  const lignes = String(texte).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    .map((t) => ({ id: uid(), texte: t, valide: false, test: false, placards: [] }));
  return majActive(creerMorceau(titre), { lignes });
}

// --- versions ---
function nomVersionSuivant(m) { return 'Version ' + (m.versions.length + 1); }

export function creerVersion(m, nom) {
  m = migrerMorceau(m);
  const v = { id: uid(), nom: nom || nomVersionSuivant(m), lignes: [], detaches: [] };
  return touch({ ...m, versions: [...m.versions, v], versionActiveId: v.id });
}

// Nouvelle version repartant des seuls vers gardés (jaunes), qui restent gardés.
export function nouvelleVersionDepuisGardes(m) {
  m = migrerMorceau(m);
  const lignes = versionActive(m).lignes.filter((l) => l.valide)
    .map((l) => ({ id: uid(), texte: l.texte, valide: true, test: false, placards: [] }));
  const v = { id: uid(), nom: nomVersionSuivant(m), lignes, detaches: [] };
  return touch({ ...m, versions: [...m.versions, v], versionActiveId: v.id });
}

export function changerVersion(m, vId) {
  m = migrerMorceau(m);
  if (!m.versions.some((v) => v.id === vId)) return m;
  return touch({ ...m, versionActiveId: vId });
}

export function renommerVersion(m, vId, nom) {
  m = migrerMorceau(m);
  return touch({ ...m, versions: m.versions.map((v) => (v.id === vId ? { ...v, nom } : v)) });
}

export function supprimerVersion(m, vId) {
  m = migrerMorceau(m);
  if (m.versions.length <= 1) return m; // toujours garder au moins une version
  const versions = m.versions.filter((v) => v.id !== vId);
  const versionActiveId = m.versionActiveId === vId ? versions[0].id : m.versionActiveId;
  return touch({ ...m, versions, versionActiveId });
}

// Retire l'idée du coffre et l'ajoute en nouvelle ligne en travaux (version active).
export function envoyerIdeeVersMorceau(coffre, ideeId, m) {
  const idee = coffre.find((i) => i.id === ideeId);
  const coffre2 = coffre.filter((i) => i.id !== ideeId);
  const morceau = idee ? ajouterLigne(m, idee.texte) : m;
  return { coffre: coffre2, morceau };
}
