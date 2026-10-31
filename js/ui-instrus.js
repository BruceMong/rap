// Écran « Instrus » : bibliothèque d'instrus partagés. Importer, renommer, régler
// la boucle A–B finement, noter un lien source, voir dans quels morceaux l'instru
// sert, supprimer. Les instrus et leurs réglages (boucle incluse) sont partagés :
// un changement ici se répercute sur tous les morceaux qui utilisent l'instru.
import { listerInstrus, listerMorceaux, sauverInstru, supprimerInstru } from './store.js';
import { uid } from './model.js';
import { esc, alerteStockage } from './ui-util.js';

let appEl = null;
let instrus = [];
let titres = new Map();   // morceauId -> titre
let audio = null;
let url = null;
let playId = null;        // id de l'instru en lecture
let timers = new Map();   // sauvegarde débouncée par instru

function fmt(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = (s % 60);
  return m + ':' + (ss < 10 ? '0' : '') + ss.toFixed(1);
}
function clamp(v) { return Math.max(0, Math.round((Number(v) || 0) * 10) / 10); }

function sauverBientot(i) {
  clearTimeout(timers.get(i.id));
  timers.set(i.id, setTimeout(() => sauverInstru(i).catch(alerteStockage), 400));
}

function stopAudio() {
  if (audio) { try { audio.pause(); } catch { /* ignore */ } }
  if (url) { URL.revokeObjectURL(url); url = null; }
  audio = null; playId = null;
}

export async function rendreInstrus(app) {
  appEl = app;
  stopAudio();
  const [tous, morceaux] = await Promise.all([listerInstrus(), listerMorceaux()]);
  titres = new Map(morceaux.map((m) => [m.id, m.titre || 'Sans titre']));
  instrus = tous.sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0) || String(a.nom).localeCompare(b.nom, 'fr'));
  dessiner();
}

function usageTexte(i) {
  const noms = (i.morceauIds || []).map((id) => titres.get(id)).filter(Boolean);
  if (!noms.length) return 'Pas encore utilisé';
  return 'Dans : ' + noms.map(esc).join(', ');
}

function carteHTML(i) {
  const boucle = i.mode === 'boucle';
  const src = i.source || '';
  return `<div class="instru-carte" data-id="${esc(i.id)}">
    <div class="ic-tete">
      <input class="ic-nom" data-nom="${esc(i.id)}" value="${esc(i.nom)}" placeholder="nom de l'instru">
      <button class="ic-suppr" data-suppr="${esc(i.id)}" title="supprimer de la bibliothèque">supprimer</button>
    </div>
    <div class="ic-lecteur">
      <button class="instru-btn" data-rew="${esc(i.id)}" title="−5 s">«</button>
      <button class="instru-btn" data-pp="${esc(i.id)}">▶</button>
      <button class="instru-btn" data-ff="${esc(i.id)}" title="+5 s">»</button>
      <input type="range" class="instru-seek" data-seek="${esc(i.id)}" min="0" max="100" step="0.1" value="0">
      <span class="instru-temps" data-temps="${esc(i.id)}">0:00</span>
      <button class="instru-btn ${boucle ? 'actif' : ''}" data-mode="${esc(i.id)}">${boucle ? 'boucle' : 'normal'}</button>
    </div>
    ${boucle ? reglageBoucleHTML(i) : ''}
    <label class="ic-source-l">Lien source
      <input class="ic-source" data-source="${esc(i.id)}" value="${esc(src)}" placeholder="ex. lien YouTube de l'instru (note, aucun téléchargement)">
    </label>
    ${src ? `<a class="ic-source-lien" href="${esc(src)}" target="_blank" rel="noopener">ouvrir le lien ↗</a>` : ''}
    <div class="ic-usage">${usageTexte(i)}</div>
  </div>`;
}

