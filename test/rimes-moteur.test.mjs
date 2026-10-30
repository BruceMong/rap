import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { indexer } from '../js/dico.js';
import { trouverRimes } from '../js/rimes.js';

const here = dirname(fileURLToPath(import.meta.url));
indexer(JSON.parse(readFileSync(join(here, '../data/lexique-min.json'), 'utf8')));

const RANG = { riche: 3, suffisante: 2, pauvre: 1 };

test('trouverRimes("noir") propose "mémoire"', () => {
  const r = trouverRimes('noir');
  assert.ok(r.some((x) => x.mot === 'mémoire'));
});

test('aucune entrée de richesse "aucune", et le mot lui-même exclu', () => {
  const r = trouverRimes('noir');
  assert.ok(r.length > 0);
  assert.ok(r.every((x) => x.richesse !== 'aucune'));
  assert.ok(!r.some((x) => x.mot === 'noir'));
});

test('trié par richesse décroissante puis pieds croissants', () => {
  const r = trouverRimes('noir');
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i];
    assert.ok(
      RANG[a.richesse] > RANG[b.richesse] ||
      (RANG[a.richesse] === RANG[b.richesse] && a.pieds <= b.pieds),
    );
  }
});

test('chaque entrée porte mot, richesse, pieds', () => {
  const x = trouverRimes('noir')[0];
  assert.equal(typeof x.mot, 'string');
  assert.ok('richesse' in x);
  assert.equal(typeof x.pieds, 'number');
});
