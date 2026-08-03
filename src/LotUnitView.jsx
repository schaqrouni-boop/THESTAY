import { LOTS, TYPOLOGIES, groupsForLot, flatItemsForLot } from './data.js';
import PhotosSection from './PhotosSection.jsx';

// Vue admin : pour un couple (lot, typologie, unité), affiche la checklist
// en lecture seule + la galerie photos (via PhotosSection en readOnly).

function statusColor(pct) {
  if (pct === 0) return { bar: 'bg-slate-400', text: 'text-slate-600', border: 'border-slate-300' };
  if (pct >= 100) return { bar: 'bg-green-600', text: 'text-green-700', border: 'border-green-500' };
  return { bar: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-400' };
}

export default function LotUnitView({
  lotId,
  typoId,
  unitId,
  state,
  role,
  photosKey,
  onToggleItem,
  onSave,
  onClose
}) {
  const editable = role !== 'admin';
  const lot = LOTS.find((l) => l.id === lotId);
  const typo = TYPOLOGIES.find((t) => t.id === typoId);

  if (!lot || !typo) {
    return (
      <div className="min-h-full flex items-center justify-center bg-slate-100 p-6 text-center">
        <div>
          <p className="text-slate-600 mb-3">Vue introuvable.</p>
          <button
            onClick={onClose}
            className="bg-blue-800 text-white font-bold px-4 py-2 rounded-lg"
          >
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  const groups = groupsForLot(typoId, lotId, unitId);
  const values = state?.[typoId]?.[unitId]?.[lotId] || {};
  const items = flatItemsForLot(typoId, lotId, unitId);
  const done = items.filter((it) => values[it.key]).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const c = statusColor(pct);

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
            <h1 className="text-base font-bold leading-tight truncate">
              {unitId} · {lot.icon} {lot.short}
            </h1>
            <p className="text-[11px] text-blue-100">
              {typo.label} · {done}/{total} · {pct}%
            </p>
          </div>
          {editable && onSave ? (
            <button
              onClick={onSave}
              className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-sm px-3 py-2 rounded-lg shadow active:scale-95 flex items-center gap-1 flex-shrink-0"
              title="Sauvegarder le contrôle signé"
            >
              <span aria-hidden>💾</span>
            </button>
          ) : (
            <div className="w-[44px]" />
          )}
        </div>
        <div className="px-4 pb-3">
          <div className="w-full bg-blue-950/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-green-400 h-2 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 py-3 pb-24 space-y-4">
        <div className={`rounded-xl border-2 ${c.border} bg-white p-3 shadow-sm`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {lot.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900">{lot.label}</p>
              <p className="text-xs text-slate-500">
                Unité <span className="font-bold">{unitId}</span> — {typo.label}
              </p>
              <p className={`text-xs font-semibold mt-1 ${c.text}`}>
                {done}/{total} points · {pct}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 p-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 px-1">
            État d'avancement
          </h3>
          <ul className="space-y-1">
            {groups.map((g, gi) => (
              <li key={gi}>
                {g.group && (
                  <h6 className="text-xs font-bold text-blue-800 uppercase tracking-wide mt-3 first:mt-1 mb-1 px-1">
                    {g.group}
                  </h6>
                )}
                <ul className="space-y-1">
                  {g.items.map((it) => {
                    const checked = !!values?.[it.key];
                    return (
                      <li key={it.key}>
                        <label
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 ${
                            editable
                              ? 'hover:bg-slate-100 active:bg-slate-200 cursor-pointer tap-target'
                              : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="big-check flex-shrink-0"
                            checked={checked}
                            onChange={() =>
                              editable && onToggleItem?.(typoId, unitId, lotId, it.key)
                            }
                            disabled={!editable}
                            readOnly={!editable}
                          />
                          <span
                            className={`text-sm flex-1 ${
                              checked ? 'line-through text-slate-500' : 'text-slate-900 font-medium'
                            }`}
                          >
                            {it.label}
                          </span>
                          {checked && (
                            <span className="text-green-600 text-lg font-bold flex-shrink-0">✓</span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 p-3">
          <PhotosSection
            key={editable ? photosKey : 'ro'}
            typoId={typoId}
            unitId={unitId}
            section={lotId}
            enabled={true}
            readOnly={!editable}
            sessionId={editable ? 'draft' : 'all'}
            labelOverride={
              editable
                ? `Photos ${lot.short.toLowerCase()}`
                : `Historique photos ${lot.short.toLowerCase()}`
            }
          />
        </div>
      </main>
    </div>
  );
}