function reglageBoucleHTML(i) {
  const champ = (borne, label) => `<div class="ic-borne">
      <span class="ic-borne-l">${label}</span>
      <button class="instru-btn mini-nudge" data-nudge="${esc(i.id)}:${borne}:-1">−1</button>
      <button class="instru-btn mini-nudge" data-nudge="${esc(i.id)}:${borne}:-0.1">−0,1</button>
      <input class="ic-sec" type="number" inputmode="decimal" step="0.1" min="0" data-sec="${esc(i.id)}:${borne}" value="${clamp(i['loop' + borne])}">
      <button class="instru-btn mini-nudge" data-nudge="${esc(i.id)}:${borne}:0.1">+0,1</button>
      <button class="instru-btn mini-nudge" data-nudge="${esc(i.id)}:${borne}:1">+1</button>
      <button class="instru-btn" data-poser="${esc(i.id)}:${borne}" title="utiliser la position de lecture">ici</button>
      <span class="ic-mmss" data-mmss="${esc(i.id)}:${borne}">${fmt(i['loop' + borne])}</span>
    </div>`;
  return `<div class="ic-boucle">
      ${champ('A', 'A')}
      ${champ('B', 'B')}
      <button class="instru-btn ic-ecouter" data-ecouter="${esc(i.id)}">▶ écouter la boucle</button>
    </div>`;
}

function dessiner() {
  appEl.innerHTML = `
    <div class="app-head">
      <button class="lien-retour" id="retour">← mes morceaux</button><span class="spacer"></span>
      <button class="icon-btn" id="imp">+ importer</button>
    </div>
    <h1 class="scene-titre" style="margin:4px 0 4px">Mes instrus</h1>
    <p class="vide" style="margin:0 0 12px">Ta bibliothèque d'instrus. Les réglages (dont la boucle) sont partagés par tous les morceaux qui utilisent l'instru.</p>
    <div class="instru-cartes">
      ${instrus.length ? instrus.map(carteHTML).join('') : '<p class="vide">Aucun instru. Importe un MP3 pour commencer.</p>'}
    </div>
    <input type="file" id="imp-file" accept="audio/*" hidden>
  `;

  document.getElementById('retour').addEventListener('click', () => { stopAudio(); location.hash = ''; });
  document.getElementById('imp').addEventListener('click', () => document.getElementById('imp-file').click());
  document.getElementById('imp-file').addEventListener('change', importer);

  appEl.querySelectorAll('[data-nom]').forEach((el) => el.addEventListener('input', () => {
    const i = trouver(el.dataset.nom); if (i) { i.nom = el.value; sauverBientot(i); }
  }));
  appEl.querySelectorAll('[data-source]').forEach((el) => el.addEventListener('input', () => {
    const i = trouver(el.dataset.source); if (i) { i.source = el.value.trim(); sauverBientot(i); }
  }));
  appEl.querySelectorAll('[data-suppr]').forEach((b) => b.addEventListener('click', () => confirmerSuppression(b)));

  appEl.querySelectorAll('[data-pp]').forEach((b) => b.addEventListener('click', () => togglePlay(b.dataset.pp)));
  appEl.querySelectorAll('[data-rew]').forEach((b) => b.addEventListener('click', () => { if (audio && playId === b.dataset.rew) audio.currentTime = Math.max(0, audio.currentTime - 5); }));
  appEl.querySelectorAll('[data-ff]').forEach((b) => b.addEventListener('click', () => { if (audio && playId === b.dataset.ff) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); }));
  appEl.querySelectorAll('[data-seek]').forEach((el) => el.addEventListener('input', () => {
    if (audio && playId === el.dataset.seek && audio.duration) audio.currentTime = (el.value / 100) * audio.duration;
  }));
  appEl.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => basculerMode(b.dataset.mode)));

  appEl.querySelectorAll('[data-sec]').forEach((el) => el.addEventListener('change', () => {
    const [id, borne] = el.dataset.sec.split(':');
    poserBorne(id, borne, clamp(el.value));
  }));
  appEl.querySelectorAll('[data-nudge]').forEach((b) => b.addEventListener('click', () => {
    const [id, borne, d] = b.dataset.nudge.split(':');
    const i = trouver(id); if (!i) return;
    poserBorne(id, borne, clamp(i['loop' + borne] + Number(d)));
  }));
  appEl.querySelectorAll('[data-poser]').forEach((b) => b.addEventListener('click', () => {
    const [id, borne] = b.dataset.poser.split(':');
    if (audio && playId === id) poserBorne(id, borne, clamp(audio.currentTime));
  }));
  appEl.querySelectorAll('[data-ecouter]').forEach((b) => b.addEventListener('click', () => ecouterBoucle(b.dataset.ecouter)));
}

function trouver(id) { return instrus.find((x) => x.id === id); }

function poserBorne(id, borne, val) {
  const i = trouver(id); if (!i) return;
  if (borne === 'A') { i.loopA = val; if (i.loopB <= i.loopA) i.loopB = i.loopA + 0.1; }
  else { i.loopB = Math.max(val, (i.loopA || 0) + 0.1); }
  sauverBientot(i);
  majBorne(id, 'A'); majBorne(id, 'B');
}

