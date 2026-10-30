// Bootstrap + routage entre l'accueil (#accueil) et un morceau (#m=<id>).
// Démarrage découplé : l'écran s'affiche d'abord, le dico se charge en différé.
import { ouvrir, StockageIndisponible } from './store.js';
import { chargerDico } from './dico.js';

const app = document.getElementById('app');

function messageStockage() {
  app.innerHTML =
    '<div class="app-head"><h1>Rap</h1></div>' +
    '<p class="vide">Le stockage local est indisponible sur ce navigateur ' +
    '(navigation privée ?). Tes textes ne pourraient pas être enregistrés.</p>';
}

// Remplacé par le vrai routeur en Task 10/11.
async function router() {
  app.innerHTML = '<div class="app-head"><h1>Rap</h1></div><p class="vide">Écran en construction…</p>';
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
  window.addEventListener('hashchange', router);
  await router();
  chargerDico().catch(() => {}); // différé, hors ligne une fois en cache
}

init();
