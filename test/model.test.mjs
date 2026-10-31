import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerMorceau, ajouterLigne, modifierLigne, basculerValide,
  supprimerLigne, ajouterPlacard, envoyerIdeeVersMorceau, morceauDepuisTexte,
  rangerDansLigne, basculerTest, insererLigneApres,
} from '../js/model.js';

test('creerMorceau : en cours, sans ligne ni détaché', () => {
  const m = creerMorceau('Dernier métro');
  assert.equal(m.titre, 'Dernier métro');
  assert.equal(m.statut, 'en_cours');
  assert.deepEqual(m.lignes, []);
  assert.deepEqual(m.detaches, []);
  assert.ok(m.id);
});

test('ajouterLigne : ligne en travaux (valide false)', () => {
  const m = ajouterLigne(creerMorceau('t'), 'premier vers');
  assert.equal(m.lignes.length, 1);
  assert.equal(m.lignes[0].texte, 'premier vers');
  assert.equal(m.lignes[0].valide, false);
});

test('modifierLigne est immuable', () => {
  const m0 = ajouterLigne(creerMorceau('t'), 'a');
  const m1 = modifierLigne(m0, m0.lignes[0].id, 'b');
  assert.equal(m1.lignes[0].texte, 'b');
  assert.equal(m0.lignes[0].texte, 'a'); // l'original n'a pas bougé
});

test('basculerValide', () => {
  const m0 = ajouterLigne(creerMorceau('t'), 'a');
  const m1 = basculerValide(m0, m0.lignes[0].id);
  assert.equal(m1.lignes[0].valide, true);
});

test('supprimerLigne sans placard : rien dans les détachés', () => {
  const m0 = ajouterLigne(creerMorceau('t'), 'a');
  const m1 = supprimerLigne(m0, m0.lignes[0].id);
  assert.equal(m1.lignes.length, 0);
  assert.deepEqual(m1.detaches, []);
});

test('supprimerLigne à placard : le brouillon est détaché, jamais perdu', () => {
  let m = ajouterLigne(creerMorceau('t'), 'a');
  m = ajouterPlacard(m, m.lignes[0].id, 'un essai');
  m = supprimerLigne(m, m.lignes[0].id);
  assert.equal(m.lignes.length, 0);
  assert.equal(m.detaches.length, 1);
  assert.equal(m.detaches[0].texte, 'un essai');
});

test('ajouterPlacard et imbrication (idée dans l’idée)', () => {
  let m = ajouterLigne(creerMorceau('t'), 'a');
  m = ajouterPlacard(m, m.lignes[0].id, 'parent');
  const parentId = m.lignes[0].placards[0].id;
  m = ajouterPlacard(m, m.lignes[0].id, 'enfant', parentId);
  assert.equal(m.lignes[0].placards.length, 1);
  assert.equal(m.lignes[0].placards[0].enfants.length, 1);
  assert.equal(m.lignes[0].placards[0].enfants[0].texte, 'enfant');
});

test('morceauDepuisTexte : une ligne (en travaux) par ligne non vide', () => {
  const m = morceauDepuisTexte('Ligne un\n\n  Ligne deux  \n', 'Mon titre');
  assert.equal(m.titre, 'Mon titre');
  assert.equal(m.lignes.length, 2);
  assert.equal(m.lignes[0].texte, 'Ligne un');
  assert.equal(m.lignes[1].texte, 'Ligne deux');
  assert.equal(m.lignes[0].valide, false);
  assert.ok(m.lignes[0].id && m.lignes[1].id !== m.lignes[0].id);
});

test('basculerTest met l’état à tester (vert) et retire validé', () => {
  let m = ajouterLigne(creerMorceau('t'), 'a');
  const id = m.lignes[0].id;
  m = basculerValide(m, id);          // jaune
  assert.equal(m.lignes[0].valide, true);
  m = basculerTest(m, id);            // passe en vert → retire jaune
  assert.equal(m.lignes[0].test, true);
  assert.equal(m.lignes[0].valide, false);
  m = basculerValide(m, id);          // repasse jaune → retire vert
  assert.equal(m.lignes[0].valide, true);
  assert.equal(m.lignes[0].test, false);
});

test('insererLigneApres : nouvelle ligne juste après la cible', () => {
  let m = ajouterLigne(ajouterLigne(creerMorceau('t'), 'A'), 'C');
  const [a] = m.lignes;
  m = insererLigneApres(m, a.id, 'B');
  assert.equal(m.lignes.length, 3);
  assert.equal(m.lignes[0].texte, 'A');
  assert.equal(m.lignes[1].texte, 'B');
  assert.equal(m.lignes[2].texte, 'C');
});

test('rangerDansLigne : la source devient un essai de la cible, retirée des lignes', () => {
  let m = ajouterLigne(ajouterLigne(creerMorceau('t'), 'cible'), 'source');
  const [cible, source] = m.lignes;
  m = rangerDansLigne(m, source.id, cible.id);
  assert.equal(m.lignes.length, 1);
  assert.equal(m.lignes[0].id, cible.id);
  assert.equal(m.lignes[0].placards.length, 1);
  assert.equal(m.lignes[0].placards[0].texte, 'source');
});

test('rangerDansLigne : emporte les placards de la source comme sous-essais', () => {
  let m = ajouterLigne(ajouterLigne(creerMorceau('t'), 'cible'), 'source');
  const [cible, source] = m.lignes;
  m = ajouterPlacard(m, source.id, 'variante de source');
  m = rangerDansLigne(m, source.id, cible.id);
  assert.equal(m.lignes[0].placards[0].enfants.length, 1);
  assert.equal(m.lignes[0].placards[0].enfants[0].texte, 'variante de source');
});

test('envoyerIdeeVersMorceau : hors coffre, en ligne en travaux en fin', () => {
  const idee = { id: 'i1', texte: 'image du métro', enfants: [] };
  const coffre = [idee];
  const m = creerMorceau('t');
  const r = envoyerIdeeVersMorceau(coffre, 'i1', m);
  assert.equal(r.coffre.length, 0);
  const derniere = r.morceau.lignes[r.morceau.lignes.length - 1];
  assert.equal(derniere.texte, 'image du métro');
  assert.equal(derniere.valide, false);
});
