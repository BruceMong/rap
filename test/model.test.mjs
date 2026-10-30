import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerMorceau, ajouterLigne, modifierLigne, basculerValide,
  supprimerLigne, ajouterPlacard, envoyerIdeeVersMorceau,
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
