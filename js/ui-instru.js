// Lecteur d'instru d'un morceau : barre fixe en bas (hors zone redessinée).
// Les instrus vivent dans une bibliothèque partagée (store `instrus`) ; un morceau
// y pioche via instru.morceauIds. Le réglage de boucle vit sur l'instru, donc il
// est le même partout où l'instru est utilisé. Réglage fin : écran « Instrus ».
import { listerInstrus, getInstrusDuMorceau, sauverInstru, supprimerInstru } from './store.js';
import { uid } from './model.js';
import { esc } from './ui-util.js';

let courantId = null; // morceauId
let liste = [];        // instrus attribués à ce morceau
let biblio = [];       // toute la bibliothèque
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

async function recharger() {
  [liste, biblio] = await Promise.all([getInstrusDuMorceau(courantId), listerInstrus()]);
}

export async function monterInstru(morceauId) {
  if (courantId === morceauId && document.getElementById('barre-instru')) return;
  demonterInstru();
  courantId = morceauId;
  await recharger();
  const actifId = lireActif(morceauId);
  instru = liste.find((i) => i.id === actifId) || liste[0] || null;
  if (instru) ecrireActif(morceauId, instru.id);
  rendre();
}

export function demonterInstru() {
  resetAudio();
  instru = null; liste = []; biblio = []; courantId = null;
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
  const nouv = {
    id: uid(), morceauIds: [courantId], nom: f.name, type: f.type || 'audio/mpeg',
    buf, mode: 'normal', loopA: 0, loopB: 0, source: '', creeLe: Date.now(),
  };
  await sauverInstru(nouv);
  await recharger();
  instru = liste.find((i) => i.id === nouv.id) || nouv;
  ecrireActif(courantId, instru.id);
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

// Attribue à ce morceau un instru déjà présent dans la bibliothèque.
async function attribuer(id) {
  const i = biblio.find((x) => x.id === id);
  if (!i) return;
  if (!Array.isArray(i.morceauIds)) i.morceauIds = [];
  if (!i.morceauIds.includes(courantId)) { i.morceauIds.push(courantId); await sauverInstru(i); }
  await recharger();
  changerActif(id);
}

// Détache l'instru de CE morceau (il reste dans la bibliothèque).
async function detacher(id) {
  if (instru && instru.id === id) resetAudio();
  const i = biblio.find((x) => x.id === id);
  if (i) {
    i.morceauIds = (i.morceauIds || []).filter((m) => m !== courantId);
    await sauverInstru(i);
  }
  await recharger();
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
    const aBiblio = biblio.length > 0;
    b.innerHTML = '<button class="instru-add" id="instru-add">♫ ajouter un instru</button>'
      + (aBiblio ? '<button class="instru-nom" id="choisir" title="choisir dans ma bibliothèque">depuis ma bibliothèque ▾</button>' : '')
      + '<input type="file" id="instru-file" accept="audio/*" hidden>';
    b.querySelector('#instru-add').onclick = () => b.querySelector('#instru-file').click();
    b.querySelector('#instru-file').onchange = chargerFichier;
    const ch = b.querySelector('#choisir');
    if (ch) ch.onclick = ouvrirSelecteur;
    return;
  }

  assurerAudio();
  const boucle = instru.mode === 'boucle';
  const multi = liste.length > 1;
  // Le réglage A–B se fait dans l'écran « Mes instrus » (hors morceau) pour éviter
  // les resets accidentels pendant l'écriture : ici, juste lecture + mode.
  b.innerHTML = `
    <div class="instru-ligne">
      <button class="instru-btn" id="rew" title="reculer de 5 s">«</button>
      <button class="instru-btn" id="pp">▶</button>
      <button class="instru-btn" id="ff" title="avancer de 5 s">»</button>
      <input type="range" id="seek" min="0" max="100" step="0.1" value="0" class="instru-seek">
      <span class="instru-temps" id="temps">0:00</span>
      <button class="instru-btn ${boucle ? 'actif' : ''}" id="mode" title="${boucle ? 'boucle A–B (réglée dans « Mes instrus »)' : 'lecture en boucle complète'}">${boucle ? 'boucle' : 'normal'}</button>
    </div>
    <button class="instru-nom" id="choisir" title="choisir / ajouter un instru">${esc(instru.nom)} ▾${multi ? ` (${liste.length})` : ''}</button>`;

  b.querySelector('#pp').onclick = () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
  b.querySelector('#rew').onclick = () => { if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5); };
  b.querySelector('#ff').onclick = () => { if (audio) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); };
  b.querySelector('#seek').oninput = (e) => { if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration; };
  b.querySelector('#mode').onclick = () => {
    instru.mode = boucle ? 'normal' : 'boucle';
    audio.loop = instru.mode === 'normal';
    sauvegarder();
    rendre();
  };
  b.querySelector('#choisir').onclick = ouvrirSelecteur;
  peindre();
}

