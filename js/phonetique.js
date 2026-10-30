// Phonétisation d'un mot : dico d'abord, sinon règles graphème→phonème (G2P).
// Symboles SAMPA alignés sur Lexique (nasales § in=5 un=1 an=@, schwa °).
import { entree, normaliser } from './dico.js';

// Règles G2P, essayées par longueur décroissante (3 → 1). Approximatif mais
// plausible : sert de repli pour les mots hors-dico (argot, verlan, emprunts).
const REGLES = [
  ['eau', 'o'], ['oin', 'w5'], ['ain', '5'], ['ein', '5'],
  ['au', 'o'], ['ou', 'u'], ['oi', 'wa'], ['eu', '2'], ['œu', '2'],
  ['ai', 'E'], ['ei', 'E'], ['ch', 'S'], ['sh', 'S'], ['ph', 'f'],
  ['gn', 'N'], ['qu', 'k'], ['in', '5'], ['im', '5'], ['un', '1'],
  ['on', '§'], ['om', '§'], ['an', '@'], ['en', '@'], ['am', '@'], ['em', '@'],
  ['a', 'a'], ['â', 'a'], ['à', 'a'], ['e', '°'], ['é', 'e'], ['è', 'E'],
  ['ê', 'E'], ['ë', 'E'], ['i', 'i'], ['î', 'i'], ['ï', 'i'], ['o', 'o'],
  ['ô', 'o'], ['u', 'y'], ['û', 'y'], ['ù', 'y'], ['y', 'i'], ['ç', 's'],
  ['b', 'b'], ['c', 'k'], ['d', 'd'], ['f', 'f'], ['g', 'g'], ['h', ''],
  ['j', 'Z'], ['k', 'k'], ['l', 'l'], ['m', 'm'], ['n', 'n'], ['p', 'p'],
  ['q', 'k'], ['r', 'R'], ['s', 's'], ['t', 't'], ['v', 'v'], ['w', 'w'],
  ['x', 'ks'], ['z', 'z'],
];

export function g2p(mot) {
  const s = normaliser(mot);
  let out = '';
  let i = 0;
  while (i < s.length) {
    let matched = false;
    for (const [g, p] of REGLES) {
      if (s.startsWith(g, i)) {
        out += p;
        i += g.length;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1; // caractère non géré (chiffre, ponctuation) : ignoré
  }
  return out;
}

export function phonemiser(mot) {
  const e = entree(mot);
  if (e) return e.p;
  return g2p(mot);
}
