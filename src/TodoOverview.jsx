import { useEffect, useMemo, useState } from 'react';
import { listTodoItems, getTodoEntries, getTodoPhotoCounts } from './storage.js';
import { isoWeekKey, weekRangeLabel, parseTodoCategory, priorityInfo } from './todoWeek.js';

// Vue de consultation (Saad) : la todo de la semaine en cours, propre et
// compacte. Grande section (catégorie) + ses sous-points, triés par priorité,
// avec état fait/non fait, commentaire et nombre de photos. Lecture seule.

function buildGroups(items) {
  const map = new Map();
  for (const it of items) {
    const { name } = parseTodoCategory(it.category);
    if (!map.has(name)) map.set(name, { category: name, items: [], _i: map.size });
    map.get(name).items.push(it);
  }
  for (const g of map.values()) {
    g.items.sort(
      (a, b) =>
        priorityInfo(a.priority).rank - priorityInfo(b.priority).rank ||
        (a.position || 0) - (b.position || 0)
    );
    g.minRank = Math.min(...g.items.map((it) => priorityInfo(it.priority).rank));
  }
  return Array.from(map.values()).sort((a, b) => a.minRank - b.minRank || a._i - b._i);
}

export default function TodoOverview({ onClose }) {
  const weekKey = useMemo(() => isoWeekKey(), []);
  const [items, setItems] = useState([]);
  const [entries, setEntries] = useState({});
  const [photoCounts, setPhotoCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [its, ents, pc] = await Promise.all([
          listTodoItems(),
          getTodoEntries(weekKey),
          getTodoPhotoCounts(weekKey).catch(() => ({}))
        ]);
        setItems(its);
        const map = {};
        for (const e of ents) map[e.item_id] = { done: e.done, comment: e.comment || '' };
        setEntries(map);
        setPhotoCounts(pc);
      } catch (e) {
        setError('Chargement KO : ' + (e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [weekKey]);

  const entryFor = (id) => entries[id] || { done: false, comment: '' };
  const groups = buildGroups(items);
  const total = items.length;
  const done = items.filter((it) => entryFor(it.id).done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="min-h-full flex flex-col bg-slate-100">
      <header className="sticky top-0 z-20 bg-blue-800 text-white shadow-lg">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold px-3 py-2 rounded-lg shadow active:scale-95"
          >
            ← Accueil
          </button>
          <div className="flex-1 min-w-0 text-center px-2">
            <h1 className="text-base font-bold leading-tight truncate">Vue todo — semaine en cours</h1>
            <p className="text-[11px] text-blue-100 truncate">{weekRangeLabel(weekKey)}</p>
          </div>
          <div className="w-[70px]" />
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Avancement</span>
            <span>
              {done}/{total} · {pct}%
            </span>
          </div>
          <div className="mt-1 w-full bg-blue-950/60 rounded-full h-2 overflow-hidden">
            <div className="bg-green-400 h-2 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 py-4 pb-24 space-y-4">
        {loading ? (
          <p className="text-center text-slate-500 py-12">Chargement…</p>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm font-medium">
            {error}
          </div>
        ) : total === 0 ? (
          <p className="text-center text-slate-500 py-12">Aucun point pour le moment.</p>
        ) : (
          groups.map((g) => {
            const gDone = g.items.filter((it) => entryFor(it.id).done).length;
            return (
              <section key={g.category} className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 overflow-hidden">
                <h2 className="px-3 py-2.5 bg-blue-800 text-white text-base font-extrabold uppercase tracking-wide flex items-center justify-between gap-2">
                  <span className="flex-1 min-w-0 truncate">{g.category}</span>
                  <span className="text-xs font-semibold bg-white/20 rounded-full px-2 py-0.5 flex-shrink-0">
                    {gDone}/{g.items.length}
                  </span>
                </h2>
                <ul className="divide-y divide-slate-100">
                  {g.items.map((it) => {
                    const e = entryFor(it.id);
                    const pinfo = priorityInfo(it.priority);
                    const nPhotos = photoCounts[String(it.id)] || 0;
                    return (
                      <li key={it.id} className={`px-3 py-2.5 ${e.done ? 'bg-green-50' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex-shrink-0 text-lg font-bold ${
                              e.done ? 'text-green-600' : 'text-slate-300'
                            }`}
                          >
                            {e.done ? '✓' : '○'}
                          </span>
                          <span className="flex-shrink-0" title={pinfo.label} aria-hidden>
                            {pinfo.icon}
                          </span>
                          <span
                            className={`flex-1 text-sm ${
                              e.done ? 'line-through text-slate-500' : 'text-slate-900 font-semibold'
                            }`}
                          >
                            {it.title}
                          </span>
                          {nPhotos > 0 && (
                            <span className="text-xs text-slate-500 flex-shrink-0">📷 {nPhotos}</span>
                          )}
                        </div>
                        {e.comment && (
                          <p className="mt-1 ml-7 text-xs text-slate-600 italic whitespace-pre-wrap">
                            « {e.comment} »
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
