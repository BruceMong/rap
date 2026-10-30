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
