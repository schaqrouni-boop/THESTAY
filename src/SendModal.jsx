import { useEffect, useMemo, useState } from 'react';
import { generateReport } from './pdf.js';
import { countPhotosBySection } from './storage.js';
import { LOTS, flatItemsForLot, TYPOLOGIES } from './data.js';

const SELECTED_LOTS_KEY = 'suivi-chantier-last-selected-lots';

async function shareOrDownload(files, title) {
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files });

  if (canShareFiles) {
    try {
      await navigator.share({ files, title, text: title });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      console.warn('Partage natif échoué, fallback téléchargement', e);
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return 'downloaded';
}

function loadSelectedLots() {
  try {
    const raw = localStorage.getItem(SELECTED_LOTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Compte uniquement les lots qui ont des items pour au moins une typologie ET
// pour lesquels au moins un item est coché — pour aider l'admin à choisir
// quels rapports valent la peine d'être générés.
function lotsCheckedCount(state) {
  const counts = {};
  for (const lot of LOTS) counts[lot.id] = 0;
  for (const t of TYPOLOGIES) {
    for (const lot of LOTS) {
      const items = flatItemsForLot(t.id, lot.id);
      if (!items.length) continue;
      for (const u of t.units) {
        const us = state?.[t.id]?.[u]?.[lot.id] || {};
        for (const it of items) {
          if (us[it.key]) counts[lot.id] += 1;
        }
      }
    }
  }
  return counts;
}

export default function SendModal({ open, onClose, snapshot }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [photoCounts, setPhotoCounts] = useState({});
  const [selectedLots, setSelectedLots] = useState(() => {
    const stored = loadSelectedLots();
    return stored || LOTS.map((l) => l.id);
  });
  const [progress, setProgress] = useState({ current: 0, total: 0, lot: null });

  useEffect(() => {
    if (!open || !snapshot) return;
    setStatus(null);
    setError(null);
    setProgress({ current: 0, total: 0, lot: null });
    (async () => {
      try {
        const counts = {};
        await Promise.all(
          LOTS.map(async (l) => {
            counts[l.id] = await countPhotosBySection(l.id, snapshot.id);
          })
        );
        setPhotoCounts(counts);
      } catch (e) {
        console.warn('Compteur photos KO', e);
      }
    })();
  }, [open, snapshot]);

  const checkedByLot = useMemo(() => (snapshot ? lotsCheckedCount(snapshot.state) : {}), [snapshot]);

  const allSelected = selectedLots.length === LOTS.length;
  const noneSelected = selectedLots.length === 0;

  const toggleLot = (id) => {
    setSelectedLots((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => setSelectedLots(allSelected ? [] : LOTS.map((l) => l.id));

  const totalPhotosForSelected = useMemo(() => {
    return selectedLots.reduce((acc, id) => acc + (photoCounts[id] || 0), 0);
  }, [selectedLots, photoCounts]);

  if (!open || !snapshot) return null;

  const handleGenerate = async () => {
    setError(null);
    setStatus(null);

    if (selectedLots.length === 0) {
      setError('Sélectionnez au moins un lot.');
      return;
    }

    setBusy(true);
    try {
      localStorage.setItem(SELECTED_LOTS_KEY, JSON.stringify(selectedLots));

      const orderedSelection = LOTS.filter((l) => selectedLots.includes(l.id));
      setProgress({ current: 0, total: orderedSelection.length, lot: null });

      const files = [];
      for (let i = 0; i < orderedSelection.length; i++) {
        const lot = orderedSelection[i];
        setProgress({ current: i, total: orderedSelection.length, lot: lot.label });
        const { blob, fileName } = await generateReport({
          lotId: lot.id,
          state: snapshot.state,
          technicianName: snapshot.technicianName,
          signatureDataUrl: snapshot.signatureDataUrl,
          includePhotos,
          sessionId: snapshot.id
        });
        files.push(new File([blob], fileName, { type: 'application/pdf' }));
      }
      setProgress({ current: orderedSelection.length, total: orderedSelection.length, lot: null });

      const title =
        files.length > 1
          ? `Rapports THE STAY (${files.length} lots)`
          : files[0].name.replace('.pdf', '');
      const result = await shareOrDownload(files, title);
      if (result === 'cancelled') setStatus('Envoi annulé.');
      else if (result === 'shared')
        setStatus(`${files.length} rapport${files.length > 1 ? 's' : ''} partagé${files.length > 1 ? 's' : ''}.`);
      else setStatus(`${files.length} PDF téléchargé${files.length > 1 ? 's' : ''}.`);
    } catch (e) {
      console.error(e);
      setError('Erreur lors de la génération : ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const generateLabel = busy
    ? progress.lot
      ? `${progress.current + 1}/${progress.total} · ${progress.lot}…`
      : 'Génération en cours…'
    : selectedLots.length === 0
    ? 'Sélectionnez au moins un lot'
    : `Générer ${selectedLots.length} rapport${selectedLots.length > 1 ? 's' : ''}`;

  const snapshotDateStr = new Date(snapshot.createdAt).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Exporter les rapports</h2>
            <p className="text-xs text-slate-500">À partir d'un contrôle enregistré</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xl font-bold disabled:opacity-50"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Bandeau snapshot info */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 text-sm">
            <p className="font-bold text-blue-900">Contrôle du {snapshotDateStr}</p>
            <p className="text-xs text-slate-700 mt-0.5">
              Technicien : <span className="font-bold">{snapshot.technicianName}</span>
            </p>
            {snapshot.signatureDataUrl && (
              <div className="mt-2 inline-block bg-white border border-slate-300 rounded p-1">
                <img
                  src={snapshot.signatureDataUrl}
                  alt="Signature"
                  className="h-12 w-auto"
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">
                Lots à exporter ({selectedLots.length}/{LOTS.length})
              </p>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-semibold text-blue-700 underline"
                disabled={busy}
              >
                {allSelected ? 'Tout décocher' : 'Tout cocher'}
              </button>
            </div>
            <ul className="space-y-1">
              {LOTS.map((lot) => {
                const checked = selectedLots.includes(lot.id);
                const photoN = photoCounts[lot.id] || 0;
                const lotChecked = checkedByLot[lot.id] || 0;
                return (
                  <li key={lot.id}>
                    <label className="flex items-center gap-3 px-3 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 cursor-pointer border border-slate-200">
                      <input
                        type="checkbox"
                        className="big-check flex-shrink-0"
                        checked={checked}
                        onChange={() => toggleLot(lot.id)}
                        disabled={busy}
                      />
                      <span className="text-xl flex-shrink-0" aria-hidden>
                        {lot.icon}
                      </span>
                      <span className="flex-1 text-sm font-bold text-slate-900">{lot.label}</span>
                      <span className="text-xs text-slate-500 flex-shrink-0 flex flex-col items-end">
                        <span>{lotChecked} cochés</span>
                        {photoN > 0 && <span>📷 {photoN}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <label className="flex items-start gap-3 px-3 py-3 rounded-lg bg-slate-50 border-2 border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              className="big-check flex-shrink-0 mt-0.5"
              checked={includePhotos}
              onChange={(e) => setIncludePhotos(e.target.checked)}
              disabled={busy}
            />
            <span className="flex-1 text-sm">
              <span className="font-bold text-slate-900 block">Inclure les photos</span>
              <span className="text-slate-600 text-xs">
                {totalPhotosForSelected > 0
                  ? `${totalPhotosForSelected} photo${totalPhotosForSelected > 1 ? 's' : ''} dans les lots sélectionnés.`
                  : 'Aucune photo dans les lots sélectionnés.'}
              </span>
            </span>
          </label>

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

          <button
            onClick={handleGenerate}
            disabled={busy || noneSelected}
            className="w-full bg-green-700 hover:bg-green-800 active:bg-green-900 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-base py-3.5 rounded-lg shadow active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span aria-hidden>📤</span>
            {generateLabel}
          </button>

          <p className="text-[11px] text-slate-500 text-center">
            Les PDF utilisent la signature et la date du contrôle sélectionné.
          </p>
        </div>
      </div>
    </div>
  );
}
