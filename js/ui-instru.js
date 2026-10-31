// Lecteur d'instru d'un morceau : barre fixe en bas (hors zone redessinée).
// Plusieurs instrus par morceau avec sélecteur ; mode normal ou boucle A–B.
import { getInstrus, sauverInstru, supprimerInstru } from './store.js';
import { uid } from './model.js';
import { esc } from './ui-util.js';

let courantId = null; // morceauId
let liste = [];        // instrus du morceau
let instru = null;     // instru actif
let audio = null;
let url = null;

function cleActif(mid) { return 'rap.instruActif.' + mid; }
function lireActif(mid) { try { return localStorage.getItem(cleActif(mid)); } catch { return null; } }
function ecrireActif(mid, id) {
  try { if (id) localStorage.setItem(cleActif(mid), id); else localStorage.removeItem(cleActif(mid)); } catch { /* ignore */ }
}

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
  liste = await getInstrus(morceauId);
  const actifId = lireActif(morceauId);
  instru = liste.find((i) => i.id === actifId) || liste[0] || null;
  if (instru) ecrireActif(morceauId, instru.id);
  rendre();
}

export function demonterInstru() {
  resetAudio();
  instru = null; liste = []; courantId = null;
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
  const nouv = { id: uid(), morceauId: courantId, nom: f.name, type: f.type || 'audio/mpeg', buf, mode: 'normal', loopA: 0, loopB: 0 };
  await sauverInstru(nouv);
  liste.push(nouv);
  instru = nouv;
  ecrireActif(courantId, nouv.id);
  resetAudio();
  rendre();
}

function changerActif(id) {
  const i = liste.find((x) => x.id === id);
  if (!i) return;
  instru = i;
  ecrireActif(courantId, id);
  resetAudio();
  rendre();
}

async function supprimer(id) {
  if (instru && instru.id === id) resetAudio();
  await supprimerInstru(id).catch(() => {});
  liste = liste.filter((x) => x.id !== id);
  if (!instru || instru.id === id) {
    instru = liste[0] || null;
    ecrireActif(courantId, instru ? instru.id : null);
  }
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
  fermerSelecteur();
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
  const multi = liste.length > 1;
  b.innerHTML = `
    <div class="instru-ligne">
      <button class="instru-btn" id="pp">▶</button>
      <input type="range" id="seek" min="0" max="100" step="0.1" value="0" class="instru-seek">
      <span class="instru-temps" id="temps">0:00</span>
      <button class="instru-btn ${boucle ? 'actif' : ''}" id="mode">${boucle ? 'boucle' : 'normal'}</button>
    </div>
    ${boucle ? `<div class="instru-ligne instru-loop">
      <span class="instru-temps">A <b id="va">${fmt(instru.loopA)}</b> · B <b id="vb">${fmt(instru.loopB)}</b></span>
      <button class="instru-btn" id="poseA">A = ici</button>
      <button class="instru-btn" id="poseB">B = ici</button>
      <button class="instru-btn" id="playA" title="démarrer au début de la boucle">▶ A</button>
    </div>` : ''}
    <button class="instru-nom" id="choisir" title="choisir / ajouter un instru">${esc(instru.nom)} ▾${multi ? ` (${liste.length})` : ''}</button>`;

  b.querySelector('#pp').onclick = () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
  b.querySelector('#seek').oninput = (e) => { if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration; };
  b.querySelector('#mode').onclick = () => {
    instru.mode = boucle ? 'normal' : 'boucle';
    audio.loop = instru.mode === 'normal';
    sauvegarder();
    rendre();
  };
  b.querySelector('#choisir').onclick = ouvrirSelecteur;
  if (boucle) {
    b.querySelector('#poseA').onclick = () => { instru.loopA = audio.currentTime; if (instru.loopB <= instru.loopA) instru.loopB = audio.duration; sauvegarder(); peindre(); };
    b.querySelector('#poseB').onclick = () => { instru.loopB = Math.max(audio.currentTime, instru.loopA + 0.1); sauvegarder(); peindre(); };
    b.querySelector('#playA').onclick = () => { audio.currentTime = instru.loopA; audio.play().catch(() => {}); };
  }
  peindre();
}

function fermerSelecteur() { const p = document.getElementById('instru-pop'); if (p) p.remove(); }

function ouvrirSelecteur() {
  if (document.getElementById('instru-pop')) { fermerSelecteur(); return; }
  const b = document.getElementById('barre-instru');
  if (!b) return;
  const pop = document.createElement('div');
  pop.className = 'instru-pop';
  pop.id = 'instru-pop';
  pop.innerHTML = liste.map((i) => `<div class="instru-item${instru && i.id === instru.id ? ' actif' : ''}">
      <button class="instru-choix" data-choix="${esc(i.id)}">${esc(i.nom)}</button>
      <button class="instru-suppr" data-suppr="${esc(i.id)}" title="supprimer">✕</button>
    </div>`).join('')
    + '<button class="instru-add2" id="pop-add">+ ajouter un instru</button>'
    + '<input type="file" id="pop-file" accept="audio/*" hidden>';
  b.insertAdjacentElement('afterbegin', pop);
  pop.querySelectorAll('[data-choix]').forEach((btn) => btn.addEventListener('click', () => changerActif(btn.dataset.choix)));
  pop.querySelectorAll('[data-suppr]').forEach((btn) => btn.addEventListener('click', () => {
    if (btn.dataset.sure !== '1') {
      btn.textContent = 'sûr ?';
      btn.dataset.sure = '1';
      setTimeout(() => { if (btn.isConnected) { btn.textContent = '✕'; btn.dataset.sure = ''; } }, 3500);
      return;
    }
    supprimer(btn.dataset.suppr);
  }));
  pop.querySelector('#pop-add').onclick = () => pop.querySelector('#pop-file').click();
  pop.querySelector('#pop-file').onchange = chargerFichier;
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
