import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ouvrir, sauverMorceau, getMorceau, listerMorceaux,
  sauverCoffre, getCoffre, exporter, etat, remplacer,
  getInstrus, sauverInstru, supprimerInstru, StockageIndisponible,
  listerInstrus, getInstru, getInstrusDuMorceau, migrerBibliothequeInstrus,
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

test('instrus : plusieurs par morceau, exclus de l’état', async () => {
  await ouvrir();
  const buf = new TextEncoder().encode('fausse-instru').buffer;
  await sauverInstru({ id: 'i1', morceauId: 'm9', nom: 'beat.mp3', type: 'audio/mpeg', buf, mode: 'normal', loopA: 0, loopB: 0 });
  await sauverInstru({ id: 'i2', morceauId: 'm9', nom: 'autre.mp3', type: 'audio/mpeg', buf, mode: 'boucle', loopA: 1, loopB: 2 });
  const list = await getInstrus('m9');
  assert.equal(list.length, 2);
  assert.ok(list.some((x) => x.nom === 'autre.mp3'));
  const e = await etat();
  assert.ok(!('instrus' in e)); // les MP3 ne partent pas dans la sauvegarde
  await supprimerInstru('i1');
  assert.equal((await getInstrus('m9')).length, 1);
});

test('bibliothèque : un instru partagé par deux morceaux, lu via getInstrusDuMorceau', async () => {
  await ouvrir();
  const buf = new TextEncoder().encode('x').buffer;
  await sauverInstru({ id: 'lib1', nom: 'solo.mp3', type: 'audio/mpeg', buf, mode: 'normal', loopA: 0, loopB: 0, morceauIds: ['mA', 'mB'] });
  const tous = await listerInstrus();
  assert.ok(tous.some((x) => x.id === 'lib1'));
  assert.equal((await getInstru('lib1')).nom, 'solo.mp3');
  assert.ok((await getInstrusDuMorceau('mA')).some((x) => x.id === 'lib1'));
  assert.ok((await getInstrusDuMorceau('mB')).some((x) => x.id === 'lib1'));
  assert.equal((await getInstrusDuMorceau('mZ')).length, 0);
});

test('migration : instru legacy (morceauId) → morceauIds, idempotent', async () => {
  await ouvrir();
  const buf = new TextEncoder().encode('x').buffer;
  await sauverInstru({ id: 'g1', morceauId: 'mg1', nom: 'a.mp3', type: 'audio/mpeg', buf, mode: 'normal', loopA: 0, loopB: 0 });

  await migrerBibliothequeInstrus();
  const g = await getInstru('g1');
  assert.deepEqual(g.morceauIds, ['mg1']);
  assert.equal(g.morceauId, undefined); // ancien champ effacé

  await migrerBibliothequeInstrus(); // 2e passage : ne touche à rien
  assert.deepEqual((await getInstru('g1')).morceauIds, ['mg1']);
});
