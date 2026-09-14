import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listTodoItems,
  getTodoEntries,
  upsertTodoEntry,
  subscribeTodoItems,
  subscribeTodoEntries
} from './storage.js';
import { isoWeekKey, weekRangeLabel, parseTodoCategory } from './todoWeek.js';
import PhotosSection from './PhotosSection.jsx';

// Todo hebdomadaire du technicien.
// - Points groupés par catégorie (gérés par l'admin), semaine calendaire auto.
// - Catégories prioritaires affichées en rouge et en tête.
// - Pour chaque point : case Done, commentaire (auto-save), photos.

function groupByCategory(items) {
  const map = new Map();
  for (const it of items) {
    const { name, priority } = parseTodoCategory(it.category);
    if (!map.has(name)) map.set(name, { category: name, priority: false, items: [] });
    const g = map.get(name);
    g.items.push(it);
    if (priority) g.priority = true;
  }
  const arr = Array.from(map.values());
  arr.forEach((g, i) => (g._i = i));
  // Prioritaires d'abord, ordre d'apparition (position) conservé sinon.
  arr.sort((a, b) => Number(b.priority) - Number(a.priority) || a._i - b._i);
  return arr;
}

export default function TodoView({ user, role, onOpenReception, onOpenHistory, onLogout }) {
  const weekKey = useMemo(() => isoWeekKey(), []);
  const readOnly = role === 'admin';

  const [items, setItems] = useState([]);
  const [entries, setEntries] = useState({}); // { [itemId]: { done, comment } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const commentTimers = useRef({});
  const entriesRef = useRef({});
  entriesRef.current = entries;

  const load = async () => {
    try {
      const [its, ents] = await Promise.all([listTodoItems(), getTodoEntries(weekKey)]);
      setItems(its);
      const map = {};
      for (const e of ents) map[e.item_id] = { done: e.done, comment: e.comment || '' };
      setEntries(map);
    } catch (e) {
      setError('Chargement todo KO : ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsubItems = subscribeTodoItems(() => load());
    const unsubEntries = subscribeTodoEntries(weekKey, (payload) => {
      // MAJ ciblée sans tout recharger (évite d'écraser une saisie en cours).
      const row = payload.new;
      if (!row) return;
      setEntries((prev) => {
        // Ne pas écraser si on a un timer de commentaire en attente pour ce point.
        if (commentTimers.current[row.item_id]) return prev;
        return { ...prev, [row.item_id]: { done: row.done, comment: row.comment || '' } };
      });
    });
    return () => {
      unsubItems();
      unsubEntries();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

  const entryFor = (id) => entries[id] || { done: false, comment: '' };

  const saveEntry = async (item, next) => {
    try {
      await upsertTodoEntry({
        weekKey,
        item,
        done: next.done,
        comment: next.comment,
        updatedBy: user
      });
    } catch (e) {
      console.warn('Sauvegarde todo KO', e);
    }
  };

  const toggleDone = (item) => {
    if (readOnly) return;
    const cur = entryFor(item.id);
    const next = { done: !cur.done, comment: cur.comment };
    setEntries((prev) => ({ ...prev, [item.id]: next }));
    saveEntry(item, next);
  };

  const changeComment = (item, value) => {
    if (readOnly) return;
    const cur = entryFor(item.id);
    const next = { done: cur.done, comment: value };
    setEntries((prev) => ({ ...prev, [item.id]: next }));
    if (commentTimers.current[item.id]) clearTimeout(commentTimers.current[item.id]);
    commentTimers.current[item.id] = setTimeout(() => {
      delete commentTimers.current[item.id];
      saveEntry(item, entriesRef.current[item.id] || next);
    }, 800);
  };

  const groups = groupByCategory(items);
  const total = items.length;
  const done = items.filter((it) => entryFor(it.id).done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="min-h-full flex flex-col bg-slate-100">
      <header className="sticky top-0 z-20 bg-blue-800 text-white shadow-lg">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">Ma todo de la semaine</h1>
              <p className="text-[11px] text-blue-100 truncate">
                {weekRangeLabel(weekKey)} · {user}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold px-3 py-2 rounded-lg shadow active:scale-95 flex-shrink-0"
              title="Déconnexion"
            >
              ⏻
            </button>
          </div>

          <div className="mt-3 bg-blue-900/40 rounded-lg p-2">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Avancement de la semaine</span>
              <span>
                {done}/{total} · {pct}%
              </span>
            </div>
            <div className="mt-1 w-full bg-blue-950/60 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-400 h-2 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={onOpenReception}
              className="flex-1 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-3 py-2 rounded-lg active:scale-95"
            >
              🛠️ Réception travaux
            </button>
            <button
              onClick={onOpenHistory}
              className="flex-1 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-3 py-2 rounded-lg active:scale-95"
            >
              📅 Historique
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 py-3 pb-24 space-y-4">
        {loading ? (
          <p className="text-center text-slate-500 py-12">Chargement…</p>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm font-medium">
            {error}
          </div>
        ) : total === 0 ? (
          <div className="text-center text-slate-500 py-16">
            <div className="text-5xl mb-3">✅</div>
            <p className="font-bold text-lg">Aucun point cette semaine</p>
            <p className="text-sm mt-2">Les points ajoutés par l'administration apparaîtront ici.</p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.category}>
              <h2
                className={`text-xs font-bold uppercase tracking-wide mb-2 px-1 flex items-center gap-2 ${
                  g.priority ? 'text-red-700' : 'text-blue-800'
                }`}
              >
                {g.category}
                {g.priority && (
                  <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full normal-case">
                    ⚠ Priorité haute
                  </span>
                )}
              </h2>
              <div className="space-y-3">
                {g.items.map((item) => {
                  const e = entryFor(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border-2 shadow-sm overflow-hidden ${
                        e.done
                          ? 'border-green-500 bg-green-50'
                          : g.priority
                          ? 'border-red-400 bg-red-50'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      <label
                        className={`flex items-start gap-3 px-3 py-3 ${
                          readOnly ? '' : 'cursor-pointer active:bg-black/5'
                        } tap-target`}
                      >
                        <input
                          type="checkbox"
                          className="big-check flex-shrink-0 mt-0.5"
                          checked={e.done}
                          onChange={() => toggleDone(item)}
                          disabled={readOnly}
                        />
                        <span
                          className={`text-base flex-1 ${
                            e.done ? 'line-through text-slate-500' : 'text-slate-900 font-semibold'
                          }`}
                        >
                          {item.title}
                        </span>
                        {e.done && (
                          <span className="text-green-600 text-xl font-bold flex-shrink-0">✓</span>
                        )}
                      </label>

                      <div className="px-3 pb-3 space-y-3 border-t border-slate-200 bg-white/60">
                        <div className="pt-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Commentaire
                          </label>
                          <textarea
                            value={e.comment}
                            onChange={(ev) => changeComment(item, ev.target.value)}
                            readOnly={readOnly}
                            rows={2}
                            placeholder={readOnly ? '—' : 'Remarque, blocage, précision…'}
                            className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none resize-y"
                          />
                        </div>
                        <PhotosSection
                          typoId="todo"
                          unitId={weekKey}
                          section={String(item.id)}
                          enabled={true}
                          readOnly={readOnly}
                          labelOverride="Photos"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-2 text-center text-xs text-slate-500">
        {user} · todo hebdomadaire
      </footer>
    </div>
  );
}
