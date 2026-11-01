// Waveform (spectre de volume) : décode un son et dessine ses crêtes sur un canvas.
// Partagé par « Mes instrus » et l'éditeur de pads. Un seul AudioContext, et un
// cache des crêtes par clé pour ne pas re-décoder à chaque redessin.
let ctx = null;
const cache = new Map(); // cle -> { peaks, duree }

function ac() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC(); }
  return ctx;
}

// Décode un ArrayBuffer audio → { peaks: Float[0..1] (longueur n), duree (s) }.
// `cle` sert au cache (ex. id du son/instru). decodeAudioData détache le buffer :
// on clone pour garder l'original réutilisable.
export async function calculerPeaks(cle, buf, type, n = 240) {
  if (cle && cache.has(cle)) return cache.get(cle);
  const audio = await ac().decodeAudioData(buf.slice(0));
  const data = audio.getChannelData(0);
  const taille = Math.max(1, Math.floor(data.length / n));
  const peaks = new Array(n);
  for (let i = 0; i < n; i++) {
    let max = 0;
    const deb = i * taille;
    for (let j = 0; j < taille; j++) { const v = Math.abs(data[deb + j] || 0); if (v > max) max = v; }
    peaks[i] = max;
  }
  const res = { peaks, duree: audio.duration };
  if (cle) cache.set(cle, res);
  return res;
}

export function oublier(cle) { cache.delete(cle); }

function cssVar(nom, repli) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(nom).trim() || repli; }
  catch { return repli; }
}

// Dessine les crêtes. opts : { trim:[a,b] fractions 0..1 (zone active en couleur,
// le reste estompé), boucle:[a,b] fractions (traits verticaux), progres:0..1 }.
export function dessiner(canvas, peaks, opts = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 54;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const couleur = cssVar('--accent', '#e3b505');
  const estompe = cssVar('--muted', '#6b6659');
  const n = peaks.length;
  const bw = w / n;
  const mid = h / 2;
  for (let i = 0; i < n; i++) {
    const frac = (i + 0.5) / n;
    const dans = !opts.trim || (frac >= opts.trim[0] && frac <= opts.trim[1]);
    g.globalAlpha = dans ? 1 : 0.3;
    g.fillStyle = dans ? couleur : estompe;
    const ph = Math.max(1, peaks[i] * (h * 0.92));
    g.fillRect(i * bw, mid - ph / 2, Math.max(1, bw - 0.5), ph);
  }
  g.globalAlpha = 1;
  if (opts.boucle) {
    g.fillStyle = couleur;
    for (const f of opts.boucle) { if (f > 0 && f < 1) g.fillRect(Math.round(f * w) - 1, 0, 2, h); }
  }
  if (typeof opts.progres === 'number' && opts.progres >= 0) {
    g.fillStyle = cssVar('--fg', '#1d1b16');
    g.fillRect(Math.round(opts.progres * w) - 1, 0, 2, h);
  }
}
