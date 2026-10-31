// Pads d'ad-libs : une languette fixe à droite ouvre/ferme un overlay avec une
// grille de boutons. Un tap joue le son par-dessus l'instru (moteur pads.js).
// Banque globale (store `sons`), commune à tous les morceaux. Ajout par import de
// fichier ou enregistrement micro ; renommage/suppression en mode édition.
import { listerSons, sauverSon, supprimerSon } from './store.js';
import { reveiller, jouer, precharger, oublier } from './pads.js';
import { uid } from './model.js';
import { esc, alerteStockage } from './ui-util.js';

let sons = [];
let ouvert = false;
let edition = false;
let mediaRec = null;
let chunks = [];

export async function monterPads() {
  if (document.getElementById('pads-languette')) return;
  const lang = document.createElement('button');
  lang.id = 'pads-languette';
  lang.className = 'pads-languette';
  lang.title = 'Pads (ad-libs / effets)';
  lang.innerHTML = '<span>PADS</span>';
  lang.addEventListener('click', toggle);
  document.body.appendChild(lang);

  const ov = document.createElement('div');
  ov.id = 'pads-overlay';
  ov.className = 'pads-overlay';
  ov.hidden = true;
  document.body.appendChild(ov);

  sons = await listerSons();
  // Précharge en tâche de fond pour un premier tap instantané.
  sons.forEach((s) => precharger(s).catch(() => {}));
}

export function demonterPads() {
  arreterEnreg(true);
  ouvert = false; edition = false;
  document.getElementById('pads-languette')?.remove();
  document.getElementById('pads-overlay')?.remove();
}

function toggle() {
  reveiller(); // déverrouille l'audio dès le premier geste
  ouvert = !ouvert;
  const ov = document.getElementById('pads-overlay');
  const lang = document.getElementById('pads-languette');
  if (!ov) return;
  ov.hidden = !ouvert;
  lang?.classList.toggle('actif', ouvert);
  if (ouvert) rendre();
}

function couleur(i) { return `var(--r${i % 8})`; }

function rendre() {
  const ov = document.getElementById('pads-overlay');
  if (!ov) return;
  const grille = sons.length
    ? `<div class="pads-grille">${sons.map((s, i) => padHTML(s, i)).join('')}</div>`
    : '<p class="vide" style="padding:16px 4px">Aucun son. Importe un fichier ou enregistre-toi au micro.</p>';

  ov.innerHTML = `
    <div class="pads-tete">
      <span class="pads-titre">Pads</span>
      <span style="flex:1"></span>
      <button class="icon-btn ${edition ? 'actif' : ''}" id="pads-edit">${edition ? 'terminé' : 'éditer'}</button>
      <button class="icon-btn" id="pads-close">fermer</button>
    </div>
    ${grille}
    <div class="pads-actions">
      <button class="instru-add2" id="pads-import">＋ importer un son</button>
      <button class="instru-add2" id="pads-mic">● enregistrer (micro)</button>
    </div>
    <div class="pads-msg" id="pads-msg" hidden></div>
    <input type="file" id="pads-file" accept="audio/*" hidden>
  `;

  ov.querySelectorAll('[data-pad]').forEach((b) => b.addEventListener('click', () => {
    reveiller();
    const s = sons.find((x) => x.id === b.dataset.pad);
    if (s) jouer(s);
  }));
  ov.querySelectorAll('[data-nom]').forEach((inp) => inp.addEventListener('input', () => {
    const s = sons.find((x) => x.id === inp.dataset.nom);
    if (s) { s.nom = inp.value; sauverSon(s).catch(alerteStockage); }
  }));
  ov.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => confirmerSuppr(b)));

  ov.querySelector('#pads-edit').addEventListener('click', () => { edition = !edition; rendre(); });
  ov.querySelector('#pads-close').addEventListener('click', toggle);
  ov.querySelector('#pads-import').addEventListener('click', () => ov.querySelector('#pads-file').click());
  ov.querySelector('#pads-file').addEventListener('change', importerFichier);
  ov.querySelector('#pads-mic').addEventListener('click', toggleEnreg);
}

function padHTML(s, i) {
  if (edition) {
    return `<div class="pad pad-edit" style="--pad:${couleur(i)}">
      <input class="pad-nom" data-nom="${esc(s.id)}" value="${esc(s.nom)}" placeholder="nom">
      <button class="pad-del" data-del="${esc(s.id)}" title="supprimer">✕</button>
    </div>`;
  }
  return `<button class="pad" data-pad="${esc(s.id)}" style="--pad:${couleur(i)}">${esc(s.nom)}</button>`;
}

function message(txt) {
  const el = document.getElementById('pads-msg');
  if (!el) return;
  el.textContent = txt;
  el.hidden = !txt;
}

async function importerFichier(e) {
  const f = e.target.files[0];
  if (!f) return;
  const buf = await f.arrayBuffer();
  const nom = f.name.replace(/\.[^.]+$/, '');
  await ajouterSon({ nom, type: f.type || 'audio/mpeg', buf });
}

async function ajouterSon({ nom, type, buf }) {
  const son = { id: uid(), nom: nom || 'son', type, buf, ordre: Date.now(), creeLe: Date.now() };
  try { await sauverSon(son); } catch { alerteStockage(); return; }
  sons.push(son);
  precharger(son).catch(() => {});
  edition = true; // ouvre l'édition pour renommer tout de suite
  rendre();
  const inp = document.querySelector(`[data-nom="${son.id}"]`);
  if (inp) { inp.focus(); inp.select(); }
}

// --- enregistrement micro ---
function enEnreg() { return mediaRec && mediaRec.state === 'recording'; }

async function toggleEnreg() {
  if (enEnreg()) { arreterEnreg(); return; }
  reveiller();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    message('Micro indisponible (permission refusée ?).');
    return;
  }
  try {
    mediaRec = new MediaRecorder(stream);
  } catch {
    message('Enregistrement non supporté sur ce navigateur.');
    stream.getTracks().forEach((t) => t.stop());
    return;
  }
  chunks = [];
  mediaRec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
  mediaRec.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    const type = mediaRec.mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type });
    mediaRec = null;
    majBoutonMic();
    if (blob.size) {
      const buf = await blob.arrayBuffer();
      await ajouterSon({ nom: 'ad-lib', type, buf });
    }
  };
  mediaRec.start();
  majBoutonMic();
}

function arreterEnreg(silencieux = false) {
  if (enEnreg()) { try { mediaRec.stop(); } catch { /* ignore */ } }
  else if (silencieux && mediaRec) { mediaRec = null; }
}

function majBoutonMic() {
  const b = document.getElementById('pads-mic');
  if (!b) return;
  if (enEnreg()) { b.textContent = '■ stop (enregistrement…)'; b.classList.add('rec'); }
  else { b.textContent = '● enregistrer (micro)'; b.classList.remove('rec'); }
}

function confirmerSuppr(btn) {
  if (btn.dataset.sure !== '1') {
    btn.textContent = 'sûr ?';
    btn.dataset.sure = '1';
    setTimeout(() => { if (btn.isConnected) { btn.textContent = '✕'; btn.dataset.sure = ''; } }, 3500);
    return;
  }
  const id = btn.dataset.del;
  supprimerSon(id).then(() => {
    oublier(id);
    sons = sons.filter((x) => x.id !== id);
    rendre();
  }).catch(alerteStockage);
}
