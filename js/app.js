// Bootstrap + routage. Écrans chargés dynamiquement pour rester robuste pendant
// le développement. Démarrage découplé : l'écran s'affiche, le dico suit en différé.
import { ouvrir, StockageIndisponible } from './store.js';
import { chargerDico } from './dico.js';
import { rendreAccueil } from './ui-accueil.js';

const app = document.getElementById('app');

function messageStockage() {
  app.innerHTML =
    '<div class="app-head"><h1>Rap</h1></div>' +
    '<p class="vide">Le stockage local est indisponible sur ce navigateur ' +
    '(navigation privée ?). Tes textes ne pourraient pas être enregistrés.</p>';
}

async function router() {
  const h = location.hash.slice(1);
  try {
    if (h.startsWith('m=')) {
      const { rendreMorceau } = await import('./ui-morceau.js');
      await rendreMorceau(app, h.slice(2));
      return;
    }
    if (h === 'apropos') {
      const mod = await import('./ui-apropos.js');
      await mod.rendreApropos(app);
      return;
    }
  } catch (e) {
    console.warn('écran indisponible, retour accueil', e);
  }
  await rendreAccueil(app);
}

async function init() {
  try {
    await ouvrir();
  } catch (e) {
    if (e instanceof StockageIndisponible) { messageStockage(); return; }
    throw e;
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  window.addEventListener('hashchange', router);
  await router();
  chargerDico().catch(() => {});
}

init();
