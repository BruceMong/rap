// Écran d'un morceau : éditeur ligne par ligne, placards repliables (accordéon),
// imbrication, validation (jaune), brouillons détachés. Persistance débouncée.
import { getMorceau, sauverMorceau } from './store.js';
import {
  ajouterLigne, modifierLigne, basculerValide, basculerTest, supprimerLigne, ajouterPlacard,
  rangerDansLigne, insererLigneApres, deplacerLigne, uid,
  versionActive, migrerMorceau, creerVersion, nouvelleVersionDepuisGardes,
  changerVersion, renommerVersion, supprimerVersion,
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
let vue = 'edition';       // 'edition' | 'test' (jaune+vert) | 'scene' (jaune seul)

const ORDRE_VUE = ['edition', 'test', 'scene'];
const LABEL_VUE = { edition: 'édition', test: 'test', scene: 'scène' };
function cyclerVue() {
  vue = ORDRE_VUE[(ORDRE_VUE.indexOf(vue) + 1) % ORDRE_VUE.length];
  dessiner();
}

// Raccourcis vers les lignes / détachés de la version active du morceau courant.
function lignesA() { return versionActive(M).lignes; }
function detachesA() { return versionActive(M).detaches; }

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
  M = migrerMorceau(M);
  M.ouvertLe = Date.now();
  sauverMorceau(M).catch(() => {}); // remonte le morceau en tête de l'accueil (et persiste la migration)
  vue = 'edition';
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
  const etat = l.valide ? ' valide' : (l.test ? ' test' : '');
  const placard = `<div class="placard"><div class="placard-in"><div class="placard-pad">
      ${l.placards.map(essaiHTML).join('')}
      <button class="add-essai" data-ligne="${esc(l.id)}">+ un essai</button>
    </div></div></div>`;
  return `<div class="bloc-ligne${ouvert}" data-ligne="${esc(l.id)}">
      <div class="ligne-row${etat}">
        <span class="poignee" title="glisser pour ranger dans une autre ligne">⠿</span>
        <span class="pieds" data-pieds="${esc(l.id)}"></span>
        <textarea class="ligne-edit" rows="1" data-ligne="${esc(l.id)}" placeholder="écris un vers…">${esc(l.texte)}</textarea>
        <span class="ligne-actions">
          <button class="mini toggle-placard${np ? ' aPlacard' : ''}" data-ligne="${esc(l.id)}" title="brouillons">
            <span class="chevron">›</span>${np ? `<span class="badge">${np}</span>` : ''}</button>
          <button class="mini ${l.valide ? 'actif' : ''}" data-valide="${esc(l.id)}" title="garder (jaune)">✓</button>
          <button class="mini" data-menu-ligne="${esc(l.id)}" title="plus d’actions">⋯</button>
        </span>
      </div>
      ${placard}
    </div>`;
}

