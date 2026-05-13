import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { generateReport } from './pdf.js';

const TECH_NAME_KEY = 'suivi-chantier-tech-name';

// Tentative de partage natif d'un ou plusieurs fichiers PDF
async function shareOrDownload(files, title) {
  // navigator.canShare permet de vérifier que le partage de fichiers est supporté
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
  // Fallback : téléchargement
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

export default function SendModal({ open, onClose, state, defaultTechnicianName }) {
  const sigRef = useRef(null);
  const [tech, setTech] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem(TECH_NAME_KEY);
      setTech(stored || defaultTechnicianName || '');
      setStatus(null);
      setError(null);
      // Reset signature au prochain affichage
      setTimeout(() => sigRef.current?.clear?.(), 50);
    }
  }, [open, defaultTechnicianName]);

  // Redimensionne le canvas de signature à la taille de son conteneur
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

  const handleGenerate = async (which /* 'cuisine' | 'menuiserie' | 'both' */) => {
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

    setBusy(true);
    try {
      localStorage.setItem(TECH_NAME_KEY, name);
      const signatureDataUrl = sigRef.current
        .getTrimmedCanvas()
        .toDataURL('image/png');

      const sections =
        which === 'both' ? ['cuisine', 'menuiserie'] : [which];

      const files = [];
      for (const section of sections) {
        const { blob, fileName } = await generateReport({
          section,
          state,
          technicianName: name,
          signatureDataUrl
        });
        files.push(new File([blob], fileName, { type: 'application/pdf' }));
      }

      const result = await shareOrDownload(
        files,
        files.length > 1
          ? 'Rapports Cuisine & Menuiserie'
          : files[0].name.replace('.pdf', '')
      );
      if (result === 'cancelled') {
        setStatus('Envoi annulé.');
      } else if (result === 'shared') {
        setStatus('Rapport partagé avec succès.');
      } else {
        setStatus('PDF téléchargé.');
      }
    } catch (e) {
      console.error(e);
      setError("Erreur lors de la génération : " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Envoyer le rapport</h2>
            <p className="text-xs text-slate-500">PDF avec signature et date</p>
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

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
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
              <label className="block text-sm font-semibold text-slate-700">
                Signature
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
            <p className="text-xs text-slate-500 mt-1">
              Signez avec le doigt ou un stylet.
            </p>
          </div>

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

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <p className="text-sm font-semibold text-slate-700">
              Quel rapport envoyer ?
            </p>
            <button
              onClick={() => handleGenerate('cuisine')}
              disabled={busy}
              className="w-full bg-blue-800 hover:bg-blue-900 active:bg-blue-950 disabled:opacity-60 text-white font-bold py-3 rounded-lg shadow"
            >
              {busy ? '...' : '🍳 Rapport Cuisine'}
            </button>
            <button
              onClick={() => handleGenerate('menuiserie')}
              disabled={busy}
              className="w-full bg-blue-800 hover:bg-blue-900 active:bg-blue-950 disabled:opacity-60 text-white font-bold py-3 rounded-lg shadow"
            >
              {busy ? '...' : '🚪 Rapport Menuiserie'}
            </button>
            <button
              onClick={() => handleGenerate('both')}
              disabled={busy}
              className="w-full bg-green-700 hover:bg-green-800 active:bg-green-900 disabled:opacity-60 text-white font-bold py-3 rounded-lg shadow"
            >
              {busy ? 'Génération en cours...' : '📑 Les deux rapports'}
            </button>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            Sur smartphone, la fenêtre de partage s'ouvre automatiquement (WhatsApp,
            mail, Drive…). Sur PC, les fichiers sont téléchargés.
          </p>
        </div>
      </div>
    </div>
  );
}
