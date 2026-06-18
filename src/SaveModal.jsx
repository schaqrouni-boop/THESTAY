import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { createSnapshot } from './storage.js';

// Modal de sauvegarde signée (utilisateur 'tech').
// Le snapshot fige : état coché + signature + nom + date + photos draft promues.
// Après save, la session repart avec 0 photo (mais cocheking conservé).

export default function SaveModal({ open, onClose, state, technicianName, onSaved }) {
  const sigRef = useRef(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setName(technicianName || '');
      setError(null);
      setTimeout(() => sigRef.current?.clear?.(), 50);
    }
  }, [open, technicianName]);

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

  if (!open) return null;

  const submit = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Veuillez saisir votre nom.');
      return;
    }
    const empty = sigRef.current?.isEmpty?.() ?? true;
    if (empty) {
      setError('Veuillez signer dans le cadre prévu.');
      return;
    }
    setBusy(true);
    try {
      const signatureDataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png');
      const snap = await createSnapshot({
        technicianName: trimmed,
        signatureDataUrl,
        state
      });
      onSaved?.(snap);
    } catch (e) {
      console.error(e);
      setError('Erreur sauvegarde : ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Sauvegarder le contrôle</h2>
            <p className="text-xs text-slate-500">Signature obligatoire</p>
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
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 text-sm">
            <p className="font-bold text-blue-900 mb-1">Ce contrôle sera enregistré :</p>
            <ul className="list-disc list-inside text-slate-700 space-y-0.5 text-xs">
              <li>État coché conservé pour les contrôles suivants</li>
              <li>Photos figées dans ce contrôle (la prochaine session démarre à zéro)</li>
              <li>Signature, nom et date stockés de manière immuable</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Nom du technicien
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoCapitalize="words"
              className="w-full px-3 py-3 text-base border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
              placeholder="Prénom et nom"
              disabled={busy}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-slate-700">
                Signature obligatoire
              </label>
              <button
                type="button"
                onClick={() => sigRef.current?.clear?.()}
                className="text-xs font-semibold text-blue-700 underline"
                disabled={busy}
              >
                Effacer
              </button>
            </div>
            <div className="w-full h-44 border-2 border-dashed border-slate-400 rounded-lg bg-slate-50 overflow-hidden touch-none">
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

          {error && (
            <div className="bg-red-50 border-2 border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="w-full bg-green-700 hover:bg-green-800 active:bg-green-900 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-base py-3.5 rounded-lg shadow active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span aria-hidden>💾</span>
            {busy ? 'Sauvegarde en cours…' : 'Enregistrer le contrôle signé'}
          </button>

          <p className="text-[11px] text-slate-500 text-center">
            Une fois sauvegardé, cet enregistrement ne peut plus être modifié ou supprimé par le
            technicien.
          </p>
        </div>
      </div>
    </div>
  );
}
