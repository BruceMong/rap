// Écran d'accueil : coffre à idées transversal + morceaux en cours / terminés.
import { listerMorceaux, getCoffre, sauverCoffre, sauverMorceau, getMorceau } from './store.js';
import { creerMorceau, envoyerIdeeVersMorceau, morceauDepuisTexte, uid } from './model.js';
import { esc, dateRelative, alerteStockage } from './ui-util.js';
import { planifier as planifierBackup } from './backup.js';

function apercu(m) {
  const l = (m.lignes || []).find((x) => x.texte && x.texte.trim());
  return l ? l.texte.trim() : 'Vide pour l’instant';
}
function nbPlacards(m) {
  return (m.lignes || []).reduce((n, l) => n + (l.placards ? l.placards.length : 0), 0);
}

function carte(m) {
  const pill = m.statut === 'fini'
    ? '<span class="pill fini">fini</span>'
    : '<span class="pill encours">en cours</span>';
  const np = nbPlacards(m);
  const meta = [
    `<b>${(m.lignes || []).length}</b> lignes`,
    np ? `<b>${np}</b> placards` : '',
    dateRelative(m.modifieLe),
  ].filter(Boolean).map((x) => `<span>${x}</span>`).join('');
  return `<button class="morceau" data-id="${esc(m.id)}">
    <div class="m-top"><span class="m-title">${esc(m.titre || 'Sans titre')}</span>${pill}</div>
    <div class="m-apercu">${esc(apercu(m))}</div>
    <div class="m-meta">${meta}</div>
  </button>`;
}

export async function rendreAccueil(app) {
  const [morceaux, coffre] = await Promise.all([listerMorceaux(), getCoffre()]);
  morceaux.sort((a, b) => (b.modifieLe || 0) - (a.modifieLe || 0));
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

  app.querySelectorAll('.morceau').forEach((btn) => {
    btn.addEventListener('click', () => { location.hash = 'm=' + btn.dataset.id; });
  });

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
