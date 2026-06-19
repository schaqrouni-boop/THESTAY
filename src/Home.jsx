import { useEffect, useMemo, useState } from 'react';
import { TYPOLOGIES, LOTS, flatItemsForLot } from './data.js';
import { listSnapshots } from './storage.js';

function typoProgress(state, typo) {
  let done = 0;
  let total = 0;
  for (const lot of LOTS) {
    const items = flatItemsForLot(typo.id, lot.id);
    if (!items.length) continue;
    for (const u of typo.units) {
      const us = state?.[typo.id]?.[u]?.[lot.id] || {};
      for (const it of items) {
        total += 1;
        if (us[it.key]) done += 1;
      }
    }
  }
  return { done, total };
}

function statusColor(pct) {
  if (pct === 0) return { bar: 'bg-slate-400', text: 'text-slate-600', border: 'border-slate-300' };
  if (pct >= 100) return { bar: 'bg-green-600', text: 'text-green-700', border: 'border-green-500' };
  return { bar: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-400' };
}

const ICONS = {
  studio: '🛏️',
  appt2c: '🏠',
  appt3c: '🏡',
  couloirs: '🛗'
};

export default function Home({ user, role, state, onSelectTypology, onOpenHistory, onLogout, refreshKey }) {
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [lastSnapshot, setLastSnapshot] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await listSnapshots();
        setSnapshotCount(list.length);
        setLastSnapshot(list[0] || null);
      } catch (e) {
        console.warn('Lecture snapshots KO', e);
      }
    })();
  }, [refreshKey]);

  const overall = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const t of TYPOLOGIES) {
      const p = typoProgress(state, t);
      done += p.done;
      total += p.total;
    }
    return { done, total };
  }, [state]);

  const overallPct = overall.total === 0 ? 0 : Math.round((overall.done / overall.total) * 100);

  return (
    <div className="min-h-full flex flex-col bg-slate-100">
      <header className="bg-blue-800 text-white shadow-lg">
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-white rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0">
                <img src="logo.svg" alt="THE STAY" className="h-7 w-auto block" draggable="false" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold leading-tight truncate">Suivi Chantier</h1>
                <p className="text-[11px] text-blue-100">
                  {role === 'admin' ? 'Administration' : 'Réception travaux'} · {user}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold px-3 py-2 rounded-lg shadow active:scale-95"
              title="Déconnexion"
            >
              ⏻
            </button>
          </div>

          <div className="mt-3 bg-blue-900/40 rounded-lg p-2">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Avancement global</span>
              <span>
                {overall.done}/{overall.total} · {overallPct}%
              </span>
            </div>
            <div className="mt-1 w-full bg-blue-950/60 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-400 h-2 transition-all duration-300"
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 pb-24">
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3 px-1">
          Choisir une typologie
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TYPOLOGIES.map((t) => {
            const { done, total } = typoProgress(state, t);
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);
            const c = statusColor(pct);
            return (
              <button
                key={t.id}
                onClick={() => onSelectTypology(t.id)}
                className={`bg-white rounded-2xl shadow-md border-2 ${c.border} active:scale-[0.98] transition-transform p-4 text-left tap-target`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-4xl" aria-hidden>
                    {ICONS[t.id] || '🏢'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-slate-900 leading-tight">{t.label}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{t.units.length} unités</p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`${c.bar} h-2 transition-all duration-300`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold whitespace-nowrap ${c.text}`}>
                        {pct}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {done}/{total} points
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {role === 'admin' && (
          <div className="mt-6">
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3 px-1">
              Administration
            </h2>
            <button
              onClick={onOpenHistory}
              className="w-full bg-white rounded-2xl shadow-md border-2 border-blue-300 active:scale-[0.99] transition-transform p-4 text-left tap-target"
            >
              <div className="flex items-center gap-3">
                <span className="text-4xl" aria-hidden>📂</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-slate-900 leading-tight">
                    Historique des contrôles
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {snapshotCount === 0
                      ? 'Aucun contrôle enregistré'
                      : `${snapshotCount} contrôle${snapshotCount > 1 ? 's' : ''} enregistré${
                          snapshotCount > 1 ? 's' : ''
                        }`}
                    {lastSnapshot &&
                      ` · dernier : ${new Date(lastSnapshot.createdAt).toLocaleDateString('fr-FR')}`}
                  </p>
                  <p className="text-xs text-blue-700 font-semibold mt-2">
                    Consulter & exporter les rapports →
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-2 text-center text-xs text-slate-500">
        Données enregistrées localement · {user} ({role === 'admin' ? 'admin' : 'technicien'})
      </footer>
    </div>
  );
}