function fermerSelecteur() { const p = document.getElementById('instru-pop'); if (p) p.remove(); }

function ouvrirSelecteur() {
  if (document.getElementById('instru-pop')) { fermerSelecteur(); return; }
  const b = document.getElementById('barre-instru');
  if (!b) return;
  const attribues = liste;
  const attribuesIds = new Set(attribues.map((i) => i.id));
  const autres = biblio.filter((i) => !attribuesIds.has(i.id));

  const itemAttribue = (i) => `<div class="instru-item${instru && i.id === instru.id ? ' actif' : ''}">
      <button class="instru-choix" data-choix="${esc(i.id)}">${esc(i.nom)}</button>
      <button class="instru-suppr" data-detach="${esc(i.id)}" title="retirer de ce morceau">✕</button>
    </div>`;
  const itemAutre = (i) => `<div class="instru-item">
      <button class="instru-choix faded" data-attr="${esc(i.id)}" title="ajouter à ce morceau">${esc(i.nom)}</button>
      <button class="instru-suppr" data-attr="${esc(i.id)}" title="ajouter à ce morceau">+</button>
    </div>`;

  const pop = document.createElement('div');
  pop.className = 'instru-pop';
  pop.id = 'instru-pop';
  pop.innerHTML =
    (attribues.length ? '<div class="instru-pop-tit">Dans ce morceau</div>' + attribues.map(itemAttribue).join('') : '')
    + (autres.length ? '<div class="instru-pop-tit">Ma bibliothèque</div>' + autres.map(itemAutre).join('') : '')
    + '<button class="instru-add2" id="pop-add">+ importer un instru</button>'
    + '<button class="instru-add2" id="pop-biblio">⚙ régler mes instrus</button>'
    + '<input type="file" id="pop-file" accept="audio/*" hidden>';
  b.insertAdjacentElement('afterbegin', pop);

  pop.querySelectorAll('[data-choix]').forEach((btn) => btn.addEventListener('click', () => { fermerSelecteur(); changerActif(btn.dataset.choix); }));
  pop.querySelectorAll('[data-attr]').forEach((btn) => btn.addEventListener('click', () => { fermerSelecteur(); attribuer(btn.dataset.attr); }));
  pop.querySelectorAll('[data-detach]').forEach((btn) => btn.addEventListener('click', () => {
    if (btn.dataset.sure !== '1') {
      btn.textContent = 'sûr ?';
      btn.dataset.sure = '1';
      setTimeout(() => { if (btn.isConnected) { btn.textContent = '✕'; btn.dataset.sure = ''; } }, 3500);
      return;
    }
    detacher(btn.dataset.detach);
  }));
  pop.querySelector('#pop-add').onclick = () => pop.querySelector('#pop-file').click();
  pop.querySelector('#pop-file').onchange = chargerFichier;
  pop.querySelector('#pop-biblio').onclick = () => { location.hash = 'instrus'; };
}

function peindre() {
  const b = document.getElementById('barre-instru');
  if (!b || !audio) return;
  const pp = b.querySelector('#pp'); if (pp) pp.textContent = audio.paused ? '▶' : '⏸';
  const dur = audio.duration || 0;
  const seek = b.querySelector('#seek'); if (seek && dur) seek.value = (audio.currentTime / dur) * 100;
  const t = b.querySelector('#temps'); if (t) t.textContent = `${fmt(audio.currentTime)} / ${fmt(dur)}`;
}
