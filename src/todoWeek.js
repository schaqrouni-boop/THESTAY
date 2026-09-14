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
