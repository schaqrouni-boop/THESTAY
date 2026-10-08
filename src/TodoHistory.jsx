import { useEffect, useState } from 'react';
import {
  listTodoWeeks,
  getTodoEntries,
  listTodoArchives,
  getTodoArchive
} from './storage.js';
import { isoWeekKey, weekRangeLabel, parseTodoCategory, priorityInfo } from './todoWeek.js';
import PhotosSection from './PhotosSection.jsx';

// Historique des todo (lecture seule) :
//  - Archives : todos publiées manuellement (bouton Publier) — figées, sans photos.
//  - Semaines : todos par semaine calendaire (rollover auto) — avec photos.

function groupEntries(entries) {
  const map = new Map();
  for (const e of entries) {
    const { name } = parseTodoCategory(e.item_category);
    if (!map.has(name)) map.set(name, { category: name, items: [], _i: map.size });
    map.get(name).items.push(e);
  }
  for (const g of map.values()) {
    g.items.sort((a, b) => priorityInfo(a.item_priority).rank - priorityInfo(b.item_priority).rank);
    g.minRank = Math.min(...g.items.map((e) => priorityInfo(e.item_priority).rank));
  }
  return Array.from(map.values()).sort((a, b) => a.minRank - b.minRank || a._i - b._i);
}

function DetailHeader({ title, subtitle, onBack }) {
  return (
    <header className="sticky top-0 z-20 bg-blue-800 text-white shadow-lg">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold px-3 py-2 rounded-lg shadow active:scale-95"
        >
          ←
        </button>
        <div className="flex-1 min-w-0 text-center px-2">
          <h1 className="text-sm font-bold leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-blue-100 truncate">{subtitle}</p>}
        </div>
        <div className="w-[44px]" />
      </div>
    </header>
  );
}

function TaskRow({ e, children }) {
  const pinfo = priorityInfo(e.item_priority);
  return (
    <div
      className={`rounded-xl border-2 shadow-sm overflow-hidden ${
        e.done ? 'border-green-500 bg-green-50' : `${pinfo.cardBorder} ${pinfo.cardBg}`
      }`}
    >
      <div className="flex items-start gap-3 px-3 py-3">
        <span className={`flex-shrink-0 mt-0.5 text-lg font-bold ${e.done ? 'text-green-600' : 'text-slate-400'}`}>
          {e.done ? '✓' : '○'}
        </span>
        <span className="text-lg flex-shrink-0 mt-0.5" title={pinfo.label} aria-hidden>
          {pinfo.icon}
        </span>
        <span className={`text-base flex-1 ${e.done ? 'line-through text-slate-500' : 'text-slate-900 font-semibold'}`}>
          {e.item_title}
        </span>
      </div>
      <div className="px-3 pb-3 space-y-3 border-t border-slate-200 bg-white/60">
        {e.comment ? (
          <p className="pt-2 text-sm text-slate-700 whitespace-pre-wrap">{e.comment}</p>
        ) : (
          <p className="pt-2 text-sm text-slate-400 italic">Aucun commentaire</p>
        )}
        {children}
      </div>
    </div>
  );
}

