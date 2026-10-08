import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listTodoItems,
  createTodoItem,
  updateTodoItem,
  deleteTodoItem,
  renameTodoCategory,
  deleteTodoCategory
} from './storage.js';
import { PRIORITIES, PRIORITY_KEYS, priorityInfo } from './todoWeek.js';

// Gestion de la todo (admin), vue GROUPÉE : chaque catégorie principale est
// affichée une seule fois en tête, avec ses sous-tâches imbriquées dessous.
// On peut : ajouter une catégorie, renommer/supprimer une catégorie, ajouter /
// éditer (titre + priorité) / supprimer / réordonner une tâche dans sa catégorie.

export default function TodoAdmin({ onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ajout d'une nouvelle catégorie (nom + premier point)
  const [newCat, setNewCat] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPrio, setNewTaskPrio] = useState('NORMALE');

  // Saisies locales par catégorie (ajout de tâche + renommage en cours)
  const [addTitle, setAddTitle] = useState({});
  const [addPrio, setAddPrio] = useState({});
  const [catEdit, setCatEdit] = useState({});

  const timers = useRef({});

  const load = async () => {
    try {
      setItems(await listTodoItems());
    } catch (e) {
      setError('Chargement KO : ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Groupe par catégorie (ordre de première apparition), tâches triées par position.
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const c = it.category || 'Sans catégorie';
      if (!map.has(c)) map.set(c, []);
      map.get(c).push(it);
    }
    for (const arr of map.values())
      arr.sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id);
    return Array.from(map.entries()).map(([category, list]) => ({ category, list }));
  }, [items]);

  const categories = useMemo(() => groups.map((g) => g.category), [groups]);
  const maxPos = () => items.reduce((m, i) => Math.max(m, i.position || 0), 0);

  const patchLocal = (id, patch) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const saveField = (id, patch, debounce = true) => {
    if (timers.current[id]) clearTimeout(timers.current[id]);
    const run = async () => {
      delete timers.current[id];
      try {
        await updateTodoItem(id, patch);
      } catch (e) {
        console.warn('MAJ point KO', e);
      }
    };
    if (debounce) timers.current[id] = setTimeout(run, 700);
    else run();
  };

  const addCategory = async () => {
    const cat = newCat.trim();
    const title = newTaskTitle.trim();
    if (!cat || !title) return;
    setError(null);
    try {
      await createTodoItem({ category: cat, title, priority: newTaskPrio, position: maxPos() + 1 });
      setNewCat('');
      setNewTaskTitle('');
      await load();
    } catch (e) {
      setError('Ajout KO : ' + (e?.message || e));
    }
  };

  const addTask = async (cat) => {
    const title = (addTitle[cat] || '').trim();
    if (!title) return;
    const prio = addPrio[cat] || 'NORMALE';
    try {
      await createTodoItem({ category: cat, title, priority: prio, position: maxPos() + 1 });
      setAddTitle((p) => ({ ...p, [cat]: '' }));
      await load();
    } catch (e) {
      setError('Ajout KO : ' + (e?.message || e));
    }
  };

  const commitRename = async (oldName) => {
    const n = (catEdit[oldName] ?? '').trim();
    setCatEdit((p) => {
      const c = { ...p };
      delete c[oldName];
      return c;
    });
    if (!n || n === oldName) return;
    try {
      await renameTodoCategory(oldName, n);
      await load();
    } catch (e) {
      setError('Renommage KO : ' + (e?.message || e));
    }
  };

  const removeCategory = async (cat) => {
    if (!window.confirm(`Supprimer toute la catégorie « ${cat} » et ses points ?`)) return;
    try {
      await deleteTodoCategory(cat);
      await load();
    } catch (e) {
      setError('Suppression KO : ' + (e?.message || e));
    }
  };

  const removeTask = async (item) => {
    if (!window.confirm(`Supprimer « ${item.title} » ?`)) return;
    try {
      await deleteTodoItem(item.id);
      await load();
    } catch (e) {
      setError('Suppression KO : ' + (e?.message || e));
    }
  };

  const moveTask = async (list, idx, dir) => {
    const t = idx + dir;
    if (t < 0 || t >= list.length) return;
    const a = list[idx];
    const b = list[t];
    const pa = a.position ?? idx;
    const pb = b.position ?? t;
    patchLocal(a.id, { position: pb });
    patchLocal(b.id, { position: pa });
    try {
      await Promise.all([
        updateTodoItem(a.id, { position: pb }),
        updateTodoItem(b.id, { position: pa })
      ]);
    } catch (e) {
      console.warn('Réordonnancement KO', e);
      load();
    }
  };

  const prioOptions = PRIORITY_KEYS.map((k) => (
    <option key={k} value={k}>
      {PRIORITIES[k].icon} {PRIORITIES[k].label}
    </option>
  ));

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
            <h1 className="text-base font-bold leading-tight truncate">Gérer la todo</h1>
            <p className="text-[11px] text-blue-100">
              {categories.length} catégorie(s) · {items.length} point(s)
            </p>
          </div>
          <div className="w-[88px]" />
        </div>
      </header>

      <main className="flex-1 px-3 py-4 pb-24 space-y-4">
        {/* Ajout d'une nouvelle catégorie */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-green-200 p-3 space-y-2">
          <h2 className="text-sm font-bold text-slate-700">Ajouter une catégorie</h2>
          <input
            list="todo-cats"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Nom de la catégorie (ex. PLOMBERIE)"
            className="w-full px-3 py-2.5 text-base border-2 border-slate-300 rounded-lg focus:border-green-600 focus:outline-none"
          />
          <datalist id="todo-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="flex gap-2">
            <select
              value={newTaskPrio}
              onChange={(e) => setNewTaskPrio(e.target.value)}
              className="px-2 py-2.5 text-sm border-2 border-slate-300 rounded-lg focus:border-green-600 focus:outline-none flex-shrink-0"
            >
              {prioOptions}
            </select>
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="Premier point"
              className="flex-1 min-w-0 px-3 py-2.5 text-base border-2 border-slate-300 rounded-lg focus:border-green-600 focus:outline-none"
            />
            <button
              onClick={addCategory}
              disabled={!newCat.trim() || !newTaskTitle.trim()}
              className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-bold px-4 rounded-lg active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-center text-slate-500 py-8">Chargement…</p>
        ) : groups.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Aucune catégorie. Ajoutez-en une ci-dessus.</p>
        ) : (
          groups.map((g) => (
            <section
              key={g.category}
              className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 overflow-hidden"
            >
              {/* En-tête catégorie (renommable) */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-800">
                <input
                  value={catEdit[g.category] ?? g.category}
                  onChange={(e) => setCatEdit((p) => ({ ...p, [g.category]: e.target.value }))}
                  onBlur={() => commitRename(g.category)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="flex-1 min-w-0 bg-transparent text-white text-base font-extrabold uppercase tracking-wide px-1 py-1 rounded focus:bg-blue-900 focus:outline-none"
                />
                <button
                  onClick={() => removeCategory(g.category)}
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-900/60 hover:bg-red-600 text-white text-sm"
                  title="Supprimer la catégorie"
                >
                  🗑
                </button>
              </div>

              {/* Sous-tâches imbriquées */}
              <ul className="divide-y divide-slate-100">
                {g.list.map((item, idx) => (
                  <li key={item.id} className="px-2 py-2 flex items-center gap-1.5">
                    <div className="flex flex-col flex-shrink-0">
                      <button
                        onClick={() => moveTask(g.list, idx, -1)}
                        disabled={idx === 0}
                        className="w-6 h-5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600 text-[10px]"
                        title="Monter"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveTask(g.list, idx, 1)}
                        disabled={idx === g.list.length - 1}
                        className="w-6 h-5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600 text-[10px]"
                        title="Descendre"
                      >
                        ▼
                      </button>
                    </div>
                    <select
                      value={item.priority || 'NORMALE'}
                      onChange={(e) => {
                        patchLocal(item.id, { priority: e.target.value });
                        saveField(item.id, { priority: e.target.value }, false);
                      }}
                      className="flex-shrink-0 px-1 py-2 text-xs border border-slate-200 rounded focus:border-blue-500 focus:outline-none"
                      title="Priorité"
                    >
                      {PRIORITY_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {PRIORITIES[k].icon}
                        </option>
                      ))}
                    </select>
                    <input
                      value={item.title}
                      onChange={(e) => {
                        patchLocal(item.id, { title: e.target.value });
                        saveField(item.id, { title: e.target.value });
                      }}
                      className="flex-1 min-w-0 px-2 py-2 text-sm border border-slate-200 rounded focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => removeTask(item)}
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                      title="Supprimer le point"
                    >
                      🗑
                    </button>
                  </li>
                ))}
              </ul>

              {/* Ajout d'une tâche dans cette catégorie */}
              <div className="flex gap-2 px-2 py-2 bg-slate-50 border-t border-slate-200">
                <select
                  value={addPrio[g.category] || 'NORMALE'}
                  onChange={(e) => setAddPrio((p) => ({ ...p, [g.category]: e.target.value }))}
                  className="px-1 py-2 text-xs border border-slate-300 rounded focus:border-blue-500 focus:outline-none flex-shrink-0"
                >
                  {PRIORITY_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {PRIORITIES[k].icon}
                    </option>
                  ))}
                </select>
                <input
                  value={addTitle[g.category] || ''}
                  onChange={(e) => setAddTitle((p) => ({ ...p, [g.category]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addTask(g.category)}
                  placeholder="Ajouter un point…"
                  className="flex-1 min-w-0 px-2 py-2 text-sm border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => addTask(g.category)}
                  disabled={!(addTitle[g.category] || '').trim()}
                  className="bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white font-bold px-3 rounded active:scale-95 flex-shrink-0"
                >
                  +
                </button>
              </div>
            </section>
          ))
        )}

        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-3 text-[11px] text-slate-700">
          Priorité par point : 🔴 Extrême, 🟠 Haute, 🟢 Normale. Les sections se classent
          automatiquement (celles qui contiennent un point extrême passent en tête). Les
          modifications s'appliquent tout de suite à la semaine en cours ; l'historique reste figé.
        </div>
      </main>
    </div>
  );
}
