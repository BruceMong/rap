import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { indexer } from '../js/dico.js';
import { clePhonetique, grouperRimes } from '../js/rimes.js';

const here = dirname(fileURLToPath(import.meta.url));
indexer(JSON.parse(readFileSync(join(here, '../data/lexique-min.json'), 'utf8')));

test('couplet : deux groupes [0,0,1,1]', () => {
  const vers = [
    "Le quartier s'endort, moi j'écris dans le noir",
    "Chaque phrase sur ma feuille, c'est un bout de mémoire",
    "Le beat tourne en boucle, je cherche la mesure",
    "Mes mots sur le papier, c'est ma seule armure",
  ];
  assert.deepEqual(grouperRimes(vers), [0, 0, 1, 1]);
});

test('vers vides → null (pas de rime)', () => {
  assert.deepEqual(grouperRimes(['', '  2024']), [null, null]); // Review Focus
});

test('clé ne dépend que du dernier mot (recalcul par ligne)', () => {
  assert.equal(clePhonetique('je marche dans le noir'), clePhonetique('tout en noir'));
  assert.ok(clePhonetique('tout en noir')); // Review Focus (incrémental)
});

test('clé null si pas de mot final alphabétique', () => {
  assert.equal(clePhonetique('2024 !!!'), null); // Review Focus (vers sans mot)
});
