// Écran d'un morceau : éditeur ligne par ligne, placards repliables (accordéon),
// imbrication, validation (jaune), brouillons détachés. Persistance débouncée.
import { getMorceau, sauverMorceau } from './store.js';
import {
  ajouterLigne, modifierLigne, basculerValide, supprimerLigne, ajouterPlacard, uid,
} from './model.js';
import { esc, autoGrow, alerteStockage } from './ui-util.js';
import { compterPieds } from './syllabes.js';
import { grouperRimes, trouverRimes } from './rimes.js';
import { chargerDico, dicoPret } from './dico.js';
import { surlignageActif, basculerSurlignage } from './reglages.js';
import { planifier as planifierBackup } from './backup.js';
import { monterInstru, demonterInstru } from './ui-instru.js';

let M = null;            // morceau courant (état de l'écran)
let appEl = null;
const ouverts = new Set(); // ids de lignes dont le placard est déplié
let timer = null;
let cible = null;          // { id, pos } : dernier curseur dans une ligne (cible d'insertion)

function sauverBientot() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    M.modifieLe = Date.now();
    sauverMorceau(M).catch(alerteStockage);
    planifierBackup();
  }, 400);
}
async function sauverMaintenant() {
  clearTimeout(timer);
  if (!M) return;
  M.modifieLe = Date.now();
  try { await sauverMorceau(M); } catch { alerteStockage(); }
  planifierBackup();
}

// Flush de la saisie débouncée quand l'app passe en arrière-plan (OS peut geler
// l'onglet sur mobile). Installé une seule fois.
let flushInstalle = false;
function installerFlush() {
  if (flushInstalle) return;
  flushInstalle = true;
  const flush = () => { if (document.visibilityState === 'hidden') sauverMaintenant(); };
  document.addEventListener('visibilitychange', flush);
  window.addEventListener('pagehide', flush);
}

// --- helpers d'arbre pour les essais (placards) ---
function trouverIdee(idees, id) {
  for (const i of idees) {
    if (i.id === id) return i;
    const t = trouverIdee(i.enfants, id);
    if (t) return t;
  }
  return null;
}
function retirerIdee(idees, id) {
  const idx = idees.findIndex((i) => i.id === id);
  if (idx >= 0) { idees.splice(idx, 1); return true; }
  return idees.some((i) => retirerIdee(i.enfants, id));
}

export async function rendreMorceau(app, id) {
  appEl = app;
  M = await getMorceau(id);
  if (!M) { location.hash = ''; return; }
  fermerPanneau();
  installerFlush();
  dessiner();
}

function essaiHTML(idee) {
  const enfants = idee.enfants.length
    ? `<div class="sous">${idee.enfants.map(essaiHTML).join('')}</div>` : '';
  return `<div class="essai" data-idee="${esc(idee.id)}">
      <textarea class="essai-edit" rows="1" data-idee="${esc(idee.id)}">${esc(idee.texte)}</textarea>
      <button class="mini" data-sous="${esc(idee.id)}" title="idée dans l’idée">↳</button>
      <button class="mini" data-del-idee="${esc(idee.id)}" title="supprimer">✕</button>
      ${enfants}
    </div>`;
}

function ligneHTML(l) {
  const ouvert = ouverts.has(l.id) ? ' ouvert' : '';
  const np = l.placards.length;
  const placard = `<div class="placard"><div class="placard-in"><div class="placard-pad">
      ${l.placards.map(essaiHTML).join('')}
      <button class="add-essai" data-ligne="${esc(l.id)}">+ un essai</button>
    </div></div></div>`;
  return `<div class="bloc-ligne${ouvert}" data-ligne="${esc(l.id)}">
      <div class="ligne-row${l.valide ? ' valide' : ''}">
        <span class="pieds" data-pieds="${esc(l.id)}"></span>
        <textarea class="ligne-edit" rows="1" data-ligne="${esc(l.id)}" placeholder="écris un vers…">${esc(l.texte)}</textarea>
        <span class="ligne-actions">
          <button class="mini toggle-placard" data-ligne="${esc(l.id)}" title="brouillons">
            <span class="chevron">›</span>${np ? np : ''}</button>
          <button class="mini" data-rimes="${esc(l.id)}" title="chercher des rimes">♪</button>
          <button class="mini ${l.valide ? 'actif' : ''}" data-valide="${esc(l.id)}" title="validé">✓</button>
          <button class="mini" data-del="${esc(l.id)}" title="supprimer la ligne">✕</button>
        </span>
      </div>
      ${placard}
    </div>`;
}

