import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { indexer } from '../js/dico.js';
import { compterPieds } from '../js/syllabes.js';

const here = dirname(fileURLToPath(import.meta.url));
indexer(JSON.parse(readFileSync(join(here, '../data/lexique-min.json'), 'utf8')));

test('mot seul connu', () => {
  assert.equal(compterPieds('noir'), 1);
});

test('somme des mots (la=1 + mémoire=2)', () => {
  assert.equal(compterPieds('la mémoire'), 3);
});

test('gère l’élision (j’écris = écris = 2)', () => {
  assert.equal(compterPieds("j'écris"), 2);
});

test('mot hors-dico via G2P (zoba → z o b a = 2 voyelles)', () => {
  assert.equal(compterPieds('zoba'), 2);
});

test('vers vide ou sans mot alphabétique → 0', () => {
  assert.equal(compterPieds(''), 0);        // Review Focus
  assert.equal(compterPieds('2024 !!!'), 0); // Review Focus
});
