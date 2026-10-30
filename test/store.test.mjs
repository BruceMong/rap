import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ouvrir, sauverMorceau, getMorceau, listerMorceaux,
  sauverCoffre, getCoffre, exporter, StockageIndisponible,
} from '../js/store.js';

test('ouvre et fait l’aller-retour d’un morceau', async () => {
  await ouvrir();
  await sauverMorceau({ id: 'm1', titre: 'Dernier métro', lignes: [], detaches: [] });
  const m = await getMorceau('m1');
  assert.equal(m.titre, 'Dernier métro');
  const tous = await listerMorceaux();
  assert.ok(tous.some((x) => x.id === 'm1'));
});

test('aller-retour du coffre', async () => {
  await ouvrir();
  await sauverCoffre([{ id: 'i1', texte: 'image du métro', enfants: [] }]);
  const c = await getCoffre();
  assert.equal(c.length, 1);
  assert.equal(c[0].texte, 'image du métro');
});

test('exporter rend un JSON reparsable avec morceaux et coffre', async () => {
  await ouvrir();
  const o = JSON.parse(await exporter());
  assert.ok(Array.isArray(o.morceaux));
  assert.ok(Array.isArray(o.coffre));
});

test('sans IndexedDB, ouvrir rejette StockageIndisponible', async () => {
  await assert.rejects(() => ouvrir(null), StockageIndisponible); // Review Focus
});

test('une écriture qui échoue est propagée (pas avalée), pour être signalée', async () => {
  await ouvrir();
  // un objet non clonable (fonction) déclenche une DataCloneError côté store
  await assert.rejects(() => sauverMorceau({ id: 'bad', f: () => {} })); // Review Focus #4
});