export default function TodoHistory({ onClose }) {
  const currentWeek = isoWeekKey();
  const [archives, setArchives] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vue détail : soit une archive, soit une semaine
  const [openWeek, setOpenWeek] = useState(null);
  const [openArchive, setOpenArchive] = useState(null); // { label, archived_at, data }
  const [entries, setEntries] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [arch, wk] = await Promise.all([
          listTodoArchives().catch(() => []),
          listTodoWeeks().catch(() => [])
        ]);
        setArchives(arch);
        setWeeks(wk);
      } catch (e) {
        setError('Chargement historique KO : ' + (e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openWeekView = async (wk) => {
    setOpenWeek(wk);
    setLoadingDetail(true);
    try {
      setEntries(await getTodoEntries(wk));
    } catch (e) {
      setError('Lecture semaine KO : ' + (e?.message || e));
    } finally {
      setLoadingDetail(false);
    }
  };

  const openArchiveView = async (a) => {
    setLoadingDetail(true);
    try {
      const full = await getTodoArchive(a.id);
      setOpenArchive(full || { ...a, data: [] });
    } catch (e) {
      setError('Lecture archive KO : ' + (e?.message || e));
    } finally {
      setLoadingDetail(false);
    }
  };

  // --- Détail d'une archive (figée, sans photos) ---
  if (openArchive) {
    const data = openArchive.data || [];
    const groups = groupEntries(data);
    const done = data.filter((e) => e.done).length;
    return (
      <div className="min-h-full flex flex-col bg-slate-100">
        <DetailHeader
          title={openArchive.label || 'Todo archivée'}
          subtitle={`${done}/${data.length} fait · archivée`}
          onBack={() => setOpenArchive(null)}
        />
        <main className="flex-1 px-3 py-3 pb-24 space-y-4">
          {data.length === 0 ? (
            <p className="text-center text-slate-500 py-12">Archive vide.</p>
          ) : (
            groups.map((g) => (
              <section key={g.category}>
                <h2 className="mb-2 px-3 py-2.5 rounded-lg text-lg font-extrabold uppercase tracking-wide shadow-sm bg-blue-800 text-white">
                  {g.category}
                </h2>
                <div className="space-y-3">
                  {g.items.map((e, i) => (
                    <TaskRow key={i} e={e} />
                  ))}
                </div>
              </section>
            ))
          )}
        </main>
      </div>
    );
  }

  // --- Détail d'une semaine (avec photos) ---
  if (openWeek) {
    const groups = groupEntries(entries);
    const done = entries.filter((e) => e.done).length;
    return (
      <div className="min-h-full flex flex-col bg-slate-100">
        <DetailHeader
          title={weekRangeLabel(openWeek)}
          subtitle={`${done}/${entries.length} fait`}
          onBack={() => setOpenWeek(null)}
        />
        <main className="flex-1 px-3 py-3 pb-24 space-y-4">
          {loadingDetail ? (
            <p className="text-center text-slate-500 py-12">Chargement…</p>
          ) : entries.length === 0 ? (
            <p className="text-center text-slate-500 py-12">Aucune donnée pour cette semaine.</p>
          ) : (
            groups.map((g) => (
              <section key={g.category}>
                <h2 className="mb-2 px-3 py-2.5 rounded-lg text-lg font-extrabold uppercase tracking-wide shadow-sm bg-blue-800 text-white">
                  {g.category}
                </h2>
                <div className="space-y-3">
                  {g.items.map((e) => (
                    <TaskRow key={e.id} e={e}>
                      <PhotosSection
                        typoId="todo"
                        unitId={openWeek}
                        section={String(e.item_id)}
                        enabled={true}
                        readOnly={true}
                        labelOverride="Photos"
                      />
                    </TaskRow>
                  ))}
                </div>
              </section>
            ))
          )}
        </main>
      </div>
    );
  }

  // --- Liste : archives + semaines ---
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
            <p className="text-[11px] text-blue-100">
              {archives.length} archive(s) · {weeks.length} semaine(s)
            </p>
          </div>
          <div className="w-[88px]" />
        </div>
      </header>

      <main className="flex-1 px-3 py-4 pb-24 space-y-4">
        {loading ? (
          <p className="text-center text-slate-500 py-12">Chargement…</p>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm font-medium">
            {error}
          </div>
        ) : (
          <>
            {archives.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 px-1">
                  Todos publiées (archives)
                </h2>
                <ul className="space-y-2">
                  {archives.map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => openArchiveView(a)}
                        className="w-full bg-white rounded-xl shadow-sm border-2 border-amber-200 p-3 flex items-center gap-3 text-left active:scale-[0.99] tap-target"
                      >
                        <span className="text-2xl" aria-hidden>🗂️</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">
                            {a.label || 'Todo archivée'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(a.archived_at).toLocaleString('fr-FR')}
                          </p>
                        </div>
                        <span className="text-slate-400 text-lg flex-shrink-0">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 px-1">
                Par semaine
              </h2>
              {weeks.length === 0 ? (
                <p className="text-center text-slate-500 py-8 text-sm">Aucune semaine enregistrée.</p>
              ) : (
                <ul className="space-y-2">
                  {weeks.map((wk) => (
                    <li key={wk}>
                      <button
                        onClick={() => openWeekView(wk)}
                        className="w-full bg-white rounded-xl shadow-sm border-2 border-slate-200 p-3 flex items-center gap-3 text-left active:scale-[0.99] tap-target"
                      >
                        <span className="text-2xl" aria-hidden>📅</span>
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
            </section>
          </>
        )}
      </main>
    </div>
  );
}
