// Utilitaires de semaine ISO (lundi → dimanche) pour la todo hebdomadaire.

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

// Libellé lisible, ex. "Semaine 38 · 15 – 21 sept. 2026".
export function weekRangeLabel(weekKey) {
  const monday = mondayOfWeekKey(weekKey);
  if (!monday) return weekKey || '';
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const week = +/W(\d{2})$/.exec(weekKey)[1];
  const fmt = (dt) =>
    dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  return `Semaine ${week} · ${fmt(monday)} – ${fmt(sunday)} ${monday.getUTCFullYear()}`;
}

// Libellé court, ex. "Sem. 38 (15/09)".
export function weekShortLabel(weekKey) {
  const monday = mondayOfWeekKey(weekKey);
  if (!monday) return weekKey || '';
  const week = +/W(\d{2})$/.exec(weekKey)[1];
  const fmt = (dt) =>
    dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  return `Sem. ${week} · dès le ${fmt(monday)}`;
}
