import { useEffect, useRef, useState, useCallback } from 'react';
import { addPhoto, deletePhoto, getPhotosForUnit } from './storage.js';
import { compressImage, formatBytes } from './photoUtils.js';

// Génère et révoque proprement les object URLs pour l'affichage des miniatures
function usePhotosForUnit(typoId, unitId, section, enabled, sessionId) {
  const [items, setItems] = useState([]); // [{id, url, blob, createdAt}]
  const urlsRef = useRef([]);

  const revokeAll = () => {
    for (const u of urlsRef.current) {
      try {
        URL.revokeObjectURL(u);
      } catch {}
    }
    urlsRef.current = [];
  };

  const refresh = useCallback(async () => {
    if (!enabled) return;
    revokeAll();
    const list = await getPhotosForUnit(typoId, unitId, section, sessionId);
    const enriched = list.map((p) => {
      const url = URL.createObjectURL(p.blob);
      urlsRef.current.push(url);
      return { id: p.id, blob: p.blob, url, createdAt: p.createdAt };
    });
    setItems(enriched);
  }, [typoId, unitId, section, enabled, sessionId]);

  useEffect(() => {
    if (enabled) refresh();
    return revokeAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typoId, unitId, section, enabled, sessionId]);

  return { items, refresh };
}

export default function PhotosSection({
  typoId,
  unitId,
  section,
  enabled,
  onChange,
  labelOverride,
  sessionId = 'draft',
  readOnly = false
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null); // {id, url}
  const { items, refresh } = usePhotosForUnit(typoId, unitId, section, enabled, sessionId);

  const onFiles = async (fileList) => {
    if (readOnly) return;
    if (!fileList || !fileList.length) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of fileList) {
        if (!file.type.startsWith('image/')) continue;
        const compressed = await compressImage(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.82
        });
        if (!compressed) continue;
        await addPhoto({ typoId, unitId, section, blob: compressed, sessionId });
      }
      await refresh();
      onChange?.();
    } catch (e) {
      console.error(e);
      setError('Impossible d\'ajouter la photo : ' + (e?.message || e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (id) => {
    if (readOnly) return;
    if (!window.confirm('Supprimer cette photo ?')) return;
    await deletePhoto(id);
    setLightbox(null);
    await refresh();
    onChange?.();
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
          {labelOverride || `Photos ${section}`}{' '}
          <span className="text-slate-400">({items.length})</span>
        </h5>
        {!readOnly && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-60 text-white text-sm font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1"
          >
            <span aria-hidden>📷</span>
            {busy ? '...' : 'Photo'}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-2 py-1 rounded text-xs mb-2">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic px-1">
          Aucune photo. Tapez sur "Photo" pour en ajouter.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightbox(p)}
              className="relative aspect-square rounded-lg overflow-hidden bg-slate-200 border-2 border-slate-300 active:border-blue-600"
            >
              <img
                src={p.url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.url}
            alt=""
            className="max-w-full max-h-[80vh] rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-4 flex gap-2 flex-wrap justify-center">
            {!readOnly && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(lightbox.id);
                }}
                className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold px-4 py-3 rounded-lg shadow"
              >
                🗑 Supprimer
              </button>
            )}
            <button
              onClick={() => setLightbox(null)}
              className="bg-white text-slate-900 font-bold px-4 py-3 rounded-lg shadow"
            >
              Fermer
            </button>
          </div>
          <p className="text-white/70 text-xs mt-3">
            Photo · {lightbox.blob ? formatBytes(lightbox.blob.size) : ''}
          </p>
        </div>
      )}
    </div>
  );
}
