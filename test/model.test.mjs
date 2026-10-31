import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerMorceau, ajouterLigne, modifierLigne, basculerValide,
  supprimerLigne, ajouterPlacard, envoyerIdeeVersMorceau, morceauDepuisTexte,
  rangerDansLigne, basculerTest, insererLigneApres, deplacerLigne,
  versionActive, migrerMorceau, creerVersion, nouvelleVersionDepuisGardes,
  changerVersion, renommerVersion, supprimerVersion,
} from '../js/model.js';

const L = (m) => versionActive(m).lignes;
const D = (m) => versionActive(m).detaches;

test('creerMorceau : en cours, une version vide', () => {
  const m = creerMorceau('Dernier métro');
  assert.equal(m.titre, 'Dernier métro');
  assert.equal(m.statut, 'en_cours');
  assert.equal(m.versions.length, 1);
  assert.deepEqual(L(m), []);
  assert.deepEqual(D(m), []);
});

test('ajouterLigne : ligne en travaux (valide false)', () => {
  const m = ajouterLigne(creerMorceau('t'), 'premier vers');
  assert.equal(L(m).length, 1);
  assert.equal(L(m)[0].texte, 'premier vers');
  assert.equal(L(m)[0].valide, false);
});

test('modifierLigne est immuable', () => {
  const m0 = ajouterLigne(creerMorceau('t'), 'a');
  const m1 = modifierLigne(m0, L(m0)[0].id, 'b');
  assert.equal(L(m1)[0].texte, 'b');
  assert.equal(L(m0)[0].texte, 'a');
});

test('basculerValide', () => {
  const m0 = ajouterLigne(creerMorceau('t'), 'a');
  const m1 = basculerValide(m0, L(m0)[0].id);
  assert.equal(L(m1)[0].valide, true);
});

test('supprimerLigne sans placard : rien dans les détachés', () => {
  const m0 = ajouterLigne(creerMorceau('t'), 'a');
  const m1 = supprimerLigne(m0, L(m0)[0].id);
  assert.equal(L(m1).length, 0);
  assert.deepEqual(D(m1), []);
});

test('supprimerLigne à placard : le brouillon est détaché, jamais perdu', () => {
  let m = ajouterLigne(creerMorceau('t'), 'a');
  m = ajouterPlacard(m, L(m)[0].id, 'un essai');
  m = supprimerLigne(m, L(m)[0].id);
  assert.equal(L(m).length, 0);
  assert.equal(D(m).length, 1);
  assert.equal(D(m)[0].texte, 'un essai');
});

test('ajouterPlacard et imbrication (idée dans l’idée)', () => {
  let m = ajouterLigne(creerMorceau('t'), 'a');
  m = ajouterPlacard(m, L(m)[0].id, 'parent');
  const parentId = L(m)[0].placards[0].id;
  m = ajouterPlacard(m, L(m)[0].id, 'enfant', parentId);
  assert.equal(L(m)[0].placards.length, 1);
  assert.equal(L(m)[0].placards[0].enfants.length, 1);
  assert.equal(L(m)[0].placards[0].enfants[0].texte, 'enfant');
});

test('morceauDepuisTexte : une ligne (en travaux) par ligne non vide', () => {
  const m = morceauDepuisTexte('Ligne un\n\n  Ligne deux  \n', 'Mon titre');
  assert.equal(m.titre, 'Mon titre');
  assert.equal(L(m).length, 2);
  assert.equal(L(m)[0].texte, 'Ligne un');
  assert.equal(L(m)[1].texte, 'Ligne deux');
});

test('basculerTest met l’état à tester (vert) et retire validé', () => {
  let m = ajouterLigne(creerMorceau('t'), 'a');
  const id = L(m)[0].id;
  m = basculerValide(m, id);
  assert.equal(L(m)[0].valide, true);
  m = basculerTest(m, id);
  assert.equal(L(m)[0].test, true);
  assert.equal(L(m)[0].valide, false);
  m = basculerValide(m, id);
  assert.equal(L(m)[0].valide, true);
  assert.equal(L(m)[0].test, false);
});

