import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listTodoItems,
  createTodoItem,
  updateTodoItem,
  deleteTodoItem
} from './storage.js';

// Gestion de la todo (admin) : ajouter / éditer / supprimer / réordonner les
// points, groupés par catégorie. Les changements s'appliquent immédiatement à
// la semaine en cours (le technicien voit la liste à jour).

export default function TodoAdmin({ onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newCat, setNewCat] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const commentTimers = useRef({});

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

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))),
    [items]
  );

  const add = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true);
    setError(null);
    try {
      const maxPos = items.reduce((m, i) => Math.max(m, i.position || 0), 0);
      await createTodoItem({ category: newCat.trim(), title, position: maxPos + 1 });
      setNewTitle('');
      await load();
    } catch (e) {
      setError('Ajout KO : ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  // Édition locale + sauvegarde différée du champ texte.
  const patchLocal = (id, patch) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const saveField = (id, patch, debounce = true) => {
    if (commentTimers.current[id]) clearTimeout(commentTimers.current[id]);
    const run = async () => {
      delete commentTimers.current[id];
      try {
        await updateTodoItem(id, patch);
      } catch (e) {
        console.warn('MAJ point KO', e);
      }
    };
    if (debounce) commentTimers.current[id] = setTimeout(run, 700);
    else run();
  };

  const remove = async (item) => {
    if (!window.confirm(`Supprimer le point « ${item.title} » ?\n(Les semaines passées gardent leur trace.)`)) return;
    try {
      await deleteTodoItem(item.id);
      await load();
    } catch (e) {
      setError('Suppression KO : ' + (e?.message || e));
    }
  };

  // Réordonnancement : échange la position avec le voisin dans la liste ordonnée.
  const move = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    const pa = a.position ?? index;
    const pb = b.position ?? target;
    // Échange optimiste
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...a, position: pb };
      copy[target] = { ...b, position: pa };
      copy.sort((x, y) => (x.position || 0) - (y.position || 0) || x.id - y.id);
      return copy;
    });
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
            <p className="text-[11px] text-blue-100">{items.length} point(s) actif(s)</p>
          </div>
          <div className="w-[88px]" />
        </div>
      </header>

      <main className="flex-1 px-3 py-4 pb-24 space-y-4">
        {/* Ajout d'un point */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-blue-200 p-3 space-y-2">
          <h2 className="text-sm font-bold text-slate-700">Ajouter un point</h2>
          <input
            list="todo-cats"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Catégorie (ex. Peinture, Élec…)"
            className="w-full px-3 py-2.5 text-base border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
          />
          <datalist id="todo-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Intitulé du point"
              className="flex-1 px-3 py-2.5 text-base border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
            />
            <button
              onClick={add}
              disabled={busy || !newTitle.trim()}
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
        ) : items.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Aucun point. Ajoutez-en un ci-dessus.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li
                key={item.id}
                className="bg-white rounded-xl shadow-sm border-2 border-slate-200 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="w-7 h-6 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 text-xs font-bold"
                      title="Monter"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === items.length - 1}
                      className="w-7 h-6 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 text-xs font-bold"
                      title="Descendre"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <input
                      list="todo-cats"
                      value={item.category || ''}
                      onChange={(e) => {
                        patchLocal(item.id, { category: e.target.value });
                        saveField(item.id, { category: e.target.value });
                      }}
                      placeholder="Catégorie"
                      className="w-full px-2 py-1.5 text-xs font-semibold text-blue-800 border border-slate-200 rounded focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      value={item.title}
                      onChange={(e) => {
                        patchLocal(item.id, { title: e.target.value });
                        saveField(item.id, { title: e.target.value });
                      }}
                      className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => remove(item)}
                    className="flex-shrink-0 w-9 h-9 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-lg font-bold"
                    title="Supprimer"
                  >
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-slate-500 text-center px-2">
          Les modifications s'appliquent immédiatement à la semaine en cours. Les semaines passées
          restent figées dans l'historique.
        </p>
      </main>
    </div>
  );
}