function dessiner() {
  const detaches = M.detaches.length ? `
    <div class="sect-label">Brouillons détachés</div>
    <div class="detaches"><div class="placard-pad">
      ${M.detaches.map(essaiHTML).join('')}
    </div></div>` : '';

  appEl.innerHTML = `
    <div class="app-head">
      <button class="lien-retour" id="retour">← mes morceaux</button><span class="spacer"></span>
      <button class="icon-btn ${surlignageActif() ? 'actif' : ''}" id="rimes" title="surlignage des rimes">rimes</button>
      <button class="icon-btn" id="statut">${M.statut === 'fini' ? '✓ fini' : 'en cours'}</button>
    </div>
    <input class="titre-morceau" id="titre" placeholder="Titre du morceau" value="${esc(M.titre)}">
    <div class="lignes" id="lignes">${M.lignes.map(ligneHTML).join('')}</div>
    <button class="add-ligne" id="add-ligne">+ une ligne</button>
    ${detaches}
  `;

  document.getElementById('retour').addEventListener('click', async () => {
    await sauverMaintenant();
    demonterInstru();
    location.hash = '';
  });
  document.getElementById('statut').addEventListener('click', async () => {
    M.statut = M.statut === 'fini' ? 'en_cours' : 'fini';
    await sauverMaintenant(); dessiner();
  });
  document.getElementById('rimes').addEventListener('click', (e) => {
    const actif = basculerSurlignage();
    e.currentTarget.classList.toggle('actif', actif);
    majPiedsEtRimes();
  });
  const titre = document.getElementById('titre');
  titre.addEventListener('input', () => { M.titre = titre.value; sauverBientot(); });

  document.getElementById('add-ligne').addEventListener('click', async () => {
    M = ajouterLigne(M, '');
    await sauverMaintenant(); dessiner();
    const tas = appEl.querySelectorAll('.ligne-edit');
    if (tas.length) tas[tas.length - 1].focus();
  });

  // textarea de lignes
  appEl.querySelectorAll('.ligne-edit').forEach((ta) => {
    autoGrow(ta);
    const noterCible = () => { cible = { id: ta.dataset.ligne, pos: ta.selectionStart }; };
    ta.addEventListener('focus', noterCible);
    ta.addEventListener('click', noterCible);
    ta.addEventListener('keyup', noterCible);
    ta.addEventListener('input', () => {
      const l = M.lignes.find((x) => x.id === ta.dataset.ligne);
      if (l) { l.texte = ta.value; sauverBientot(); }
      noterCible();
      autoGrow(ta);
      majPiedsEtRimes();
    });
  });

  appEl.querySelectorAll('[data-rimes]').forEach((b) => b.addEventListener('click', () => {
    const l = M.lignes.find((x) => x.id === b.dataset.rimes);
    const mot = dernierMotDe(l ? l.texte : '');
    if (mot) ouvrirPanneauRimes(mot);
  }));

  // essais
  appEl.querySelectorAll('.essai-edit').forEach((ta) => {
    autoGrow(ta);
    ta.addEventListener('input', () => {
      const idee = trouverEssai(ta.dataset.idee);
      if (idee) { idee.texte = ta.value; sauverBientot(); }
      autoGrow(ta);
    });
  });

  // actions
  appEl.querySelectorAll('.toggle-placard').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.ligne;
    if (ouverts.has(id)) ouverts.delete(id); else ouverts.add(id);
    b.closest('.bloc-ligne').classList.toggle('ouvert');
  }));
  appEl.querySelectorAll('[data-valide]').forEach((b) => b.addEventListener('click', async () => {
    M = basculerValide(M, b.dataset.valide);
    await sauverMaintenant(); dessiner();
  }));
  appEl.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    M = supprimerLigne(M, b.dataset.del);
    await sauverMaintenant(); dessiner();
  }));
  appEl.querySelectorAll('.add-essai').forEach((b) => b.addEventListener('click', async () => {
    ouverts.add(b.dataset.ligne);
    M = ajouterPlacard(M, b.dataset.ligne, '');
    await sauverMaintenant(); dessiner();
  }));
  appEl.querySelectorAll('[data-sous]').forEach((b) => b.addEventListener('click', async () => {
    const ligne = b.closest('.bloc-ligne');
    if (!ligne) return;
    M = ajouterPlacard(M, ligne.dataset.ligne, '', b.dataset.sous);
    await sauverMaintenant(); dessiner();
  }));
  appEl.querySelectorAll('[data-del-idee]').forEach((b) => b.addEventListener('click', async () => {
    supprimerEssai(b.dataset.delIdee);
    await sauverMaintenant(); dessiner();
  }));

  majPiedsEtRimes();
  // Rafraîchit une fois le dico chargé en différé (valeurs d'abord via G2P).
  chargerDico().then(majPiedsEtRimes).catch(() => {});
  // Barre d'instru (hors #app, ne se recrée pas à chaque redessin).
  monterInstru(M.id);
}

