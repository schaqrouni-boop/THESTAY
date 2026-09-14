// Utilitaires de semaine ISO (lundi → dimanche) pour la todo hebdomadaire.

// Priorité PAR TÂCHE : 3 niveaux avec picto + couleur + rang de tri.
export const PRIORITIES = {
  EXTREME: {
    key: 'EXTREME',
    label: 'Extrême',
    icon: '🔴',
    rank: 0,
    badge: 'bg-red-600',
    text: 'text-red-700',
    cardBorder: 'border-red-400',
    cardBg: 'bg-red-50'
  },
  HAUTE: {
    key: 'HAUTE',
    label: 'Haute',
    icon: '🟠',
    rank: 1,
    badge: 'bg-orange-500',
    text: 'text-orange-700',
    cardBorder: 'border-orange-400',
    cardBg: 'bg-orange-50'
  },
  NORMALE: {
    key: 'NORMALE',
    label: 'Normale',
    icon: '🟢',
    rank: 2,
    badge: 'bg-emerald-600',
    text: 'text-emerald-700',
    cardBorder: 'border-slate-300',
    cardBg: 'bg-white'
  }
};

export const PRIORITY_KEYS = ['EXTREME', 'HAUTE', 'NORMALE'];

export function priorityInfo(p) {
  return PRIORITIES[String(p || 'NORMALE').toUpperCase()] || PRIORITIES.NORMALE;
}

// Priorité de catégorie : une catégorie dont le libellé contient "(PRIORITÉ …)"
// (ou toute variante contenant "prio", robuste aux fautes de frappe) est
// considérée prioritaire → affichée en rouge et remontée en haut de la todo.
// On renvoie le nom nettoyé (sans le marqueur) + le flag.
export function parseTodoCategory(raw) {
  const s = (raw || '').trim();
  const priority = /prio/i.test(s);
  const name = s.replace(/\s*\((?=[^)]*prio)[^)]*\)\s*$/i, '').trim() || 'Sans catégorie';
  return { name, priority };
}

// Clé de semaine ISO, ex. "2026-W38".
export function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // lun=1 … dim=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // jeudi de la semaine ISO
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Lundi (Date UTC) d'une clé de semaine ISO.
function mondayOfWeekKey(weekKey) {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey || '');
  if (!m) return null;
  const year = +m[1];
  const week = +m[2];
  // 4 janvier est toujours dans la semaine ISO 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow + 1);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

// Libellé lisible en plage de dates (Nabil raisonne du lundi au dimanche,
// pas en numéro de semaine), ex. "Du 14 au 20 sept. 2026" — ou, à cheval sur
// deux mois, "Du 29 sept. au 5 oct. 2026".
export function weekRangeLabel(weekKey) {
  const monday = mondayOfWeekKey(weekKey);
  if (!monday) return weekKey || '';
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const day = (dt) => dt.toLocaleDateString('fr-FR', { day: 'numeric', timeZone: 'UTC' });
  const dayMonth = (dt) =>
    dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const sameMonth =
    monday.getUTCMonth() === sunday.getUTCMonth() &&
    monday.getUTCFullYear() === sunday.getUTCFullYear();
  const year = sunday.getUTCFullYear();
  return sameMonth
    ? `Du ${day(monday)} au ${dayMonth(sunday)} ${year}`
    : `Du ${dayMonth(monday)} au ${dayMonth(sunday)} ${year}`;
}
