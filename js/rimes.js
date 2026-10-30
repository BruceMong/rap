// Rimes : richesse, groupes de rimes d'un texte, moteur de recherche.
import { phonemiser, g2p } from './phonetique.js';
import { entree, normaliser, entrees } from './dico.js';

const VOYELLES = new Set([...'aAeEioOuy29@°5§1']);

function suffixeCommun(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return a.slice(a.length - n);
}

function contientVoyelle(phon) {
  for (const ch of phon) if (VOYELLES.has(ch)) return true;
  return false;
}

function dernierMot(vers) {
  const t = String(vers).toLowerCase().replace(/[’´`]/g, "'")
    .match(/[a-zà-ÿœ]+(?:'[a-zà-ÿœ]+)*/g);
  return t ? t[t.length - 1] : null;
}

// Terminaison rimique du dernier mot : de la dernière voyelle à la fin.
// null si pas de mot final alphabétique ou pas de voyelle. Ne dépend que du
// dernier mot → recalcul par ligne côté UI.
export function clePhonetique(vers) {
  const mot = dernierMot(vers);
  if (!mot) return null;
  const p = phonemiser(mot);
  for (let i = p.length - 1; i >= 0; i--) {
    if (VOYELLES.has(p[i])) return p.slice(i);
  }
  return null;
}

// Index de groupe par terminaison partagée (1re clé → 0, etc.), null sinon.
export function grouperRimes(vers) {
  const map = new Map();
  let next = 0;
  return vers.map((v) => {
    const c = clePhonetique(v);
    if (c === null) return null;
    if (!map.has(c)) map.set(c, next++);
    return map.get(c);
  });
}

// 'aucune' | 'pauvre' | 'suffisante' | 'riche'
export function classerRime(motA, motB) {
  if (normaliser(motA) === normaliser(motB)) return 'aucune';
  const pa = phonemiser(motA);
  const pb = phonemiser(motB);
  if (!pa || !pb) return 'aucune';
  const s = suffixeCommun(pa, pb);
  if (!contientVoyelle(s)) return 'aucune';
  if (s.length >= 3) return 'riche';
  if (s.length === 2) return 'suffisante';
  return 'pauvre';
}
