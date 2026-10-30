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
