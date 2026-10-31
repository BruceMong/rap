// Écran « À propos » : sauvegarde cloud (filet de sécurité), export, attribution.
import { exporter, etat, remplacer } from './store.js';
import { aCle, getCle, genererCle, definirCle, oublierCle, sauver, restaurer } from './backup.js';
import { esc } from './ui-util.js';

export async function rendreApropos(app) {
  app.innerHTML = `
    <div class="app-head">
      <button class="lien-retour" id="retour">← mes morceaux</button>
      <span class="spacer"></span>
    </div>
    <h1 style="font-family:var(--font-display);font-size:22px;margin:4px 0 12px">À propos</h1>
    <p style="font-size:14.5px">Rap — écrire, ranger les idées en placards, rimer et
    compter les pieds. Tes textes vivent sur ton téléphone.</p>

    <div class="sect-label">Sauvegarde cloud</div>
    <section class="coffre" id="bloc-sauvegarde"></section>

    <div class="sect-label">Export</div>
    <p style="font-size:13.5px;color:var(--muted)">Une copie de tes textes dans un fichier, à garder où tu veux.</p>
    <button id="export" class="icon-btn" style="margin-top:8px;padding:12px 18px;border-radius:12px">
      Exporter mes textes (.json)</button>
    <span id="export-ok" class="etat-dico" hidden> exporté</span>

    <p class="apropos">Données phonétiques :
      <a href="http://www.lexique.org" target="_blank" rel="noopener">Lexique.org</a> (CC-BY-SA).</p>
  `;
  document.getElementById('retour').addEventListener('click', () => { location.hash = ''; });
  document.getElementById('export').addEventListener('click', exporterFichier);
  rendreSauvegarde();
}

async function exporterFichier() {
  const json = await exporter();
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `rap-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  const ok = document.getElementById('export-ok');
  if (ok) ok.hidden = false;
}

function rendreSauvegarde(cleVisible) {
  const bloc = document.getElementById('bloc-sauvegarde');
  if (!bloc) return;

  if (aCle()) {
    const cle = getCle();
    bloc.innerHTML = `
      <p style="font-size:13.5px;margin:0 0 10px">Sauvegarde active sur cet appareil. Tes textes partent
      dans le cloud à chaque modification.</p>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <span class="etat-dico">Clé :</span>
        <code id="cle-aff" style="font-size:13px;background:var(--fill-faint);padding:3px 7px;border-radius:6px">${cleVisible ? esc(cle) : '•'.repeat(12)}</code>
        <button class="mini" id="voir">${cleVisible ? 'masquer' : 'voir'}</button>
        <button class="mini" id="copier">copier</button>
      </div>
      <p class="etat-dico" style="margin:0 0 10px">Garde cette clé : c'est elle qui restaure tes textes sur un autre téléphone.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="icon-btn" id="sauver-now">Sauvegarder maintenant</button>
        <button class="icon-btn" id="restaurer">Restaurer depuis le cloud</button>
        <button class="icon-btn" id="oublier">Oublier la clé ici</button>
      </div>
      <span id="statut" class="etat-dico"></span>`;

    document.getElementById('voir').onclick = () => rendreSauvegarde(!cleVisible);
    document.getElementById('copier').onclick = async () => {
      try { await navigator.clipboard.writeText(cle); statut('clé copiée'); } catch { rendreSauvegarde(true); }
    };
    document.getElementById('sauver-now').onclick = async () => {
      statut('sauvegarde…');
      try { await sauver(await etat()); statut('sauvegardé ' + heure()); }
      catch { statut('échec — réseau ?'); }
    };
    document.getElementById('restaurer').onclick = (e) => confirmer(e.target, 'Écraser mes textes par la sauvegarde ?', faireRestaurer);
    document.getElementById('oublier').onclick = (e) => confirmer(e.target, 'Oublier la clé sur cet appareil ?', () => { oublierCle(); rendreSauvegarde(); });
  } else {
    bloc.innerHTML = `
      <p style="font-size:13.5px;margin:0 0 10px">Sauvegarde tes textes dans le cloud pour ne rien perdre
      si tu changes ou perds ton téléphone.</p>
      <button class="icon-btn" id="activer" style="padding:12px 18px;border-radius:12px">Activer la sauvegarde</button>
      <details style="margin-top:12px">
        <summary class="etat-dico" style="cursor:pointer">J'ai déjà une clé (autre appareil)</summary>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <input id="cle-in" placeholder="colle ta clé" style="flex:1;min-width:0;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:8px;padding:8px;font:inherit;font-size:13px">
          <button class="icon-btn" id="relier">Relier et restaurer</button>
        </div>
      </details>
      <span id="statut" class="etat-dico"></span>`;

    document.getElementById('activer').onclick = async () => {
      definirCle(genererCle());
      statut('sauvegarde…');
      try { await sauver(await etat()); } catch { statut('échec — réseau ?'); return; }
      rendreSauvegarde(true); // affiche la clé la première fois
      statut('activé — note bien ta clé');
    };
    document.getElementById('relier').onclick = async () => {
      const v = document.getElementById('cle-in').value.trim();
      if (v.length < 16) { statut('clé trop courte'); return; }
      definirCle(v);
      await faireRestaurer();
    };
  }
}

async function faireRestaurer() {
  statut('restauration…');
  let r;
  try { r = await restaurer(); } catch { statut('échec — réseau ?'); return; }
  if (!r || !r.donnees) { statut('aucune sauvegarde pour cette clé'); rendreSauvegarde(); return; }
  await remplacer(r.donnees);
  location.reload();
}

function statut(t) { const s = document.getElementById('statut'); if (s) s.textContent = ' ' + t; }
function heure() { return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }

// Confirmation inline (deux clics), sans confirm() natif.
function confirmer(btn, question, action) {
  const t = btn.textContent;
  btn.textContent = question + ' oui';
  const annuler = setTimeout(() => { btn.textContent = t; }, 4000);
  btn.onclick = () => { clearTimeout(annuler); action(); };
}
