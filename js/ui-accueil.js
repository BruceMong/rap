// Écran d'accueil : coffre à idées transversal + morceaux en cours / terminés.
import { listerMorceaux, getCoffre, sauverCoffre, sauverMorceau, getMorceau, supprimerMorceau } from './store.js';
import {
  creerMorceau, envoyerIdeeVersMorceau, morceauDepuisTexte, versionActive, migrerMorceau, uid,
} from './model.js';
import { esc, dateRelative, alerteStockage } from './ui-util.js';
import { planifier as planifierBackup } from './backup.js';

function lignesDe(m) { return versionActive(migrerMorceau(m)).lignes; }
function apercu(m) {
  const l = lignesDe(m).find((x) => x.texte && x.texte.trim());
  return l ? l.texte.trim() : 'Vide pour l’instant';
}
function nbPlacards(m) {
  return lignesDe(m).reduce((n, l) => n + (l.placards ? l.placards.length : 0), 0);
}

function carte(m) {
  const pill = m.statut === 'fini'
    ? '<span class="pill fini">fini</span>'
    : '<span class="pill encours">en cours</span>';
  const np = nbPlacards(m);
  const nbv = (migrerMorceau(m).versions || []).length;
  const meta = [
    `<b>${lignesDe(m).length}</b> lignes`,
    np ? `<b>${np}</b> placards` : '',
    nbv > 1 ? `<b>${nbv}</b> versions` : '',
    dateRelative(m.modifieLe),
  ].filter(Boolean).map((x) => `<span>${x}</span>`).join('');
  return `<div class="morceau${m.epingle ? ' epingle' : ''}" data-id="${esc(m.id)}" role="button" tabindex="0">
    <div class="m-top">
      ${m.epingle ? '<span class="pin-ind" title="épinglé">★</span>' : ''}
      <span class="m-title">${esc(m.titre || 'Sans titre')}</span>${pill}
      <button class="kebab" data-menu="${esc(m.id)}" title="options">⋯</button>
    </div>
    <div class="m-apercu">${esc(apercu(m))}</div>
    <div class="m-meta">${meta}</div>
  </div>`;
}

const activite = (m) => Math.max(m.modifieLe || 0, m.ouvertLe || 0);
function trier(a, b) {
  return (b.epingle ? 1 : 0) - (a.epingle ? 1 : 0) || activite(b) - activite(a);
}

export async function rendreAccueil(app) {
  const [morceaux, coffre] = await Promise.all([listerMorceaux(), getCoffre()]);
  morceaux.sort(trier);
  const enCours = morceaux.filter((m) => m.statut !== 'fini');
  const finis = morceaux.filter((m) => m.statut === 'fini');

  const vrac = coffre.length
    ? coffre.map((i) => `<li data-id="${esc(i.id)}">
        <span class="txt">${esc(i.texte)}</span>
        <button class="envoyer" data-id="${esc(i.id)}" title="Envoyer vers un morceau">→</button>
      </li>`).join('')
    : '<li class="vide">Rien pour l’instant</li>';

  app.innerHTML = `
    <div class="app-head"><h1>Rap</h1><span class="spacer"></span>
      <button class="icon-btn" id="btn-apropos" title="À propos">i</button></div>

    <div class="sect-label">Coffre à idées</div>
    <section class="coffre">
      <h2>En vrac <span class="tag">transversal</span></h2>
      <ul class="vrac" id="vrac">${vrac}</ul>
      <button class="add-idea" id="add-idea">+ jeter une idée</button>
    </section>

    <div class="sect-label">En cours</div>
    <div class="morceaux" id="encours">${enCours.map(carte).join('') || '<p class="vide">Aucun morceau en cours.</p>'}</div>

    ${finis.length ? `<div class="sect-label">Terminés</div>
      <div class="morceaux">${finis.map(carte).join('')}</div>` : ''}

    <div class="fab">
      <button id="coller" class="icon-btn" style="padding:13px 18px;border-radius:26px">Coller un texte</button>
      <button id="nouveau">+ Nouveau morceau</button>
    </div>
  `;

  app.querySelectorAll('.morceau').forEach((carte) => {
    const ouvrir = (e) => {
      if (e.target.closest('.kebab') || e.target.closest('.menu-carte')) return;
      location.hash = 'm=' + carte.dataset.id;
    };
    carte.addEventListener('click', ouvrir);
    carte.addEventListener('keydown', (e) => { if (e.key === 'Enter') ouvrir(e); });
  });
  app.querySelectorAll('.kebab').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    ouvrirMenuCarte(app, morceaux, b.dataset.menu, b.closest('.morceau'));
  }));

  document.getElementById('nouveau').addEventListener('click', async () => {
    const m = creerMorceau('');
    try { await sauverMorceau(m); } catch { alerteStockage(); return; }
    planifierBackup();
    location.hash = 'm=' + m.id;
  });

  document.getElementById('add-idea').addEventListener('click', () => ajouterIdee(app, coffre));

  app.querySelectorAll('.vrac .envoyer').forEach((btn) => {
    btn.addEventListener('click', () => choisirDestination(app, coffre, btn.dataset.id, morceaux));
  });

  document.getElementById('btn-apropos').addEventListener('click', () => { location.hash = 'apropos'; });
  document.getElementById('coller').addEventListener('click', () => ouvrirColler(app));
}

