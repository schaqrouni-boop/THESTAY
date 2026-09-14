import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listTodoItems,
  getTodoEntries,
  upsertTodoEntry,
  createTodoItem,
  subscribeTodoItems,
  subscribeTodoEntries
} from './storage.js';
import {
  isoWeekKey,
  weekRangeLabel,
  parseTodoCategory,
  priorityInfo,
  PRIORITIES,
  PRIORITY_KEYS
} from './todoWeek.js';
import PhotosSection from './PhotosSection.jsx';

// Todo hebdomadaire du technicien.
// - Points groupés par catégorie (affichée une seule fois), triés par priorité.
// - Priorité par tâche (Extrême/Haute/Normale) avec picto + couleur.
// - Filtre par priorité, section "PROBLEMES DIVERS NABIL" que Nabil alimente,
//   lien vers le registre des appartements finis et fermés.

const NABIL_CATEGORY = 'PROBLEMES DIVERS NABIL';

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
    // Rang de la section = priorité la plus forte qu'elle contient (extrême = 0).
    g.minRank = Math.min(...g.items.map((it) => priorityInfo(it.priority).rank));
  }
  // Sections triées : celles avec des points extrêmes d'abord, puis haute, puis normale.
  return Array.from(map.values()).sort((a, b) => a.minRank - b.minRank || a._i - b._i);
}

export default function TodoView({ user, role, onOpenReception, onOpenHistory, onOpenClosed, onLogout }) {
  const weekKey = useMemo(() => isoWeekKey(), []);
  const readOnly = role === 'admin';

  const [items, setItems] = useState([]);
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [newProblem, setNewProblem] = useState('');
  const [newProblemPrio, setNewProblemPrio] = useState('HAUTE');

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
      const row = payload.new;
      if (!row) return;
      setEntries((prev) => {
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
      await upsertTodoEntry({ weekKey, item, done: next.done, comment: next.comment, updatedBy: user });
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

  const addProblem = async () => {
    const title = newProblem.trim();
    if (!title) return;
    try {
      await createTodoItem({
        category: NABIL_CATEGORY,
        title,
        priority: newProblemPrio,
        position: Date.now()
      });
      setNewProblem('');
      await load();
    } catch (e) {
      setError('Ajout KO : ' + (e?.message || e));
    }
  };

  const allGroups = buildGroups(items);
  const mainGroups = allGroups.filter((g) => g.category !== NABIL_CATEGORY);
  const nabilGroup = allGroups.find((g) => g.category === NABIL_CATEGORY) || {
    category: NABIL_CATEGORY,
    items: []
  };

  const matchFilter = (it) => filter === 'ALL' || String(it.priority || 'NORMALE').toUpperCase() === filter;

  const total = items.length;
  const done = items.filter((it) => entryFor(it.id).done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const renderTask = (item, priorityAware = true) => {
    const e = entryFor(item.id);
    const pinfo = priorityInfo(item.priority);
    return (
      <div
        key={item.id}
        className={`rounded-xl border-2 shadow-sm overflow-hidden ${
          e.done ? 'border-green-500 bg-green-50' : `${pinfo.cardBorder} ${pinfo.cardBg}`
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
          <span className="text-lg flex-shrink-0 mt-0.5" title={pinfo.label} aria-hidden>
            {pinfo.icon}
          </span>
          <span
            className={`text-base flex-1 ${
              e.done ? 'line-through text-slate-500' : 'text-slate-900 font-semibold'
            }`}
          >
            {item.title}
          </span>
          {e.done && <span className="text-green-600 text-xl font-bold flex-shrink-0">✓</span>}
        </label>
        <div className="px-3 pb-3 space-y-3 border-t border-slate-200 bg-white/60">
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Commentaire</label>
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
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-100">
      <header className="sticky top-0 z-20 bg-blue-800 text-white shadow-lg">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">Ma todo</h1>
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
              <div className="bg-green-400 h-2 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={onOpenReception}
              className="flex-1 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-2 py-2 rounded-lg active:scale-95"
            >
              🛠️ Réception
            </button>
            <button
              onClick={onOpenClosed}
              className="flex-1 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-2 py-2 rounded-lg active:scale-95"
            >
              🏢 Appts fermés
            </button>
            <button
              onClick={onOpenHistory}
              className="flex-1 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-2 py-2 rounded-lg active:scale-95"
            >
              📅 Historique
            </button>
          </div>
        </div>

        {/* Filtre par priorité */}
        <div className="bg-slate-100 border-t border-blue-900/30 px-3 py-2 overflow-x-auto">
          <div className="flex gap-2">
            {[{ key: 'ALL', label: 'Tout', icon: '📋' }, ...PRIORITY_KEYS.map((k) => ({ key: k, label: PRIORITIES[k].label, icon: PRIORITIES[k].icon }))].map(
              (f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                      active
                        ? 'bg-blue-800 text-white border-blue-800'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {f.icon} {f.label}
                  </button>
                );
              }
            )}
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
        ) : (
          <>
            {mainGroups.map((g) => {
              const shown = g.items.filter(matchFilter);
              if (shown.length === 0) return null;
              return (
                <section key={g.category}>
                  <h2 className="mb-2 px-3 py-2.5 rounded-lg text-lg font-extrabold uppercase tracking-wide shadow-sm bg-blue-800 text-white">
                    {g.category}
                  </h2>
                  <div className="space-y-3">{shown.map((item) => renderTask(item))}</div>
                </section>
              );
            })}

            {total === 0 && (
              <div className="text-center text-slate-500 py-10">
                <div className="text-5xl mb-3">✅</div>
                <p className="font-bold text-lg">Aucun point cette semaine</p>
                <p className="text-sm mt-2">Les points ajoutés par l'administration apparaîtront ici.</p>
              </div>
            )}

            {/* Section exclusive de Nabil */}
            {(!readOnly || nabilGroup.items.length > 0) && (
              <section>
                <h2 className="mb-2 px-3 py-2.5 rounded-lg text-lg font-extrabold uppercase tracking-wide shadow-sm bg-indigo-700 text-white flex items-center gap-2">
                  <span aria-hidden>🧠</span>
                  <span className="flex-1 min-w-0">Problèmes divers Nabil</span>
                </h2>
                {!readOnly && (
                  <div className="bg-white rounded-xl border-2 border-indigo-200 p-3 mb-3 space-y-2">
                    <p className="text-xs text-slate-500">
                      Ajoute ici ce que tu remarques (à valider avec Saad).
                    </p>
                    <div className="flex gap-2">
                      <select
                        value={newProblemPrio}
                        onChange={(e) => setNewProblemPrio(e.target.value)}
                        className="px-2 py-2 text-sm border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                      >
                        {PRIORITY_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {PRIORITIES[k].icon} {PRIORITIES[k].label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={newProblem}
                        onChange={(e) => setNewProblem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addProblem()}
                        placeholder="Nouveau problème / remarque…"
                        className="flex-1 min-w-0 px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={addProblem}
                        disabled={!newProblem.trim()}
                        className="bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold px-4 rounded-lg active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {nabilGroup.items.filter(matchFilter).map((item) => renderTask(item))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-2 text-center text-xs text-slate-500">
        {user} · todo hebdomadaire
      </footer>
    </div>
  );
}
