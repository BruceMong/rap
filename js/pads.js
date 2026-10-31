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

// Joue le son tout de suite (one-shot). Précharge au besoin. Renvoie la source,
// ou null si le décodage échoue (format non lisible).
export async function jouer(son) {
  const c = assurerContexte();
  try {
    if (!buffers.has(son.id)) await precharger(son);
  } catch {
    return null;
  }
  const src = c.createBufferSource();
  src.buffer = buffers.get(son.id);
  src.connect(c.destination);
  src.start();
  return src;
}

// Oublie le buffer d'un son (après suppression/remplacement).
export function oublier(id) { buffers.delete(id); }
