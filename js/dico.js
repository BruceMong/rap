// Accès au dictionnaire phonétique français (asset data/lexique-min.json).
// Isomorphe : indexer() prend l'objet parsé (tests Node), chargerDico() fetch (navigateur).

let MAP = new Map();

const ELISIONS = ["l'", "d'", "j'", "s'", "c'", "n'", "m'", "t'", "qu'"];

export function indexer(obj) {
  MAP = new Map(Object.entries(obj));
}

export function dicoPret() {
  return MAP.size > 0;
}

export function entrees() {
  return MAP;
}

export function normaliser(s) {
  return String(s).trim().toLowerCase().replace(/[’´`]/g, "'");
}

export function entree(mot) {
  const k = normaliser(mot);
  if (MAP.has(k)) return MAP.get(k);
  for (const e of ELISIONS) {
    if (k.startsWith(e)) {
      const reste = k.slice(e.length);
      if (MAP.has(reste)) return MAP.get(reste);
    }
  }
  return null;
}

export async function chargerDico(url = 'data/lexique-min.json') {
  if (dicoPret()) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`dico: ${res.status}`);
  indexer(await res.json());
}
