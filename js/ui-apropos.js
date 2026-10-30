// Écran « À propos » : export des textes + attribution des données.
import { exporter } from './store.js';

export async function rendreApropos(app) {
  app.innerHTML = `
    <div class="app-head">
      <button class="lien-retour" id="retour">← mes morceaux</button>
      <span class="spacer"></span>
    </div>
    <h1 style="font-family:var(--font-display);font-size:22px;margin:4px 0 12px">À propos</h1>
    <p style="font-size:14.5px">Rap — écrire, ranger les idées en placards, rimer et
    compter les pieds. Tout reste sur ton téléphone, hors ligne.</p>

    <div class="sect-label">Sauvegarde</div>
    <p style="font-size:13.5px;color:var(--muted)">Tes textes vivent dans ce navigateur.
    Exporte-les de temps en temps pour les mettre à l'abri (ou changer de téléphone).</p>
    <button id="export" class="icon-btn" style="margin-top:8px;padding:12px 18px;border-radius:12px">
      Exporter mes textes (.json)</button>
    <span id="export-ok" class="etat-dico" hidden> exporté</span>

    <p class="apropos">Données phonétiques :
      <a href="http://www.lexique.org" target="_blank" rel="noopener">Lexique.org</a>
      (New BSD / CC-BY-SA).</p>
  `;
  document.getElementById('retour').addEventListener('click', () => { location.hash = ''; });
  document.getElementById('export').addEventListener('click', async () => {
    const json = await exporter();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rap-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const ok = document.getElementById('export-ok');
    if (ok) ok.hidden = false;
  });
}
