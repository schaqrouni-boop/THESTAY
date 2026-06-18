import { useEffect, useMemo, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { generateReport } from './pdf.js';
import { countPhotosBySection } from './storage.js';
import { LOTS } from './data.js';

const TECH_NAME_KEY = 'suivi-chantier-tech-name';
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

export default function SendModal({ open, onClose, state, defaultTechnicianName }) {
  const sigRef = useRef(null);
  const [tech, setTech] = useState('');
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
    if (open) {
      const stored = localStorage.getItem(TECH_NAME_KEY);
      setTech(stored || defaultTechnicianName || '');
      setStatus(null);
      setError(null);
      setProgress({ current: 0, total: 0, lot: null });
      setTimeout(() => sigRef.current?.clear?.(), 50);
      (async () => {
        try {
          const counts = {};
          await Promise.all(
            LOTS.map(async (l) => {
              counts[l.id] = await countPhotosBySection(l.id);
            })
          );
          setPhotoCounts(counts);
        } catch (e) {
          console.warn('Compteur photos KO', e);
        }
      })();
    }
  }, [open, defaultTechnicianName]);

  useEffect(() => {
    if (!open) return;
    const resize = () => {
      const canvas = sigRef.current?.getCanvas?.();
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = parent.clientWidth * ratio;
      canvas.height = parent.clientHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      sigRef.current.clear();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [open]);

  const allSelected = selectedLots.length === LOTS.length;
  const noneSelected = selectedLots.length === 0;

  const toggleLot = (id) => {
    setSelectedLots((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedLots(allSelected ? [] : LOTS.map((l) => l.id));
  };

  const totalPhotosForSelected = useMemo(() => {
    return selectedLots.reduce((acc, id) => acc + (photoCounts[id] || 0), 0);
  }, [selectedLots, photoCounts]);

  if (!open) return null;

  const handleGenerate = async () => {
    setError(null);
    setStatus(null);

    const name = tech.trim();
    if (!name) {
      setError('Veuillez saisir votre nom.');
      return;
    }
    const empty = sigRef.current?.isEmpty?.() ?? true;
    if (empty) {
      setError('Veuillez signer dans le cadre prévu.');
      return;
    }
    if (selectedLots.length === 0) {
      setError('Sélectionnez au moins un lot à générer.');
      return;
    }

    setBusy(true);
    try {
      localStorage.setItem(TECH_NAME_KEY, name);
      localStorage.setItem(SELECTED_LOTS_KEY, JSON.stringify(selectedLots));
      const signatureDataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png');

      const orderedSelection = LOTS.filter((l) => selectedLots.includes(l.id));
      setProgress({ current: 0, total: orderedSelection.length, lot: null });

      const files = [];
      for (let i = 0; i < orderedSelection.length; i++) {
        const lot = orderedSelection[i];
        setProgress({ current: i, total: orderedSelection.length, lot: lot.label });
        const { blob, fileName } = await generateReport({
          lotId: lot.id,
          state,
          technicianName: name,
          signatureDataUrl,
          includePhotos
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Envoyer les rapports</h2>
            <p className="text-xs text-slate-500">PDF par lot avec signature et date</p>
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
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Nom du technicien
            </label>
            <input
              type="text"
              value={tech}
              onChange={(e) => setTech(e.target.value)}
              autoCapitalize="words"
              className="w-full px-3 py-3 text-base border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
              placeholder="Prénom et nom"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-slate-700">Signature</label>
              <button
                type="button"
                onClick={() => sigRef.current?.clear?.()}
                className="text-xs font-semibold text-blue-700 underline"
                disabled={busy}
              >
                Effacer
              </button>
            </div>
            <div className="w-full h-40 border-2 border-dashed border-slate-400 rounded-lg bg-slate-50 overflow-hidden touch-none">
              <SignatureCanvas
                ref={sigRef}
                penColor="#0f172a"
                canvasProps={{
                  className: 'w-full h-full',
                  style: { touchAction: 'none' }
                }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Signez avec le doigt ou un stylet.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">
                Lots à générer ({selectedLots.length}/{LOTS.length})
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
                      {photoN > 0 && (
                        <span className="text-xs text-slate-500 flex-shrink-0">📷 {photoN}</span>
                      )}
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
            Sur smartphone, la fenêtre de partage s'ouvre automatiquement (WhatsApp, mail, Drive…).
            Sur PC, les fichiers sont téléchargés.
          </p>
        </div>
      </div>
    </div>
  );
}
