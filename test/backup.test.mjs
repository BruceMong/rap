import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  genererCle, definirCle, getCle, aCle, oublierCle, sauver, restaurer,
} from '../js/backup.js';

test('genererCle : longue, unique, groupée par tirets', () => {
  const a = genererCle();
  const b = genererCle();
  assert.ok(a.replace(/-/g, '').length >= 32);
  assert.notEqual(a, b);
  assert.match(a, /-/);
});

test('définir / lire / oublier la clé', () => {
  definirCle('abcde-abcde-abcde-abcde');
  assert.equal(aCle(), true);
  assert.equal(getCle(), 'abcde-abcde-abcde-abcde');
  oublierCle();
  assert.equal(aCle(), false);
});

test('sauver POST rap_sauver avec la clé et les données', async () => {
  let cap;
  globalThis.fetch = async (u, o) => { cap = { u, o }; return { ok: true, json: async () => '2026-10-30T00:00:00+00:00' }; };
  definirCle('abcde-abcde-abcde-abcde');
  const ts = await sauver({ morceaux: [{ id: 'm' }], coffre: [] });
  assert.ok(cap.u.endsWith('/rest/v1/rpc/rap_sauver'));
  const body = JSON.parse(cap.o.body);
  assert.equal(body.p_cle, 'abcde-abcde-abcde-abcde');
  assert.deepEqual(body.p_donnees, { morceaux: [{ id: 'm' }], coffre: [] });
  assert.equal(ts, '2026-10-30T00:00:00+00:00');
  oublierCle();
});

test('restaurer renvoie la 1re ligne, ou null si vide', async () => {
  definirCle('abcde-abcde-abcde-abcde');
  globalThis.fetch = async () => ({ ok: true, json: async () => [{ donnees: { morceaux: [{ id: 'x' }], coffre: [] }, modifie_le: 't' }] });
  const r = await restaurer();
  assert.equal(r.donnees.morceaux[0].id, 'x');
  globalThis.fetch = async () => ({ ok: true, json: async () => [] });
  assert.equal(await restaurer(), null);
  oublierCle();
});

test('sauver sans clé rejette', async () => {
  oublierCle();
  await assert.rejects(() => sauver({ morceaux: [], coffre: [] }));
});
