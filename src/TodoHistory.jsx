import { useEffect, useState } from 'react';
import { listTodoWeeks, getTodoEntries } from './storage.js';
import { isoWeekKey, weekRangeLabel } from './todoWeek.js';
import PhotosSection from './PhotosSection.jsx';

// Historique des todo hebdomadaires (lecture seule). Chaque semaine est figée
// via les libellés stockés dans les entries (item_title / item_category).

function groupEntries(entries) {
  const map = new Map();
  for (const e of entries) {
    const cat = e.item_category || 'Sans catégorie';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(e);
  }
  return Array.from(map.entries()).map(([category, list]) => ({ category, items: list }));
}

export default function TodoHistory({ onClose }) {
  const currentWeek = isoWeekKey();
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openWeek, setOpenWeek] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loadingWeek, setLoadingWeek] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setWeeks(await listTodoWeeks());
      } catch (e) {
        setError('Chargement historique KO : ' + (e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openWeekView = async (wk) => {
    setOpenWeek(wk);
    setLoadingWeek(true);
    try {
      setEntries(await getTodoEntries(wk));
    } catch (e) {
      setError('Lecture semaine KO : ' + (e?.message || e));
    } finally {
      setLoadingWeek(false);
    }
  };

  // Vue détail d'une semaine
  if (openWeek) {
    const groups = groupEntries(entries);
    const done = entries.filter((e) => e.done).length;
    const total = entries.length;
    return (
      <div className="min-h-full flex flex-col bg-slate-100">
        <header className="sticky top-0 z-20 bg-blue-800 text-white shadow-lg">
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setOpenWeek(null)}
              className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold px-3 py-2 rounded-lg shadow active:scale-95"
            >
              ←
            </button>
            <div className="flex-1 min-w-0 text-center px-2">
              <h1 className="text-sm font-bold leading-tight truncate">{weekRangeLabel(openWeek)}</h1>
              <p className="text-[11px] text-blue-100">
                {done}/{total} fait{done > 1 ? 's' : ''}
              </p>
            </div>
            <div className="w-[44px]" />
          </div>
        </header>

        <main className="flex-1 px-3 py-3 pb-24 space-y-4">
          {loadingWeek ? (
            <p className="text-center text-slate-500 py-12">Chargement…</p>
          ) : total === 0 ? (
            <p className="text-center text-slate-500 py-12">Aucune donnée pour cette semaine.</p>
          ) : (
            groups.map((g) => (
              <section key={g.category}>
                <h2 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2 px-1">
                  {g.category}
                </h2>
                <div className="space-y-3">
                  {g.items.map((e) => (
                    <div
                      key={e.id}
                      className={`rounded-xl border-2 shadow-sm overflow-hidden ${
                        e.done ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3 px-3 py-3">
                        <span
                          className={`flex-shrink-0 mt-0.5 text-lg font-bold ${
                            e.done ? 'text-green-600' : 'text-slate-400'
                          }`}
                        >
                          {e.done ? '✓' : '○'}
                        </span>
                        <span
                          className={`text-base flex-1 ${
                            e.done ? 'line-through text-slate-500' : 'text-slate-900 font-semibold'
                          }`}
                        >
                          {e.item_title}
                        </span>
                      </div>
                      <div className="px-3 pb-3 space-y-3 border-t border-slate-200 bg-white/60">
                        {e.comment ? (
                          <p className="pt-2 text-sm text-slate-700 whitespace-pre-wrap">
                            {e.comment}
                          </p>
                        ) : (
                          <p className="pt-2 text-sm text-slate-400 italic">Aucun commentaire</p>
                        )}
                        <PhotosSection
                          typoId="todo"
                          unitId={openWeek}
                          section={String(e.item_id)}
                          enabled={true}
                          readOnly={true}
                          labelOverride="Photos"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </main>
      </div>
    );
  }

  // Liste des semaines
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
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-base font-bold leading-tight truncate">Historique todo</h1>
            <p className="text-[11px] text-blue-100">{weeks.length} semaine(s)</p>
          </div>
          <div className="w-[88px]" />
        </div>
      </header>

      <main className="flex-1 px-3 py-4 pb-24 space-y-2">
        {loading ? (
          <p className="text-center text-slate-500 py-12">Chargement…</p>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm font-medium">
            {error}
          </div>
        ) : weeks.length === 0 ? (
          <div className="text-center text-slate-500 py-16">
            <div className="text-5xl mb-3">📅</div>
            <p className="font-bold text-lg">Aucune semaine enregistrée</p>
            <p className="text-sm mt-2">L'historique se remplira au fil des semaines.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {weeks.map((wk) => (
              <li key={wk}>
                <button
                  onClick={() => openWeekView(wk)}
                  className="w-full bg-white rounded-xl shadow-sm border-2 border-slate-200 p-3 flex items-center gap-3 text-left active:scale-[0.99] tap-target"
                >
                  <span className="text-2xl" aria-hidden>
                    📅
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{weekRangeLabel(wk)}</p>
                    {wk === currentWeek && (
                      <span className="inline-block mt-1 text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full uppercase">
                        Semaine en cours
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-lg flex-shrink-0">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
