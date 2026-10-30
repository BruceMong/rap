// Compte les pieds (syllabes) d'un vers : syllabes du dico si le mot est connu,
// sinon nombre de voyelles de sa phonétisation G2P.
import { entree } from './dico.js';
import { phonemiser } from './phonetique.js';

// Voyelles SAMPA (Lexique) : orales + nasales (5 in, § on, 1 un, @ an) + schwa °.
// Les semi-voyelles j w 8 ne forment pas de syllabe.
const VOYELLES = new Set([...'aAeEioOuy29@°5§1']);

function voyellesDe(phon) {
  let n = 0;
  for (const ch of phon) if (VOYELLES.has(ch)) n++;
  return n;
}

function syllabesMot(mot) {
  const e = entree(mot);
  if (e) return e.s;
  return voyellesDe(phonemiser(mot));
}

export function compterPieds(vers) {
  const tokens = String(vers).toLowerCase().replace(/[’´`]/g, "'")
    .match(/[a-zà-ÿœ]+(?:'[a-zà-ÿœ]+)*/g);
  if (!tokens) return 0;
  return tokens.reduce((n, m) => n + syllabesMot(m), 0);
}
