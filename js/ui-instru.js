// Lecteur d'instru d'un morceau : barre fixe en bas (hors zone redessinée pour
// ne pas couper la lecture), mode normal (tout en boucle) ou boucle A–B.
import { getInstru, sauverInstru, supprimerInstru } from './store.js';
import { esc } from './ui-util.js';

let courantId = null;
let instru = null; // { morceauId, nom, type, buf, mode:'normal'|'boucle', loopA, loopB }
let audio = null;
let url = null;

function fmt(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return m + ':' + String(ss).padStart(2, '0');
}
function sauvegarder() { if (instru) sauverInstru(instru).catch(() => {}); }

export async function monterInstru(morceauId) {
  if (courantId === morceauId && document.getElementById('barre-instru')) return;
  demonterInstru();
  courantId = morceauId;
  instru = await getInstru(morceauId);
  rendre();
}

export function demonterInstru() {
  if (audio) { try { audio.pause(); } catch { /* ignore */ } }
  if (url) { URL.revokeObjectURL(url); url = null; }
  audio = null; instru = null; courantId = null;
  const b = document.getElementById('barre-instru');
  if (b) b.remove();
}

function resetAudio() {
  if (audio) { try { audio.pause(); } catch { /* ignore */ } }
  if (url) { URL.revokeObjectURL(url); url = null; }
  audio = null;
}

async function chargerFichier(e) {
  const f = e.target.files[0];
  if (!f) return;
  const buf = await f.arrayBuffer();
  instru = { morceauId: courantId, nom: f.name, type: f.type || 'audio/mpeg', buf, mode: 'normal', loopA: 0, loopB: 0 };
  await sauverInstru(instru);
  resetAudio();
  rendre();
}

function assurerAudio() {
  if (audio || !instru) return;
  url = URL.createObjectURL(new Blob([instru.buf], { type: instru.type || 'audio/mpeg' }));
  audio = new Audio(url);
  audio.loop = instru.mode === 'normal';
  audio.addEventListener('loadedmetadata', () => {
    if (!instru.loopB || instru.loopB <= 0) { instru.loopB = audio.duration; sauvegarder(); }
    peindre();
  });
  audio.addEventListener('timeupdate', () => {
    if (instru.mode === 'boucle' && audio.currentTime >= instru.loopB) {
      audio.currentTime = instru.loopA;
      if (audio.paused) audio.play().catch(() => {});
    }
    peindre();
  });
  audio.addEventListener('play', peindre);
  audio.addEventListener('pause', peindre);
}

function rendre() {
  let b = document.getElementById('barre-instru');
  if (!b) { b = document.createElement('div'); b.id = 'barre-instru'; b.className = 'barre-instru'; document.body.appendChild(b); }

  if (!instru) {
    b.innerHTML = '<button class="instru-add" id="instru-add">♫ ajouter un instru</button>'
      + '<input type="file" id="instru-file" accept="audio/*" hidden>';
    b.querySelector('#instru-add').onclick = () => b.querySelector('#instru-file').click();
    b.querySelector('#instru-file').onchange = chargerFichier;
    return;
  }

  assurerAudio();
  const boucle = instru.mode === 'boucle';
  b.innerHTML = `
    <div class="instru-ligne">
      <button class="instru-btn" id="pp">▶</button>
      <input type="range" id="seek" min="0" max="100" step="0.1" value="0" class="instru-seek">
      <span class="instru-temps" id="temps">0:00</span>
      <button class="instru-btn ${boucle ? 'actif' : ''}" id="mode">${boucle ? 'boucle' : 'normal'}</button>
      <button class="instru-btn" id="retirer" title="retirer">✕</button>
    </div>
    ${boucle ? `<div class="instru-ligne instru-loop">
      <span class="instru-temps">A <b id="va">${fmt(instru.loopA)}</b> · B <b id="vb">${fmt(instru.loopB)}</b></span>
      <button class="instru-btn" id="poseA">A = ici</button>
      <button class="instru-btn" id="poseB">B = ici</button>
      <button class="instru-btn" id="versA">↺ A</button>
    </div>` : ''}
    <div class="instru-nom">${esc(instru.nom)}</div>`;

  b.querySelector('#pp').onclick = () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
  b.querySelector('#seek').oninput = (e) => { if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration; };
  b.querySelector('#mode').onclick = () => {
    instru.mode = boucle ? 'normal' : 'boucle';
    audio.loop = instru.mode === 'normal';
    sauvegarder();
    rendre();
  };
  b.querySelector('#retirer').onclick = async () => {
    resetAudio();
    await supprimerInstru(courantId);
    instru = null;
    rendre();
  };
  if (boucle) {
    b.querySelector('#poseA').onclick = () => { instru.loopA = audio.currentTime; if (instru.loopB <= instru.loopA) instru.loopB = audio.duration; sauvegarder(); peindre(); };
    b.querySelector('#poseB').onclick = () => { instru.loopB = Math.max(audio.currentTime, instru.loopA + 0.1); sauvegarder(); peindre(); };
    b.querySelector('#versA').onclick = () => { audio.currentTime = instru.loopA; };
  }
  peindre();
}

function peindre() {
  const b = document.getElementById('barre-instru');
  if (!b || !audio) return;
  const pp = b.querySelector('#pp'); if (pp) pp.textContent = audio.paused ? '▶' : '⏸';
  const dur = audio.duration || 0;
  const seek = b.querySelector('#seek'); if (seek && dur) seek.value = (audio.currentTime / dur) * 100;
  const t = b.querySelector('#temps'); if (t) t.textContent = `${fmt(audio.currentTime)} / ${fmt(dur)}`;
  const va = b.querySelector('#va'); if (va) va.textContent = fmt(instru.loopA);
  const vb = b.querySelector('#vb'); if (vb) vb.textContent = fmt(instru.loopB);
}