function majBorne(id, borne) {
  const i = trouver(id); if (!i) return;
  const v = clamp(i['loop' + borne]);
  // Les ids (uid()) ne contiennent que [0-9a-z-] : sûrs dans une valeur entre
  // guillemets, donc pas de CSS.escape (qui, lui, casserait le « : »).
  const sec = appEl.querySelector(`[data-sec="${id}:${borne}"]`);
  if (sec && Number(sec.value) !== v) sec.value = v;
  const mmss = appEl.querySelector(`[data-mmss="${id}:${borne}"]`);
  if (mmss) mmss.textContent = fmt(i['loop' + borne]);
}

function basculerMode(id) {
  const i = trouver(id); if (!i) return;
  i.mode = i.mode === 'boucle' ? 'normal' : 'boucle';
  if (i.mode === 'boucle' && (!i.loopB || i.loopB <= 0) && audio && playId === id) i.loopB = audio.duration || 0;
  sauverBientot(i);
  if (audio && playId === id) audio.loop = i.mode === 'normal';
  dessiner(); // la section boucle apparaît/disparaît
}

function assurerAudio(i) {
  stopAudio();
  url = URL.createObjectURL(new Blob([i.buf], { type: i.type || 'audio/mpeg' }));
  audio = new Audio(url);
  audio.loop = i.mode === 'normal';
  playId = i.id;
  audio.addEventListener('loadedmetadata', () => {
    if (i.mode === 'boucle' && (!i.loopB || i.loopB <= 0)) { i.loopB = audio.duration; sauverBientot(i); majBorne(i.id, 'B'); }
    peindre();
  });
  audio.addEventListener('timeupdate', () => {
    if (i.mode === 'boucle' && i.loopB > 0 && audio.currentTime >= i.loopB) {
      audio.currentTime = i.loopA || 0;
      if (audio.paused) audio.play().catch(() => {});
    }
    peindre();
  });
  audio.addEventListener('play', peindre);
  audio.addEventListener('pause', peindre);
}

function togglePlay(id) {
  const i = trouver(id); if (!i) return;
  if (playId === id && audio) {
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
    return;
  }
  assurerAudio(i);
  audio.play().catch(() => {});
}

function ecouterBoucle(id) {
  const i = trouver(id); if (!i) return;
  if (playId !== id || !audio) assurerAudio(i);
  const lancer = () => { audio.currentTime = i.loopA || 0; audio.play().catch(() => {}); };
  if (audio.readyState >= 1) lancer();
  else audio.addEventListener('loadedmetadata', lancer, { once: true });
}

function peindre() {
  if (!audio || !playId) return;
  const dur = audio.duration || 0;
  const pp = appEl.querySelector(`[data-pp="${playId}"]`);
  appEl.querySelectorAll('[data-pp]').forEach((b) => { b.textContent = '▶'; });
  if (pp) pp.textContent = audio.paused ? '▶' : '⏸';
  const seek = appEl.querySelector(`[data-seek="${playId}"]`);
  if (seek && dur) seek.value = (audio.currentTime / dur) * 100;
  const t = appEl.querySelector(`[data-temps="${playId}"]`);
  if (t) t.textContent = `${fmt(audio.currentTime)} / ${fmt(dur)}`;
}

async function importer(e) {
  const f = e.target.files[0];
  if (!f) return;
  const buf = await f.arrayBuffer();
  const nouv = {
    id: uid(), morceauIds: [], nom: f.name, type: f.type || 'audio/mpeg',
    buf, mode: 'normal', loopA: 0, loopB: 0, source: '', creeLe: Date.now(),
  };
  try { await sauverInstru(nouv); } catch { alerteStockage(); return; }
  await rendreInstrus(appEl);
}

function confirmerSuppression(btn) {
  if (btn.dataset.sure !== '1') {
    btn.textContent = 'confirmer';
    btn.dataset.sure = '1';
    setTimeout(() => { if (btn.isConnected) { btn.textContent = 'supprimer'; btn.dataset.sure = ''; } }, 4000);
    return;
  }
  const id = btn.dataset.suppr;
  if (playId === id) stopAudio();
  supprimerInstru(id).then(() => rendreInstrus(appEl)).catch(alerteStockage);
}