test('insererLigneApres : nouvelle ligne juste après la cible', () => {
  let m = ajouterLigne(ajouterLigne(creerMorceau('t'), 'A'), 'C');
  const a = L(m)[0];
  m = insererLigneApres(m, a.id, 'B');
  assert.deepEqual(L(m).map((l) => l.texte), ['A', 'B', 'C']);
});

test('deplacerLigne : réordonne', () => {
  let m = ajouterLigne(ajouterLigne(ajouterLigne(creerMorceau('t'), 'A'), 'B'), 'C');
  const c = L(m)[2];
  m = deplacerLigne(m, c.id, 0); // C en tête
  assert.deepEqual(L(m).map((l) => l.texte), ['C', 'A', 'B']);
});

test('rangerDansLigne : la source devient un essai de la cible', () => {
  let m = ajouterLigne(ajouterLigne(creerMorceau('t'), 'cible'), 'source');
  const [cible, source] = L(m);
  m = rangerDansLigne(m, source.id, cible.id);
  assert.equal(L(m).length, 1);
  assert.equal(L(m)[0].placards[0].texte, 'source');
});

test('envoyerIdeeVersMorceau : hors coffre, en ligne en travaux en fin', () => {
  const coffre = [{ id: 'i1', texte: 'image du métro', enfants: [] }];
  const r = envoyerIdeeVersMorceau(coffre, 'i1', creerMorceau('t'));
  assert.equal(r.coffre.length, 0);
  const derniere = L(r.morceau)[L(r.morceau).length - 1];
  assert.equal(derniere.texte, 'image du métro');
});

test('migrerMorceau : ancien format (lignes à la racine) → versionné', () => {
  const ancien = { id: 'x', titre: 'vieux', statut: 'en_cours', lignes: [{ id: 'l1', texte: 'a', valide: true, placards: [] }], detaches: [] };
  const m = migrerMorceau(ancien);
  assert.equal(m.versions.length, 1);
  assert.equal(L(m)[0].texte, 'a');
  assert.equal(m.lignes, undefined);
});

test('versions : créer, changer, renommer, supprimer', () => {
  let m = ajouterLigne(creerMorceau('t'), 'v1 ligne');
  const v1 = m.versionActiveId;
  m = creerVersion(m, 'brouillon B');
  assert.equal(m.versions.length, 2);
  assert.notEqual(m.versionActiveId, v1);        // la nouvelle est active
  assert.equal(L(m).length, 0);                   // version vide
  m = changerVersion(m, v1);
  assert.equal(L(m)[0].texte, 'v1 ligne');        // retour à la v1
  m = renommerVersion(m, v1, 'Intro');
  assert.equal(m.versions.find((v) => v.id === v1).nom, 'Intro');
  const autre = m.versions.find((v) => v.id !== v1).id;
  m = supprimerVersion(m, autre);
  assert.equal(m.versions.length, 1);
});

test('nouvelleVersionDepuisGardes : ne reprend que les vers gardés, qui restent jaunes', () => {
  let m = morceauDepuisTexte('garde moi\nbrouillon\ngarde moi 2', 't');
  m = basculerValide(m, L(m)[0].id);
  m = basculerValide(m, L(m)[2].id);
  m = nouvelleVersionDepuisGardes(m);
  assert.equal(L(m).length, 2);
  assert.deepEqual(L(m).map((l) => l.texte), ['garde moi', 'garde moi 2']);
  assert.ok(L(m).every((l) => l.valide));         // restent gardés (jaunes)
  assert.ok(L(m).every((l) => l.placards.length === 0));
});

test('supprimerVersion ne supprime jamais la dernière', () => {
  const m = creerMorceau('t');
  const r = supprimerVersion(m, m.versionActiveId);
  assert.equal(r.versions.length, 1);
});
