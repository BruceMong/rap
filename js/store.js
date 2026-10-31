// Persistance locale (IndexedDB) : morceaux + coffre d'idées, et export JSON.
const NOM = 'rap';
const VERSION = 2;
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
      // instrus (MP3) : un par morceau, hors backup (lourd). Clé = id du morceau.
      if (!db.objectStoreNames.contains('instrus')) db.createObjectStore('instrus', { keyPath: 'morceauId' });
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

// Instrus (MP3) : stockés comme ArrayBuffer + type, un par morceau. Hors backup/export.
export async function getInstru(morceauId) {
  return (await sur(() => attendre(store('instrus', 'readonly').get(morceauId)))) || null;
}
export function sauverInstru(instru) { return sur(() => attendre(store('instrus', 'readwrite').put(instru))); }
export function supprimerInstru(morceauId) { return sur(() => attendre(store('instrus', 'readwrite').delete(morceauId))); }

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
