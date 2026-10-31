// Bootstrap + routage. Écrans chargés dynamiquement pour rester robuste pendant
// le développement. Démarrage découplé : l'écran s'affiche, le dico suit en différé.
import { ouvrir, migrerBibliothequeInstrus, StockageIndisponible } from './store.js';
import { chargerDico } from './dico.js';
import { rendreAccueil } from './ui-accueil.js';

const app = document.getElementById('app');

function messageStockage(e) {
  const indispo = e instanceof StockageIndisponible;
  app.innerHTML =
    '<div class="app-head"><h1>Rap</h1></div>' +
    '<p class="vide">' +
    (indispo
      ? 'Le stockage local est indisponible sur ce navigateur (navigation privée ?). '
      : "Impossible d'ouvrir le stockage local sur ce navigateur. ") +
    'Tes textes ne pourraient pas être enregistrés.</p>';
}

async function router() {
  const h = location.hash.slice(1);
  if (!h.startsWith('m=')) {
    try { const { demonterInstru } = await import('./ui-instru.js'); demonterInstru(); } catch { /* ignore */ }
    try { const { demonterPads } = await import('./ui-pads.js'); demonterPads(); } catch { /* ignore */ }
  }
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
    if (h === 'instrus') {
      const mod = await import('./ui-instrus.js');
      await mod.rendreInstrus(app);
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
    console.error('ouverture du stockage impossible', e);
    messageStockage(e); // tout échec d'ouverture → message, jamais d'écran blanc
    return;
  }
  await migrerBibliothequeInstrus().catch((e) => console.warn('migration instrus', e));
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  window.addEventListener('hashchange', router);
  await router();
  chargerDico().catch(() => {});
}

init();
