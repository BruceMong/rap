import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { indexer } from '../js/dico.js';
import { classerRime } from '../js/rimes.js';

const here = dirname(fileURLToPath(import.meta.url));
indexer(JSON.parse(readFileSync(join(here, '../data/lexique-min.json'), 'utf8')));

test('riche : noir / mémoire (waR, 3 phonèmes)', () => {
  assert.equal(classerRime('noir', 'mémoire'), 'riche');
});

test('suffisante : mesure / armure (yR, 2 phonèmes)', () => {
  assert.equal(classerRime('mesure', 'armure'), 'suffisante');
});

test('pauvre : chat / rat (a, 1 voyelle)', () => {
  assert.equal(classerRime('chat', 'rat'), 'pauvre');
});

test('aucune : noir / table (rien de commun en fin)', () => {
  assert.equal(classerRime('noir', 'table'), 'aucune');
});

test('aucune : un mot avec lui-même', () => {
  assert.equal(classerRime('mot', 'mot'), 'aucune');
});

test('aucune : consonne finale commune sans voyelle (roc / bac)', () => {
  assert.equal(classerRime('roc', 'bac'), 'aucune');
});
