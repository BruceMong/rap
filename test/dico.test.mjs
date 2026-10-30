import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { indexer, entree, normaliser, dicoPret, entrees } from '../js/dico.js';

const here = dirname(fileURLToPath(import.meta.url));
const asset = JSON.parse(readFileSync(join(here, '../data/lexique-min.json'), 'utf8'));
indexer(asset);

test('entree("noir") rend ses phonèmes et 1 syllabe', () => {
  const e = entree('noir');
  assert.ok(e, 'noir doit exister');
  assert.equal(e.p, 'nwaR');
  assert.equal(e.s, 1);
});

test('entree("mémoire") rend 2 syllabes (valeur Lexique)', () => {
  assert.equal(entree('mémoire').s, 2);
});

test('normalisation : casse, apostrophe d’élision, espaces', () => {
  assert.ok(entree('Noir'), 'casse ignorée');
  assert.equal(entree("l'or").p, 'OR', 'élision l’ → or');
  assert.ok(entree('  or  '), 'espaces ôtés');
});

test('mot absent rend null', () => {
  assert.equal(entree('xyzqk'), null);
});

test('dicoPret vrai après indexation, entrees() non vide', () => {
  assert.equal(dicoPret(), true);
  assert.ok(entrees().size > 10000);
});

test('normaliser : minuscule + trim, accents conservés', () => {
  assert.equal(normaliser('  Mémoire '), 'mémoire');
});
