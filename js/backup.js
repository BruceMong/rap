// Sauvegarde cloud (filet de sécurité) via Supabase.
// La clé secrète vit sur l'appareil (localStorage), jamais dans le code ; la base
// ne stocke que son empreinte. URL et clé publique ci-dessous sont publiques par design.
import { etat } from './store.js';

const URL = 'https://mttoschvyjnzamtehajy.supabase.co';
const CLE_PUB = 'sb_publishable_3f7PnLDevrx1_ZYb3_2MRQ_xy9MaWsN';
const K = 'rap.cle';

let cleMemoire = null; // repli hors navigateur (tests)
let timer = null;

function ls() {
  try { return (typeof localStorage !== 'undefined') ? localStorage : null; } catch { return null; }
}

export function getCle() {
  const s = ls();
  if (s) { try { return s.getItem(K) || cleMemoire; } catch { return cleMemoire; } }
  return cleMemoire;
}
export function aCle() { return !!getCle(); }
export function definirCle(c) {
  cleMemoire = c || null;
  const s = ls();
  if (s) { try { if (c) s.setItem(K, c); else s.removeItem(K); } catch { /* ignore */ } }
}
export function oublierCle() { definirCle(null); }

// Clé lisible en groupes de 5, ~40 hex (160 bits) : non brute-forçable.
export function genererCle() {
  const b = new Uint8Array(20);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(b);
  let hex = '';
  for (const x of b) hex += x.toString(16).padStart(2, '0');
  if (!/[1-9a-f]/.test(hex)) hex = (Date.now().toString(36) + Math.random().toString(36).slice(2)).padEnd(40, '0');
  return hex.slice(0, 40).replace(/(.{5})(?=.)/g, '$1-');
}

async function rpc(fn, params) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: CLE_PUB, Authorization: `Bearer ${CLE_PUB}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`backup ${fn}: ${res.status}`);
  return res.json();
}

export async function sauver(donnees) {
  const cle = getCle();
  if (!cle) throw new Error('pas de clé');
  return rpc('rap_sauver', { p_cle: cle, p_donnees: donnees }); // → modifie_le
}

export async function restaurer() {
  const cle = getCle();
  if (!cle) throw new Error('pas de clé');
  const lignes = await rpc('rap_restaurer', { p_cle: cle });
  return (lignes && lignes[0]) ? lignes[0] : null; // { donnees, modifie_le } ou null
}

// Sauvegarde auto débouncée : silencieuse sans clé. Appelée après chaque écriture locale.
export function planifier(onErreur) {
  if (!aCle()) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try { await sauver(await etat()); } catch (e) { if (onErreur) onErreur(e); }
  }, 2500);
}
