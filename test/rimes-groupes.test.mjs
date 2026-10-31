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

test('voisins fusionnés riment : é/è, o, eu, un/in', () => {
  // é (vérité) et è (tickets) : le cas signalé par Bruce
  assert.equal(clePhonetique('deux tickets'), clePhonetique('moitié de vérité'));
  // o ouvert/fermé
  assert.equal(clePhonetique('une amazone'), clePhonetique('elle abandonne'));
  // eu ouvert/fermé
  assert.equal(clePhonetique('la peur'), clePhonetique('le abatteur'));
  // un/in (fusionnés en français standard)
  assert.equal(clePhonetique('un brun'), clePhonetique('un brin'));
});

test('ne fusionne pas les nasales entre elles (an ≠ on ≠ in)', () => {
  assert.notEqual(clePhonetique('le temps'), clePhonetique('le pont'));
  assert.notEqual(clePhonetique('le pont'), clePhonetique('le pain'));
});
