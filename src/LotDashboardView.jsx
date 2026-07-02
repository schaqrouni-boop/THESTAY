import { useMemo } from 'react';
import { LOTS, TYPOLOGIES, flatItemsForLot } from './data.js';

// Vue admin : suivi de l'avancement par corps de métier.
// Pour chaque lot, agrège les cases cochées de toutes les typologies + unités
// et donne aussi le nombre d'unités concernées (terminées / en cours / à faire).

function statusColor(pct) {
  if (pct === 0) return { bar: 'bg-slate-400', text: 'text-slate-600', border: 'border-slate-300' };
  if (pct >= 100) return { bar: 'bg-green-600', text: 'text-green-700', border: 'border-green-500' };
  return { bar: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-400' };
}

function computeLotStats(state, lot) {
  let done = 0;
  let total = 0;
  let unitsDone = 0;
  let unitsInProgress = 0;
  let unitsTodo = 0;
  const typoBreakdown = [];

  for (const t of TYPOLOGIES) {
    const items = flatItemsForLot(t.id, lot.id);
    if (!items.length) continue;

    let typoDone = 0;
    let typoTotal = 0;
    let tUnitsDone = 0;
    let tUnitsInProgress = 0;
    let tUnitsTodo = 0;

    for (const u of t.units) {
      const us = state?.[t.id]?.[u]?.[lot.id] || {};
      const itemsDone = items.filter((it) => us[it.key]).length;
      done += itemsDone;
      total += items.length;
      typoDone += itemsDone;
      typoTotal += items.length;
      if (itemsDone === 0) {
        unitsTodo += 1;
        tUnitsTodo += 1;
      } else if (itemsDone >= items.length) {
        unitsDone += 1;
        tUnitsDone += 1;
      } else {
        unitsInProgress += 1;
        tUnitsInProgress += 1;
      }
    }

    typoBreakdown.push({
      typoId: t.id,
      typoLabel: t.label,
      done: typoDone,
      total: typoTotal,
      unitsDone: tUnitsDone,
      unitsInProgress: tUnitsInProgress,
      unitsTodo: tUnitsTodo,
      totalUnits: t.units.length
    });
  }

  return { done, total, unitsDone, unitsInProgress, unitsTodo, typoBreakdown };
}

function LotCard({ lot, stats }) {
  const pct = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);
  const c = statusColor(pct);
  const totalUnits = stats.unitsDone + stats.unitsInProgress + stats.unitsTodo;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border-2 ${c.border} p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-4xl flex-shrink-0" aria-hidden>
          {lot.icon}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-slate-900 leading-tight">{lot.label}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sur {totalUnits} unité{totalUnits > 1 ? 's' : ''} concernée{totalUnits > 1 ? 's' : ''}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`${c.bar} h-3 transition-all duration-300`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-sm font-bold whitespace-nowrap ${c.text}`}>{pct}%</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {stats.done}/{stats.total} points de contrôle
          </p>

          <div className="mt-3 flex gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full px-2 py-1">
              <span className="w-2 h-2 rounded-full bg-green-600" />
              {stats.unitsDone} terminée{stats.unitsDone > 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-orange-100 text-orange-800 rounded-full px-2 py-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              {stats.unitsInProgress} en cours
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-700 rounded-full px-2 py-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              {stats.unitsTodo} à faire
            </span>
          </div>

          {stats.typoBreakdown.length > 1 && (
            <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
              {stats.typoBreakdown.map((tb) => {
                const tpct = tb.total === 0 ? 0 : Math.round((tb.done / tb.total) * 100);
                const tc = statusColor(tpct);
                return (
                  <div key={tb.typoId} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-600 font-semibold w-24 truncate">
                      {tb.typoLabel}
                    </span>
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`${tc.bar} h-1.5`} style={{ width: `${tpct}%` }} />
                    </div>
                    <span className={`font-semibold whitespace-nowrap ${tc.text} min-w-[40px] text-right`}>
                      {tpct}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LotDashboardView({ state, onClose }) {
  const data = useMemo(() => {
    return LOTS.map((lot) => ({ lot, stats: computeLotStats(state, lot) }));
  }, [state]);

  const globalDone = data.reduce((s, x) => s + x.stats.done, 0);
  const globalTotal = data.reduce((s, x) => s + x.stats.total, 0);
  const globalPct = globalTotal === 0 ? 0 : Math.round((globalDone / globalTotal) * 100);

  const nonEmpty = data.filter((d) => d.stats.total > 0);

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
            <h1 className="text-base font-bold leading-tight truncate">Suivi par corps de métier</h1>
            <p className="text-[11px] text-blue-100">
              {globalDone}/{globalTotal} points · {globalPct}%
            </p>
          </div>
          <div className="w-[88px]" />
        </div>

        <div className="px-4 pb-3">
          <div className="w-full bg-blue-950/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-green-400 h-2 transition-all duration-300"
              style={{ width: `${globalPct}%` }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 py-3 pb-24 space-y-3">
        {nonEmpty.map(({ lot, stats }) => (
          <LotCard key={lot.id} lot={lot} stats={stats} />
        ))}
      </main>
    </div>
  );
}
