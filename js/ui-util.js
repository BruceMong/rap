// Petits utilitaires d'interface partagés par les écrans.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function dateRelative(ts) {
  if (!ts) return '';
  const j = Math.floor((Date.now() - ts) / 86400000);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return 'hier';
  if (j < 7) return `il y a ${j} j`;
  if (j < 30) return `il y a ${Math.floor(j / 7)} sem`;
  return `le ${new Date(ts).toLocaleDateString('fr-FR')}`;
}

// Auto-agrandit un textarea à son contenu.
export function autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

// Bandeau persistant quand une écriture dans le stockage échoue (quota/plein) :
// l'utilisateur est prévenu et invité à exporter, jamais de perte silencieuse.
export function alerteStockage() {
  if (document.getElementById('banniere-stockage')) return;
  const b = document.createElement('div');
  b.id = 'banniere-stockage';
  b.className = 'banniere-stockage';
  b.textContent = 'Enregistrement impossible (stockage plein ?). Exporte tes textes pour ne rien perdre.';
  document.body.appendChild(b);
}

