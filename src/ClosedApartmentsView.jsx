import { useEffect, useState } from 'react';
import { TYPOLOGIES } from './data.js';
import {
  getApartmentClosure,
  setApartmentClosure,
  subscribeClosedApartments
} from './storage.js';

// Registre isolé : avancement de finition/fermeture par logement.
// Chaque unité (hors couloirs) a une check-list de 10 points remplie par Nabil.
// Une unité est "finie et fermée" quand les 10 points sont cochés.

const CLOSURE_ITEMS = [
  'ELECTRICITE TESTEE',
  'CLIMATISATION ET GRILLES',
  'POSE SANITAIRES ET MEUBLES',
  'PLOMBERIE CUISINE',
  'CUISINE ET TRIO',
  'CHAUFFE EAU',
  'MIRROIRS SDB',
  'NETTOYAGE SDB ET MASTIQUE',
  'NETTOYAGE CUISINE',
  'NETTOYAGE DRESSING'
];

function doneCount(items) {
  if (!items) return 0;
  return CLOSURE_ITEMS.filter((k) => items[k]).length;
}

export default function ClosedApartmentsView({ user, onClose }) {
  const [closure, setClosure] = useState({}); // { [unitId]: { [itemKey]: bool } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openUnit, setOpenUnit] = useState(null);

  const load = async () => {
    try {
      setClosure(await getApartmentClosure());
    } catch (e) {
      setError('Chargement KO : ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = subscribeClosedApartments(() => load());
    return unsub;
  }, []);

  const toggleItem = async (unitId, itemKey) => {
    const cur = closure[unitId] || {};
    const next = { ...cur, [itemKey]: !cur[itemKey] };
    setClosure((prev) => ({ ...prev, [unitId]: next }));
    try {
      await setApartmentClosure(unitId, next, user);
    } catch (e) {
      console.warn('MAJ registre KO', e);
      load();
    }
  };

  const typos = TYPOLOGIES.filter((t) => t.id !== 'couloirs');
  const allUnits = typos.flatMap((t) => t.units);
  const totalFull = allUnits.filter((u) => doneCount(closure[u]) === CLOSURE_ITEMS.length).length;

  return (
    <div className="min-h-full flex flex-col bg-slate-100">
      <header className="sticky top-0 z-20 bg-blue-800 text-white shadow-lg">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold px-3 py-2 rounded-lg shadow active:scale-95"
          >
            ←
          </button>
          <div className="flex-1 min-w-0 text-center px-2">
            <h1 className="text-base font-bold leading-tight truncate">Appartements finis et fermés</h1>
            <p className="text-[11px] text-blue-100">
              {totalFull}/{allUnits.length} logement{totalFull > 1 ? 's' : ''} 100% fini
              {totalFull > 1 ? 's' : ''}
            </p>
          </div>
          <div className="w-[44px]" />
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
          typos.map((t) => {
            const nFull = t.units.filter((u) => doneCount(closure[u]) === CLOSURE_ITEMS.length).length;
            return (
              <section key={t.id}>
                <h2 className="mb-2 px-3 py-2 rounded-lg text-sm font-extrabold uppercase tracking-wide bg-slate-800 text-white flex items-center justify-between">
                  <span>{t.label}</span>
                  <span className="text-xs font-semibold">
                    {nFull}/{t.units.length} finis
                  </span>
                </h2>
                <div className="space-y-2">
                  {t.units.map((u) => {
                    const items = closure[u] || {};
                    const done = doneCount(items);
                    const full = done === CLOSURE_ITEMS.length;
                    const isOpen = openUnit === u;
                    const pct = Math.round((done / CLOSURE_ITEMS.length) * 100);
                    return (
                      <div
                        key={u}
                        className={`rounded-xl border-2 shadow-sm overflow-hidden ${
                          full ? 'border-green-500 bg-green-50' : done > 0 ? 'border-orange-400 bg-orange-50' : 'border-slate-300 bg-white'
                        }`}
                      >
                        <button
                          onClick={() => setOpenUnit(isOpen ? null : u)}
                          className="w-full px-3 py-3 flex items-center gap-3 text-left tap-target"
                        >
                          <span
                            className={`w-3 h-3 rounded-full flex-shrink-0 ${
                              full ? 'bg-green-600' : done > 0 ? 'bg-orange-500' : 'bg-slate-400'
                            }`}
                          />
                          <span className="font-bold text-base text-slate-900 w-16 flex-shrink-0">{u}</span>
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-2 ${full ? 'bg-green-600' : 'bg-orange-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 w-14 text-right flex-shrink-0">
                            {done}/{CLOSURE_ITEMS.length}
                          </span>
                          <span className={`text-lg text-slate-500 transform ${isOpen ? 'rotate-180' : ''} flex-shrink-0`}>
                            ▾
                          </span>
                        </button>
                        {isOpen && (
                          <ul className="px-3 pb-3 pt-1 border-t border-slate-200 bg-white space-y-1">
                            {CLOSURE_ITEMS.map((k) => {
                              const checked = !!items[k];
                              return (
                                <li key={k}>
                                  <label className="flex items-center gap-3 px-2 py-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer active:bg-slate-100 tap-target">
                                    <input
                                      type="checkbox"
                                      className="big-check flex-shrink-0"
                                      checked={checked}
                                      onChange={() => toggleItem(u, k)}
                                    />
                                    <span
                                      className={`text-sm flex-1 ${
                                        checked ? 'line-through text-slate-500' : 'text-slate-900 font-medium'
                                      }`}
                                    >
                                      {k}
                                    </span>
                                    {checked && <span className="text-green-600 font-bold flex-shrink-0">✓</span>}
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
        <p className="text-[11px] text-slate-500 text-center px-2">
          Touchez un logement pour remplir son avancement. Vert = 100% fini et fermé. Registre partagé
          Nabil / Saad.
        </p>
      </main>
    </div>
  );
}
