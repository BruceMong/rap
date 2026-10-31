// Persistance locale (IndexedDB) : morceaux + coffre d'idées, et export JSON.
const NOM = 'rap';
const VERSION = 4;
let DB = null;

export class StockageIndisponible extends Error {
  constructor() {
    super('Stockage local indisponible');
    this.name = 'StockageIndisponible';
  }
}

export function ouvrir(idb = (typeof globalThis !== 'undefined' ? globalThis.indexedDB : undefined)) {
  return new Promise((resolve, reject) => {
    if (!idb) { reject(new StockageIndisponible()); return; }
    const req = idb.open(NOM, VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('morceaux')) db.createObjectStore('morceaux', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('coffre')) db.createObjectStore('coffre', { keyPath: 'id' });
      // instrus (MP3, hors backup) : v3 → plusieurs par morceau. Clé = id propre,
      // index sur morceauId. (La v2 n'en gardait qu'un ; recréé ici.)
      if (ev.oldVersion < 3 && db.objectStoreNames.contains('instrus')) db.deleteObjectStore('instrus');
      if (!db.objectStoreNames.contains('instrus')) {
        const s = db.createObjectStore('instrus', { keyPath: 'id' });
        s.createIndex('parMorceau', 'morceauId', { unique: false });
      }
      // sons (pads/ad-libs, hors backup) : banque globale commune à tous les
      // morceaux, v4. Un son = { id, nom, type, buf, ordre, creeLe }.
      if (!db.objectStoreNames.contains('sons')) db.createObjectStore('sons', { keyPath: 'id' });
    };
    req.onsuccess = () => { DB = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}

function store(nom, mode) {
  return DB.transaction(nom, mode).objectStore(nom);
}

function attendre(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function finTransaction(st) {
  return new Promise((res, rej) => {
    st.transaction.oncomplete = () => res();
    st.transaction.onerror = () => rej(st.transaction.error);
  });
}

// Enveloppe une opération de store : une erreur synchrone (ex. donnée non
// clonable) devient un rejet, pour être catchée comme un échec async (quota).
function sur(fn) {
  try { return fn(); } catch (e) { return Promise.reject(e); }
}

export function listerMorceaux() { return sur(() => attendre(store('morceaux', 'readonly').getAll())); }
export function getMorceau(id) { return sur(() => attendre(store('morceaux', 'readonly').get(id))); }
export function sauverMorceau(m) { return sur(() => attendre(store('morceaux', 'readwrite').put(m))); }
export function supprimerMorceau(id) { return sur(() => attendre(store('morceaux', 'readwrite').delete(id))); }

export function getCoffre() { return sur(() => attendre(store('coffre', 'readonly').getAll())); }

export function sauverCoffre(idees) {
  return sur(() => {
    const st = store('coffre', 'readwrite');
    st.clear();
    for (const i of idees) st.put(i);
    return finTransaction(st);
  });
}

// L'état complet (textes seulement, pas les instrus/MP3), pour export et backup.
export async function etat() {
  const morceaux = await listerMorceaux();
  const coffre = await getCoffre();
  return { version: VERSION, morceaux, coffre };
}

export async function exporter() {
  return JSON.stringify({ ...(await etat()), exporteLe: new Date().toISOString() }, null, 2);
}

// Instrus (MP3, ArrayBuffer + type) : bibliothèque partagée, hors backup/export.
// Un instru = { id, nom, type, buf, mode, loopA, loopB, source?, morceauIds:[], creeLe? }.
// L'attribution (quels morceaux l'utilisent) vit SUR l'instru (morceauIds), pas
// sur le morceau : les instrus sont écrits seulement d'ici, donc jamais écrasés
// par la sauvegarde débouncée de l'éditeur de texte. Le réglage de boucle vit
// aussi sur l'instru → partagé par tous les morceaux qui l'utilisent.
export function listerInstrus() { return sur(() => attendre(store('instrus', 'readonly').getAll())); }
export function getInstru(id) { return sur(() => attendre(store('instrus', 'readonly').get(id))); }
export function sauverInstru(instru) { return sur(() => attendre(store('instrus', 'readwrite').put(instru))); }
export function supprimerInstru(id) { return sur(() => attendre(store('instrus', 'readwrite').delete(id))); }

// Instrus attribués à un morceau (lus depuis la bibliothèque).
export async function getInstrusDuMorceau(morceauId) {
  return (await listerInstrus()).filter((i) => (i.morceauIds || []).includes(morceauId));
}

// Legacy : ancien index « un instru par morceau » (sert à la rétrocompat des
// données pas encore migrées). Remplacé par getInstrusDuMorceau.
export function getInstrus(morceauId) {
  return sur(() => new Promise((res, rej) => {
    const req = store('instrus', 'readonly').index('parMorceau').getAll(IDBKeyRange.only(morceauId));
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  }));
}

// Migration v2/v3 → bibliothèque : l'ancien champ instru.morceauId (singulier,
// un seul morceau) devient instru.morceauIds (liste). Idempotent : un instru déjà
// migré (plus de morceauId) est ignoré.
export async function migrerBibliothequeInstrus() {
  const aMigrer = (await listerInstrus()).filter((i) => i.morceauId && !i.morceauIds);
  if (!aMigrer.length) return;
  for (const i of aMigrer) {
    i.morceauIds = [i.morceauId];
    delete i.morceauId;
    await sauverInstru(i);
  }
}

// Sons des pads (ad-libs/effets, ArrayBuffer + type) : banque globale commune à
// tous les morceaux, hors backup/export. Joués en direct par-dessus l'instru.
export function listerSons() { return sur(() => attendre(store('sons', 'readonly').getAll())); }
export function sauverSon(s) { return sur(() => attendre(store('sons', 'readwrite').put(s))); }
export function supprimerSon(id) { return sur(() => attendre(store('sons', 'readwrite').delete(id))); }

// Remplace entièrement les morceaux et le coffre par ceux d'un état (restauration).
export function remplacer(e) {
  return sur(async () => {
    const st = store('morceaux', 'readwrite');
    st.clear();
    for (const m of (e.morceaux || [])) st.put(m);
    await finTransaction(st);
    await sauverCoffre(e.coffre || []);
  });
}