// Menu d'une carte : épingler / supprimer (suppression confirmée en deux clics).
function ouvrirMenuCarte(app, morceaux, id, carteEl) {
  if (!carteEl) return;
  const existant = carteEl.querySelector('.menu-carte');
  if (existant) { existant.remove(); return; }
  const m = morceaux.find((x) => x.id === id);
  if (!m) return;
  const menu = document.createElement('div');
  menu.className = 'menu-carte';
  menu.innerHTML = `
    <button data-act="epingle">${m.epingle ? 'Désépingler' : 'Épingler en haut'}</button>
    <button data-act="suppr">Supprimer</button>`;
  carteEl.querySelector('.m-top').insertAdjacentElement('afterend', menu);
  menu.querySelector('[data-act="epingle"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    m.epingle = !m.epingle;
    try { await sauverMorceau(m); } catch { alerteStockage(); return; }
    planifierBackup();
    rendreAccueil(app);
  });
  const suppr = menu.querySelector('[data-act="suppr"]');
  suppr.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (suppr.dataset.sure !== '1') {
      suppr.textContent = 'Confirmer la suppression';
      suppr.dataset.sure = '1';
      setTimeout(() => { if (suppr.isConnected) { suppr.textContent = 'Supprimer'; suppr.dataset.sure = ''; } }, 4000);
      return;
    }
    try { await supprimerMorceau(id); } catch { alerteStockage(); return; }
    planifierBackup();
    rendreAccueil(app);
  });
}

// Crée un morceau à partir d'un bloc de texte collé (ex. depuis le bloc-notes).
function ouvrirColler(app) {
  app.innerHTML = `
    <div class="app-head"><button class="lien-retour" id="annuler">← annuler</button></div>
    <h1 style="font-family:var(--font-display);font-size:22px;margin:4px 0 6px">Coller un texte</h1>
    <p class="vide" style="margin:0 0 10px">Colle ton texte : chaque ligne devient une ligne du morceau. Tu rangeras ensuite en plaçant les brouillons dans les placards.</p>
    <textarea id="coller-zone" placeholder="colle ton texte ici…"
      style="width:100%;min-height:50vh;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:12px;padding:12px;font:inherit;font-size:15px;line-height:1.5;resize:vertical"></textarea>
    <div class="fab"><button id="creer">Créer le morceau</button></div>
  `;
  document.getElementById('annuler').addEventListener('click', () => rendreAccueil(app));
  document.getElementById('coller-zone').focus();
  document.getElementById('creer').addEventListener('click', async () => {
    const t = document.getElementById('coller-zone').value;
    if (!t.trim()) { location.hash = ''; return; }
    const m = morceauDepuisTexte(t);
    try { await sauverMorceau(m); } catch { alerteStockage(); return; }
    planifierBackup();
    location.hash = 'm=' + m.id;
  });
}

function ajouterIdee(app, coffre) {
  const ul = document.getElementById('vrac');
  const li = document.createElement('li');
  li.innerHTML = '<input class="txt ligne-edit" placeholder="une idée en vrac…" style="width:100%">';
  ul.appendChild(li);
  const input = li.querySelector('input');
  input.focus();
  const valider = async () => {
    const texte = input.value.trim();
    if (!texte) { li.remove(); return; }
    coffre.push({ id: uid(), texte, enfants: [] });
    try { await sauverCoffre(coffre); } catch { alerteStockage(); return; }
    planifierBackup();
    rendreAccueil(app);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  input.addEventListener('blur', valider, { once: true });
}

function choisirDestination(app, coffre, ideeId, morceaux) {
  const li = document.querySelector(`.vrac li[data-id="${CSS.escape(ideeId)}"]`);
  if (!li) return;
  if (!morceaux.length) {
    li.querySelector('.txt').insertAdjacentHTML('afterend', '<span class="faded"> — crée d’abord un morceau</span>');
    return;
  }
  li.innerHTML = '<span class="txt faded">envoyer vers :</span>' +
    morceaux.map((m) => `<button class="envoyer" data-mid="${esc(m.id)}">${esc(m.titre || 'Sans titre')}</button>`).join(' ');
  li.querySelectorAll('[data-mid]').forEach((b) => {
    b.addEventListener('click', async () => {
      const m = await getMorceau(b.dataset.mid);
      const r = envoyerIdeeVersMorceau(coffre, ideeId, m);
      try { await sauverCoffre(r.coffre); await sauverMorceau(r.morceau); }
      catch { alerteStockage(); return; }
      planifierBackup();
      location.hash = 'm=' + m.id;
    });
  });
}
