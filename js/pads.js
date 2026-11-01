// Moteur de pads : déclenchement d'ad-libs à faible latence via Web Audio API.
// Chaque son est décodé une fois en AudioBuffer puis rejoué par une source neuve
// à chaque tap → latence minimale, superposable, re-déclenchable en rafale. Se
// mixe par-dessus l'instru (élément <audio> séparé) sans l'interrompre.
let ctx = null;
const buffers = new Map(); // sonId -> AudioBuffer décodé

function assurerContexte() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// À appeler sur un geste utilisateur (déverrouille l'audio sur mobile).
export function reveiller() { assurerContexte(); }

// Décode et met en cache le buffer d'un son (idempotent). son = { id, buf, type }.
export async function precharger(son) {
  if (buffers.has(son.id)) return;
  const c = assurerContexte();
  // decodeAudioData détache le ArrayBuffer qu'on lui passe : on clone pour garder
  // son.buf réutilisable (rechargements, re-décodage après oubli).
  const copie = son.buf.slice(0);
  const audioBuf = await c.decodeAudioData(copie);
  buffers.set(son.id, audioBuf);
}

// Joue le son tout de suite (one-shot). Précharge au besoin. Applique le volume
// (son.volume 0..1) et le rognage (son.trimStart/trimEnd en s). Renvoie la source,
// ou null si le décodage échoue (format non lisible).
export async function jouer(son) {
  const c = assurerContexte();
  try {
    if (!buffers.has(son.id)) await precharger(son);
  } catch {
    return null;
  }
  const buf = buffers.get(son.id);
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = (son.volume == null ? 1 : son.volume);
  src.connect(gain).connect(c.destination);
  const a = Math.max(0, son.trimStart || 0);
  const b = (son.trimEnd && son.trimEnd > a) ? Math.min(son.trimEnd, buf.duration) : buf.duration;
  src.start(0, a, Math.max(0.02, b - a));
  return src;
}

// Durée (s) d'un son, pour l'éditeur. Précharge au besoin.
export async function duree(son) {
  if (!buffers.has(son.id)) { try { await precharger(son); } catch { return 0; } }
  return buffers.get(son.id).duration || 0;
}

// Oublie le buffer d'un son (après suppression/remplacement).
export function oublier(id) { buffers.delete(id); }
