// Persistance locale (IndexedDB) : morceaux + coffre d'idées, et export JSON.
const NOM = 'rap';
const VERSION = 1;
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
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('morceaux')) db.createObjectStore('morceaux', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('coffre')) db.createObjectStore('coffre', { keyPath: 'id' });
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

export function listerMorceaux() { return attendre(store('morceaux', 'readonly').getAll()); }
export function getMorceau(id) { return attendre(store('morceaux', 'readonly').get(id)); }
export function sauverMorceau(m) { return attendre(store('morceaux', 'readwrite').put(m)); }
export function supprimerMorceau(id) { return attendre(store('morceaux', 'readwrite').delete(id)); }

export function getCoffre() { return attendre(store('coffre', 'readonly').getAll()); }

export function sauverCoffre(idees) {
  const st = store('coffre', 'readwrite');
  st.clear();
  for (const i of idees) st.put(i);
  return finTransaction(st);
}

export async function exporter() {
  const morceaux = await listerMorceaux();
  const coffre = await getCoffre();
  return JSON.stringify({ version: VERSION, exporteLe: new Date().toISOString(), morceaux, coffre }, null, 2);
}
