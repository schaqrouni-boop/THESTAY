import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { LOTS, TYPOLOGIES } from './data.js';
import { createLotReception } from './storage.js';

// Modal de réception d'un lot, co-signée :
//   - THE STAY (Nabil / le réceptionnaire)
//   - l'entreprise concernée (nom entreprise + nom du représentant)
// Valide TOUT le lot d'un coup. Enregistré de manière immuable dans lot_receptions.

export default function LotReceptionModal({ open, onClose, lotId, state, technicianName, onSaved }) {
  const techSigRef = useRef(null);
  const compSigRef = useRef(null);
  const [techName, setTechName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [repName, setRepName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const lot = LOTS.find((l) => l.id === lotId);

  useEffect(() => {
    if (open) {
      setTechName(technicianName || '');
      setCompanyName('');
      setRepName('');
      setError(null);
      setTimeout(() => {
        techSigRef.current?.clear?.();
        compSigRef.current?.clear?.();
      }, 50);
    }
  }, [open, technicianName]);

  useEffect(() => {
    if (!open) return;
    const resizeOne = (ref) => {
      const canvas = ref.current?.getCanvas?.();
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = parent.clientWidth * ratio;
      canvas.height = parent.clientHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      ref.current.clear();
    };
    const resize = () => {
      resizeOne(techSigRef);
      resizeOne(compSigRef);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    const t = techName.trim();
    const c = companyName.trim();
    const r = repName.trim();
    if (!t) return setError('Nom du réceptionnaire (THE STAY) requis.');
    if (!c) return setError("Nom de l'entreprise requis.");
    if (!r) return setError('Nom du représentant de l’entreprise requis.');
    if (techSigRef.current?.isEmpty?.() ?? true) return setError('Signature THE STAY requise.');
    if (compSigRef.current?.isEmpty?.() ?? true) return setError('Signature de l’entreprise requise.');

    setBusy(true);
    try {
      const technicianSignature = techSigRef.current.getTrimmedCanvas().toDataURL('image/png');
      const companySignature = compSigRef.current.getTrimmedCanvas().toDataURL('image/png');

      // Snapshot de l'état du lot au moment de la signature (par unité).
      // Forme réutilisable telle quelle comme `state` par la génération PDF.
      const snapshot = {};
      for (const typo of TYPOLOGIES) {
        for (const unit of typo.units) {
          const s = state?.[typo.id]?.[unit]?.[lotId];
          if (s && Object.keys(s).length) {
            if (!snapshot[typo.id]) snapshot[typo.id] = {};
            snapshot[typo.id][unit] = { [lotId]: s };
          }
        }
      }

      const reception = await createLotReception({
        lotId,
        technicianName: t,
        technicianSignature,
        companyName: c,
        companyRepName: r,
        companySignature,
        snapshot
      });
      onSaved?.(reception);
    } catch (e) {
      console.error(e);
      setError('Erreur : ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const SignatureBox = ({ title, sigRef }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-semibold text-slate-700">{title}</label>
        <button
          type="button"
          onClick={() => sigRef.current?.clear?.()}
          className="text-xs font-semibold text-blue-700 underline"
          disabled={busy}
        >
          Effacer
        </button>
      </div>
      <div className="w-full h-36 border-2 border-dashed border-slate-400 rounded-lg bg-slate-50 overflow-hidden touch-none">
        <SignatureCanvas
          ref={sigRef}
          penColor="#0f172a"
          canvasProps={{ className: 'w-full h-full', style: { touchAction: 'none' } }}
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">Réception du lot</h2>
            <p className="text-xs text-slate-500 truncate">
              {lot ? `${lot.icon} ${lot.label}` : lotId} · double signature
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xl font-bold disabled:opacity-50 flex-shrink-0"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 text-xs text-slate-700">
            Cette réception valide <b>tout le lot</b> et sera enregistrée de manière immuable, avec
            les deux signatures, le nom de l’entreprise et la date.
          </div>

          {/* Bloc THE STAY */}
          <div className="space-y-3 border border-slate-200 rounded-xl p-3">
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Réceptionné par — THE STAY</p>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nom</label>
              <input
                type="text"
                value={techName}
                onChange={(e) => setTechName(e.target.value)}
                autoCapitalize="words"
                className="w-full px-3 py-3 text-base border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                placeholder="Prénom et nom"
                disabled={busy}
              />
            </div>
            <SignatureBox title="Signature THE STAY" sigRef={techSigRef} />
          </div>

          {/* Bloc entreprise */}
          <div className="space-y-3 border border-slate-200 rounded-xl p-3">
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Entreprise concernée</p>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Entreprise</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoCapitalize="words"
                className="w-full px-3 py-3 text-base border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                placeholder="Nom de l’entreprise"
                disabled={busy}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Nom du représentant
              </label>
              <input
                type="text"
                value={repName}
                onChange={(e) => setRepName(e.target.value)}
                autoCapitalize="words"
                className="w-full px-3 py-3 text-base border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                placeholder="Prénom et nom"
                disabled={busy}
              />
            </div>
            <SignatureBox title="Signature entreprise" sigRef={compSigRef} />
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
            <span aria-hidden>✍️</span>
            {busy ? 'Enregistrement…' : 'Valider la réception (2 signatures)'}
          </button>

          <p className="text-[11px] text-slate-500 text-center">
            Une fois validée, cette réception ne peut plus être modifiée ni supprimée.
          </p>
        </div>
      </div>
    </div>
  );
}
