import { useEffect, useState } from 'react';
import { TYPOLOGIES } from './data.js';
import {
  listClosedApartments,
  setClosedApartment,
  subscribeClosedApartments
} from './storage.js';

// Registre isolé : logements finis et fermés. Cases à cocher par unité,
// groupées par typologie. Accessible via un lien en haut de la todo.

export default function ClosedApartmentsView({ user, onClose }) {
  const [closed, setClosed] = useState({}); // { [unitId]: row }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setClosed(await listClosedApartments());
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

  const toggle = async (unitId) => {
    const isClosed = !!closed[unitId];
    // MAJ optimiste
    setClosed((prev) => {
      const next = { ...prev };
      if (isClosed) delete next[unitId];
      else next[unitId] = { unit_id: unitId, closed: true };
      return next;
    });
    try {
      await setClosedApartment(unitId, !isClosed, user);
    } catch (e) {
      console.warn('MAJ registre KO', e);
      load();
    }
  };

  // Registre des logements (hors Couloirs & ESC qui ne sont pas des appartements).
  const typos = TYPOLOGIES.filter((t) => t.id !== 'couloirs');
  const allUnits = typos.flatMap((t) => t.units);
  const totalClosed = allUnits.filter((u) => closed[u]).length;

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
              {totalClosed}/{allUnits.length} fermé{totalClosed > 1 ? 's' : ''}
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
            const nClosed = t.units.filter((u) => closed[u]).length;
            return (
              <section key={t.id}>
                <h2 className="mb-2 px-3 py-2 rounded-lg text-sm font-extrabold uppercase tracking-wide bg-slate-800 text-white flex items-center justify-between">
                  <span>{t.label}</span>
                  <span className="text-xs font-semibold">
                    {nClosed}/{t.units.length}
                  </span>
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {t.units.map((u) => {
                    const isClosed = !!closed[u];
                    return (
                      <button
                        key={u}
                        onClick={() => toggle(u)}
                        className={`rounded-lg border-2 px-2 py-3 text-sm font-bold tap-target active:scale-95 flex items-center justify-center gap-1 ${
                          isClosed
                            ? 'bg-green-600 border-green-700 text-white'
                            : 'bg-white border-slate-300 text-slate-700'
                        }`}
                      >
                        {isClosed && <span aria-hidden>✓</span>}
                        {u}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
        <p className="text-[11px] text-slate-500 text-center px-2">
          Touchez un logement pour le marquer fini et fermé (vert). Registre partagé Nabil / Saad.
        </p>
      </main>
    </div>
  );
}
