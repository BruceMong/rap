import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { indexer, entree } from '../js/dico.js';
import { phonemiser, g2p } from '../js/phonetique.js';

const here = dirname(fileURLToPath(import.meta.url));
indexer(JSON.parse(readFileSync(join(here, '../data/lexique-min.json'), 'utf8')));

test('mot connu : phonemiser passe par le dico', () => {
  assert.equal(phonemiser('armure'), entree('armure').p);
});

test('g2p lettres de base', () => {
  assert.equal(g2p('taba'), 'taba');
});

test('g2p digrammes ch→S, ou→u', () => {
  assert.equal(g2p('chou'), 'Su');
});

test('g2p ignore chiffres et vide', () => {
  assert.equal(g2p(''), '');
  assert.equal(g2p('123'), '');
});

test('mot hors-dico (argot) : phonemiser ne plante pas, rend du non-vide', () => {
  assert.ok(phonemiser('zzzglx').length > 0); // Review Focus
  assert.ok(phonemiser('wesh').length > 0);
});

test('phonemiser("") et sur ponctuation rend ""', () => {
  assert.equal(phonemiser(''), '');
  assert.equal(phonemiser('!!!'), '');
});
