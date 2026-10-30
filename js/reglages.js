// Préférences locales (par appareil). localStorage protégé par try/catch.
const K_SURL = 'rap.surlignage';

export function surlignageActif() {
  try { return localStorage.getItem(K_SURL) !== 'off'; } catch { return true; }
}

export function basculerSurlignage() {
  const actif = surlignageActif();
  try { localStorage.setItem(K_SURL, actif ? 'off' : 'on'); } catch { /* ignore */ }
  return !actif;
}