// Cherche/supprime un essai dans les vraies listes (placards de lignes + détachés).
function trouverEssai(id) {
  for (const l of M.lignes) { const t = trouverIdee(l.placards, id); if (t) return t; }
  return trouverIdee(M.detaches, id);
}
function supprimerEssai(id) {
  for (const l of M.lignes) { if (retirerIdee(l.placards, id)) return; }
  retirerIdee(M.detaches, id);
}

// --- panneau de rimes (Task 13) ---
function dernierMotDe(texte) {
  const t = String(texte || '').toLowerCase().match(/[a-zà-ÿœ]+(?:'[a-zà-ÿœ]+)*/g);
  return t ? t[t.length - 1] : null;
}

function fermerPanneau() {
  const p = document.getElementById('pan-rimes');
  if (p) p.remove();
}

function inserer(mot) {
  const ta = cible && appEl.querySelector(`.ligne-edit[data-ligne="${CSS.escape(cible.id)}"]`);
  if (ta) {
    const p = cible.pos ?? ta.value.length;
    const avant = ta.value.slice(0, p);
    const sep = (p > 0 && !/\s$/.test(avant)) ? ' ' : '';
    ta.value = avant + sep + mot + ta.value.slice(p);
    const l = M.lignes.find((x) => x.id === cible.id);
    if (l) { l.texte = ta.value; sauverBientot(); }
    autoGrow(ta);
    const np = p + sep.length + mot.length;
    cible.pos = np;
    ta.focus();
    ta.setSelectionRange(np, np);
    majPiedsEtRimes();
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(mot).catch(() => {});
  }
  fermerPanneau();
}

function ouvrirPanneauRimes(mot) {
  fermerPanneau();
  const pan = document.createElement('div');
  pan.className = 'panneau-rimes';
  pan.id = 'pan-rimes';
  pan.innerHTML = `<header><h3>Rime avec « ${esc(mot)} »</h3>
      <span style="flex:1"></span>
      <button class="icon-btn" id="pan-close">fermer</button></header>
    <div class="rimes-liste" id="rimes-liste"><span class="vide">…</span></div>`;
  document.body.appendChild(pan);
  document.getElementById('pan-close').addEventListener('click', fermerPanneau);

  const remplir = () => {
    const liste = document.getElementById('rimes-liste');
    if (!liste) return;
    const r = trouverRimes(mot, { max: 120 });
    liste.innerHTML = r.length
      ? r.map((x) => `<button class="rime-chip rich-${x.richesse}" data-mot="${esc(x.mot)}">${esc(x.mot)}<span class="rich">${x.pieds}</span></button>`).join('')
      : '<span class="vide">Aucune rime trouvée</span>';
    liste.querySelectorAll('[data-mot]').forEach((b) => b.addEventListener('click', () => inserer(b.dataset.mot)));
  };
  if (dicoPret()) remplir(); else chargerDico().then(remplir).catch(() => {});
}

// Compteur de pieds (toujours) + schéma de rime en barres colorées (si activé).
// Recalcul O(N) léger (1 lookup phonétique par ligne) à chaque frappe.
function majPiedsEtRimes() {
  if (!M) return;
  const textes = M.lignes.map((l) => l.texte);
  const groupes = surlignageActif() ? grouperRimes(textes) : textes.map(() => null);
  M.lignes.forEach((l, i) => {
    const bloc = appEl.querySelector(`.bloc-ligne[data-ligne="${CSS.escape(l.id)}"]`);
    if (!bloc) return;
    const pieds = bloc.querySelector('.pieds');
    if (pieds) { const n = compterPieds(l.texte); pieds.textContent = n || ''; }
    const row = bloc.querySelector('.ligne-row');
    const g = groupes[i];
    if (g != null) {
      row.style.boxShadow = `inset 3px 0 0 0 var(--r${g % 8})`;
    } else {
      row.style.boxShadow = '';
    }
  });
}