function dessiner() {
  if (vue !== 'edition') { dessinerLecture(); return; }
  const detaches = detachesA().length ? `
    <div class="sect-label">Brouillons détachés</div>
    <div class="detaches"><div class="placard-pad">
      ${detachesA().map(essaiHTML).join('')}
    </div></div>` : '';

  appEl.innerHTML = `
    <div class="app-head">
      <button class="lien-retour" id="retour">← mes morceaux</button><span class="spacer"></span>
      <button class="icon-btn ${surlignageActif() ? 'actif' : ''}" id="rimes" title="surlignage des rimes">rimes</button>
      <button class="icon-btn" id="vue" title="changer de vue (édition / test / scène)">${LABEL_VUE[vue]}</button>
      <button class="icon-btn" id="statut">${M.statut === 'fini' ? '✓ fini' : 'en cours'}</button>
    </div>
    <input class="titre-morceau" id="titre" placeholder="Titre du morceau" value="${esc(M.titre)}">
    <div class="versions-bar">
      ${M.versions.map((v) => `<button class="ver-chip${v.id === M.versionActiveId ? ' actif' : ''}" data-ver="${esc(v.id)}">${esc(v.nom)}</button>`).join('')}
      <button class="ver-add" id="ver-plus" title="gérer les versions">⋯</button>
    </div>
    <p class="aide-drag">Tire la poignée ⠿ pour déplacer une ligne ; reste sur une ligne pour la ranger dedans.</p>
    <div class="lignes" id="lignes">${lignesA().map(ligneHTML).join('')}</div>
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
  document.getElementById('vue').addEventListener('click', cyclerVue);
  const titre = document.getElementById('titre');
  titre.addEventListener('input', () => { M.titre = titre.value; sauverBientot(); });

  appEl.querySelectorAll('.ver-chip').forEach((c) => c.addEventListener('click', async () => {
    if (c.dataset.ver === M.versionActiveId) return;
    M = changerVersion(M, c.dataset.ver);
    await sauverMaintenant(); dessiner();
  }));
  document.getElementById('ver-plus').addEventListener('click', ouvrirMenuVersions);

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
      const l = lignesA().find((x) => x.id === ta.dataset.ligne);
      if (l) { l.texte = ta.value; sauverBientot(); }
      noterCible();
      autoGrow(ta);
      majPiedsEtRimes();
    });
  });

  appEl.querySelectorAll('[data-menu-ligne]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    ouvrirMenuLigne(b.dataset.menuLigne, b.closest('.bloc-ligne'));
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

  appEl.querySelectorAll('.bloc-ligne').forEach(attacherDrag);

  majPiedsEtRimes();
  // Rafraîchit une fois le dico chargé en différé (valeurs d'abord via G2P).
  chargerDico().then(majPiedsEtRimes).catch(() => {});
  // Barre d'instru (hors #app, ne se recrée pas à chaque redessin).
  monterInstru(M.id);
}

// Cherche/supprime un essai dans les vraies listes (placards de lignes + détachés).
function trouverEssai(id) {
  for (const l of lignesA()) { const t = trouverIdee(l.placards, id); if (t) return t; }
  return trouverIdee(detachesA(), id);
}
function supprimerEssai(id) {
  for (const l of lignesA()) { if (retirerIdee(l.placards, id)) return; }
  retirerIdee(detachesA(), id);
}

// Menu compact d'une ligne : à tester (vert), rimes, insérer dessous, supprimer.
function ouvrirMenuLigne(id, bloc) {
  if (!bloc) return;
  const ex = bloc.querySelector('.menu-ligne');
  if (ex) { ex.remove(); return; }
  const l = lignesA().find((x) => x.id === id);
  if (!l) return;
  const menu = document.createElement('div');
  menu.className = 'menu-ligne';
  menu.innerHTML = `
    <button data-a="test" class="${l.test ? 'actif' : ''}">à tester</button>
    <button data-a="rimes">rimes ♪</button>
    <button data-a="inserer">insérer dessous</button>
    <button data-a="suppr">supprimer</button>`;
  bloc.querySelector('.ligne-row').insertAdjacentElement('afterend', menu);
  menu.querySelector('[data-a="test"]').addEventListener('click', async () => {
    M = basculerTest(M, id); await sauverMaintenant(); dessiner();
  });
  menu.querySelector('[data-a="rimes"]').addEventListener('click', () => {
    menu.remove();
    const mot = dernierMotDe(l.texte);
    if (mot) ouvrirPanneauRimes(mot);
  });
  menu.querySelector('[data-a="inserer"]').addEventListener('click', async () => {
    M = insererLigneApres(M, id, '');
    await sauverMaintenant(); dessiner();
    const bl = appEl.querySelector(`.bloc-ligne[data-ligne="${CSS.escape(id)}"]`);
    const ta = bl && bl.nextElementSibling && bl.nextElementSibling.querySelector('.ligne-edit');
    if (ta) ta.focus();
  });
  menu.querySelector('[data-a="suppr"]').addEventListener('click', async () => {
    M = supprimerLigne(M, id); await sauverMaintenant(); dessiner();
  });
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
    const l = lignesA().find((x) => x.id === cible.id);
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

// Menu des versions : renommer, nouvelle depuis les gardés, nouvelle vide, supprimer.
function ouvrirMenuVersions() {
  const ex = document.getElementById('menu-versions');
  if (ex) { ex.remove(); return; }
  const bar = appEl.querySelector('.versions-bar');
  if (!bar) return;
  const va = versionActive(M);
  const menu = document.createElement('div');
  menu.className = 'menu-versions';
  menu.id = 'menu-versions';
  menu.innerHTML = `
    <div class="mv-renom">
      <input id="mv-nom" value="${esc(va.nom)}" maxlength="40">
      <button id="mv-ok">renommer</button>
    </div>
    <button id="mv-garde">+ nouvelle version depuis les vers gardés</button>
    <button id="mv-vide">+ nouvelle version vide</button>
    ${M.versions.length > 1 ? '<button id="mv-suppr">supprimer cette version</button>' : ''}`;
  bar.insertAdjacentElement('afterend', menu);
  menu.querySelector('#mv-ok').addEventListener('click', async () => {
    const nom = menu.querySelector('#mv-nom').value.trim() || va.nom;
    M = renommerVersion(M, va.id, nom);
    await sauverMaintenant(); dessiner();
  });
  menu.querySelector('#mv-garde').addEventListener('click', async () => {
    M = nouvelleVersionDepuisGardes(M); await sauverMaintenant(); dessiner();
  });
  menu.querySelector('#mv-vide').addEventListener('click', async () => {
    M = creerVersion(M); await sauverMaintenant(); dessiner();
  });
  const suppr = menu.querySelector('#mv-suppr');
  if (suppr) suppr.addEventListener('click', async () => {
    if (suppr.dataset.sure !== '1') {
      suppr.textContent = 'confirmer la suppression';
      suppr.dataset.sure = '1';
      setTimeout(() => { if (suppr.isConnected) { suppr.textContent = 'supprimer cette version'; suppr.dataset.sure = ''; } }, 4000);
      return;
    }
    M = supprimerVersion(M, M.versionActiveId); await sauverMaintenant(); dessiner();
  });
}

// Vue de lecture, pour rapper : « test » (gardés + à tester) ou « scène » (gardés seuls).
function dessinerLecture() {
  const lignes = lignesA().filter((l) => (vue === 'scene' ? l.valide : (l.valide || l.test)));
  appEl.innerHTML = `
    <div class="app-head">
      <button class="lien-retour" id="retour">← mes morceaux</button><span class="spacer"></span>
      <button class="icon-btn actif" id="vue" title="changer de vue">${LABEL_VUE[vue]}</button>
    </div>
    <h1 class="scene-titre">${esc(M.titre || 'Sans titre')}</h1>
    ${lignes.length
      ? `<div class="scene-texte">${lignes.map((l) => `<p class="${l.valide ? 'garde' : 'test'}">${esc(l.texte)}</p>`).join('')}</div>`
      : `<p class="vide">${vue === 'scene' ? 'Aucun vers gardé (✓).' : 'Aucun vers gardé ou à tester.'}</p>`}
  `;
  document.getElementById('retour').addEventListener('click', async () => {
    await sauverMaintenant(); demonterInstru(); location.hash = '';
  });
  document.getElementById('vue').addEventListener('click', cyclerVue);
  monterInstru(M.id);
}

// Glisser une ligne par sa poignée, façon Notion : par défaut on la déplace (un
// repère montre où elle se posera) ; en s'attardant au centre d'une ligne on la
// range dedans ; lâcher sur la pastille ✕ ou en dehors annule.
function attacherDrag(bloc) {
  const poignee = bloc.querySelector('.poignee');
  if (!poignee) return;
  poignee.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const sourceId = bloc.dataset.ligne;
    const l = lignesA().find((x) => x.id === sourceId);
    const conteneur = appEl.querySelector('#lignes');

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = (l && l.texte.trim()) ? l.texte : '(vide)';
    document.body.appendChild(ghost);
    const placer = (x, y) => { ghost.style.transform = `translate(${x + 12}px, ${y - 16}px) rotate(-2deg)`; };
    placer(e.clientX, e.clientY);

    const annuleur = document.createElement('div');
    annuleur.className = 'drag-cancel';
    annuleur.id = 'drag-cancel';
    annuleur.textContent = '✕ annuler';
    document.body.appendChild(annuleur);

    const indic = document.createElement('div');
    indic.className = 'drop-indic';

    bloc.classList.add('drag-source');
    document.body.classList.add('drag-en-cours');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    try { poignee.setPointerCapture(e.pointerId); } catch { /* ignore */ }

    let mode = 'annuler';     // 'reorder' | 'nest' | 'annuler'
    let cibleNest = null;
    let reorderOver = null, reorderAvant = true;
    let hoverId = null, hoverDepuis = 0;

    const clearVisu = () => {
      if (cibleNest) { cibleNest.classList.remove('drag-cible'); cibleNest = null; }
      if (indic.parentNode) indic.remove();
      annuleur.classList.remove('actif');
    };

    const move = (ev) => {
      placer(ev.clientX, ev.clientY);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      if (el && el.closest('#drag-cancel')) { clearVisu(); annuleur.classList.add('actif'); mode = 'annuler'; hoverId = null; return; }
      const over = el && el.closest('.bloc-ligne');
      if (!over || over === bloc || !conteneur || !conteneur.contains(over)) { clearVisu(); mode = 'annuler'; hoverId = null; return; }
      const rect = over.getBoundingClientRect();
      const rel = (ev.clientY - rect.top) / rect.height;
      const id = over.dataset.ligne;
      if (hoverId !== id) { hoverId = id; hoverDepuis = performance.now(); }
      const longHover = performance.now() - hoverDepuis > 600;
      if (rel > 0.3 && rel < 0.7 && longHover) {
        if (indic.parentNode) indic.remove();
        if (cibleNest !== over) { if (cibleNest) cibleNest.classList.remove('drag-cible'); cibleNest = over; over.classList.add('drag-cible'); }
        mode = 'nest';
      } else {
        if (cibleNest) { cibleNest.classList.remove('drag-cible'); cibleNest = null; }
        reorderOver = over;
        reorderAvant = rel < 0.5;
        if (reorderAvant) conteneur.insertBefore(indic, over); else conteneur.insertBefore(indic, over.nextSibling);
        mode = 'reorder';
      }
      annuleur.classList.remove('actif');
    };

    const up = async () => {
      poignee.removeEventListener('pointermove', move);
      poignee.removeEventListener('pointerup', up);
      poignee.removeEventListener('pointercancel', up);
      ghost.remove(); annuleur.remove();
      document.body.classList.remove('drag-en-cours');
      const cibleId = cibleNest ? cibleNest.dataset.ligne : null;
      const over = reorderOver;
      const avant = reorderAvant;
      clearVisu();
      bloc.classList.remove('drag-source');
      if (mode === 'nest' && cibleId) {
        M = rangerDansLigne(M, sourceId, cibleId);
        ouverts.add(cibleId);
        await sauverMaintenant(); dessiner();
      } else if (mode === 'reorder' && over) {
        const lignes = lignesA();
        const overIdx = lignes.findIndex((x) => x.id === over.dataset.ligne);
        const srcIdx = lignes.findIndex((x) => x.id === sourceId);
        let target = avant ? overIdx : overIdx + 1;
        if (srcIdx < target) target -= 1;
        M = deplacerLigne(M, sourceId, target);
        await sauverMaintenant(); dessiner();
      }
    };
    poignee.addEventListener('pointermove', move);
    poignee.addEventListener('pointerup', up);
    poignee.addEventListener('pointercancel', up);
  });
}

// Compteur de pieds (toujours) + schéma de rime en barres colorées (si activé).
// Recalcul O(N) léger (1 lookup phonétique par ligne) à chaque frappe.
function majPiedsEtRimes() {
  if (!M) return;
  const textes = lignesA().map((l) => l.texte);
  const groupes = surlignageActif() ? grouperRimes(textes) : textes.map(() => null);
  lignesA().forEach((l, i) => {
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
