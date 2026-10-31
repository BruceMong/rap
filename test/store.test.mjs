import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ouvrir, sauverMorceau, getMorceau, listerMorceaux,
  sauverCoffre, getCoffre, exporter, etat, remplacer,
  getInstru, sauverInstru, supprimerInstru, StockageIndisponible,
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

test('etat() renvoie morceaux + coffre, remplacer() restaure tout', async () => {
  await ouvrir();
  await sauverMorceau({ id: 'z1', titre: 'Avant', lignes: [], detaches: [] });
  await sauverCoffre([{ id: 'c1', texte: 'idée', enfants: [] }]);
  const e = await etat();
  assert.ok(e.morceaux.some((m) => m.id === 'z1'));

  await remplacer({ version: 1, morceaux: [{ id: 'z2', titre: 'Après', lignes: [], detaches: [] }], coffre: [] });
  const ms = await listerMorceaux();
  assert.ok(ms.some((m) => m.id === 'z2'));
  assert.ok(!ms.some((m) => m.id === 'z1')); // l'ancien a été remplacé
  assert.equal((await getCoffre()).length, 0);
});

test('instru : aller-retour et suppression, exclu de l’état', async () => {
  await ouvrir();
  const buf = new TextEncoder().encode('fausse-instru').buffer;
  await sauverInstru({ morceauId: 'm9', nom: 'beat.mp3', type: 'audio/mpeg', buf, mode: 'normal', loopA: 0, loopB: 0 });
  const i = await getInstru('m9');
  assert.equal(i.nom, 'beat.mp3');
  assert.ok(i.buf);
  const e = await etat();
  assert.ok(!('instrus' in e)); // les MP3 ne partent pas dans la sauvegarde
  await supprimerInstru('m9');
  assert.equal(await getInstru('m9'), null);
});
