// Génère data/lexique-min.json depuis Lexique383.tsv (voir tools/README.md).
// Usage : node tools/build-dico.mjs [src.tsv] [out.json] [seuilFreq]
// Asset : { ortho: { p: phonèmes SAMPA, s: nb de syllabes } }.
// Script dev lancé à la main ; l'app ne le lance jamais (pas de build runtime).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const src = process.argv[2] || 'tools/.src/Lexique383.tsv';
const out = process.argv[3] || 'data/lexique-min.json';
const seuil = Number(process.argv[4] || 0); // somme freqfilms2+freqlivres mini

const VOYELLES = new Set([...'aAeEioOuy2°@9']); // + nasales ci-dessous
const NASALES = new Set(['5', '§', '1', '@~']); // approx ; nbsyll de Lexique prime

function compterVoyelles(phon) {
  let n = 0;
  for (const ch of phon) if (VOYELLES.has(ch) || NASALES.has(ch)) n++;
  return Math.max(1, n);
}

const lignes = readFileSync(src, 'utf8').split('\n');
lignes.shift(); // en-tête

const best = new Map(); // ortho -> { p, s, f }
for (const l of lignes) {
  if (!l) continue;
  const c = l.split('\t');
  const ortho = c[0];
  const phon = c[1];
  if (!ortho || !phon) continue;
  const f = (parseFloat(c[8]) || 0) + (parseFloat(c[9]) || 0);
  if (f < seuil) continue;
  const s = parseInt(c[23], 10) || compterVoyelles(phon);
  const prev = best.get(ortho);
  if (!prev || f > prev.f) best.set(ortho, { p: phon, s, f });
}

const obj = {};
for (const [k, v] of best) obj[k] = { p: v.p, s: v.s };

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(obj));
console.error(`${best.size} entrées écrites dans ${out}`);
