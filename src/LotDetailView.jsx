import { useEffect, useMemo, useState } from 'react';
import { LOTS, TYPOLOGIES, flatItemsForLot } from './data.js';
import { getPhotosBySection } from './storage.js';
import { generateReport } from './pdf.js';

// Vue détail admin : pour un lot donné, montre l'état d'avancement par unité
// et permet de télécharger un PDF complet (état courant + photos draft).

function statusColor(pct) {
  if (pct === 0) return { bar: 'bg-slate-400', text: 'text-slate-600', border: 'border-slate-300', chip: 'bg-slate-100 text-slate-700' };
  if (pct >= 100) return { bar: 'bg-green-600', text: 'text-green-700', border: 'border-green-500', chip: 'bg-green-100 text-green-800' };
  return { bar: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-400', chip: 'bg-orange-100 text-orange-800' };
}

async function shareOrDownload(file, title) {
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });
  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title, text: title });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      console.warn('Partage natif KO, fallback téléchargement', e);
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return 'downloaded';
}

export default function LotDetailView({ lotId, state, adminName, onClose }) {
  const lot = LOTS.find((l) => l.id === lotId);
  const [photoCounts, setPhotoCounts] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!lotId) return;
    (async () => {
      try {
        const photos = await getPhotosBySection(lotId, 'draft');
        const counts = {};
        for (const p of photos) {
          const key = `${p.typoId}|${p.unitId}`;
          counts[key] = (counts[key] || 0) + 1;
        }
        setPhotoCounts(counts);
      } catch (e) {
        console.warn('Compteur photos KO', e);
      }
    })();
  }, [lotId]);

  const byTypology = useMemo(() => {
    if (!lot) return [];
    const rows = [];
    for (const t of TYPOLOGIES) {
      const items = flatItemsForLot(t.id, lot.id);
      if (!items.length) continue;
      const units = t.units.map((u) => {
        const us = state?.[t.id]?.[u]?.[lot.id] || {};
        const done = items.filter((it) => us[it.key]).length;
        return {
          unitId: u,
          done,
          total: items.length,
          photoCount: photoCounts[`${t.id}|${u}`] || 0
        };
      });
      const done = units.reduce((s, x) => s + x.done, 0);
      const total = units.reduce((s, x) => s + x.total, 0);
      const totalPhotos = units.reduce((s, x) => s + x.photoCount, 0);
      rows.push({ typo: t, units, done, total, totalPhotos });
    }
    return rows;
  }, [lot, state, photoCounts]);

  const globalDone = byTypology.reduce((s, x) => s + x.done, 0);
  const globalTotal = byTypology.reduce((s, x) => s + x.total, 0);
  const globalPct = globalTotal === 0 ? 0 : Math.round((globalDone / globalTotal) * 100);
  const totalPhotos = byTypology.reduce((s, x) => s + x.totalPhotos, 0);

  const handleDownload = async () => {
    if (!lot) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const { blob, fileName } = await generateReport({
        lotId: lot.id,
        state,
        technicianName: `Consultation ${adminName || 'admin'}`,
        signatureDataUrl: null,
        includePhotos: true,
        sessionId: 'draft'
      });
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const title = fileName.replace('.pdf', '');
      const result = await shareOrDownload(file, title);
      if (result === 'cancelled') setStatus('Envoi annulé.');
      else if (result === 'shared') setStatus('Rapport partagé.');
      else setStatus('PDF téléchargé.');
    } catch (e) {
      console.error(e);
      setError('Erreur génération : ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (!lot) {
    return (
      <div className="min-h-full flex items-center justify-center bg-slate-100 p-6 text-center">
        <div>
          <p className="text-slate-600 mb-3">Lot introuvable.</p>
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
              {lot.icon} {lot.label}
            </h1>
            <p className="text-[11px] text-blue-100">
              {globalDone}/{globalTotal} points · {globalPct}% · {totalPhotos} photo
              {totalPhotos > 1 ? 's' : ''}
            </p>
          </div>
          <div className="w-[44px]" />
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

      <main className="flex-1 px-3 py-3 pb-24 space-y-4">
        <button
          onClick={handleDownload}
          disabled={busy}
          className="w-full bg-green-700 hover:bg-green-800 active:bg-green-900 disabled:opacity-60 text-white font-bold text-base py-4 rounded-xl shadow-lg active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <span aria-hidden>📤</span>
          {busy ? 'Génération du PDF…' : 'Télécharger le rapport PDF'}
        </button>

        {error && (
          <div className="bg-red-50 border-2 border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}
        {status && !error && (
          <div className="bg-green-50 border-2 border-green-300 text-green-800 px-3 py-2 rounded-lg text-sm font-medium">
            {status}
          </div>
        )}

        <p className="text-[11px] text-slate-500 text-center px-2">
          Le PDF contient l'état d'avancement actuel du lot par unité + toutes les photos prises
          (état non signé, version brouillon).
        </p>

        {byTypology.map(({ typo, units, done, total, totalPhotos }) => {
          const pct = total === 0 ? 0 : Math.round((done / total) * 100);
          const c = statusColor(pct);
          return (
            <div key={typo.id} className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{typo.label}</h3>
                  <p className="text-[11px] text-slate-500">
                    {done}/{total} · {pct}% · {totalPhotos} photo{totalPhotos > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`${c.bar} h-2`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {units.map((u) => {
                  const uPct = u.total === 0 ? 0 : Math.round((u.done / u.total) * 100);
                  const uc = statusColor(uPct);
                  return (
                    <li key={u.unitId} className="px-3 py-2 flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${uc.bar}`} />
                      <span className="font-bold text-sm text-slate-900 w-16 flex-shrink-0">
                        {u.unitId}
                      </span>
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`${uc.bar} h-1.5`} style={{ width: `${uPct}%` }} />
                      </div>
                      <span className={`text-xs font-semibold whitespace-nowrap ${uc.text} w-20 text-right`}>
                        {u.done}/{u.total} · {uPct}%
                      </span>
                      {u.photoCount > 0 && (
                        <span className="text-xs text-slate-500 flex items-center gap-0.5 flex-shrink-0">
                          📷 {u.photoCount}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </main>
    </div>
  );
}
