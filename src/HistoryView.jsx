import { useEffect, useState } from 'react';
import { listSnapshots, getSnapshot } from './storage.js';
import { TYPOLOGIES, LOTS, flatItemsForLot } from './data.js';
import SendModal from './SendModal.jsx';

function formatDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function progressOf(state) {
  let done = 0;
  let total = 0;
  for (const t of TYPOLOGIES) {
    for (const lot of LOTS) {
      const items = flatItemsForLot(t.id, lot.id);
      if (!items.length) continue;
      for (const u of t.units) {
        const us = state?.[t.id]?.[u]?.[lot.id] || {};
        for (const it of items) {
          total += 1;
          if (us[it.key]) done += 1;
        }
      }
    }
  }
  return { done, total };
}

export default function HistoryView({ onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snaps = await listSnapshots();
        setList(snaps);
      } catch (e) {
        setError('Lecture historique KO : ' + (e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openExport = async (snapshotId) => {
    try {
      const full = await getSnapshot(snapshotId);
      if (!full) {
        setError('Snapshot introuvable.');
        return;
      }
      const { done, total } = progressOf(full.state);
      setActive({ ...full, _progress: { done, total } });
      setExportOpen(true);
    } catch (e) {
      setError('Ouverture KO : ' + (e?.message || e));
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-100">
      <header className="sticky top-0 z-20 bg-blue-800 text-white shadow-lg">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold px-3 py-2 rounded-lg shadow active:scale-95"
          >
            ← Accueil
          </button>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-base font-bold leading-tight truncate">Historique des contrôles</h1>
            <p className="text-[11px] text-blue-100">
              {list.length} enregistrement{list.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="w-[88px]" />
        </div>
      </header>

      <main className="flex-1 px-3 py-4 pb-24 space-y-3">
        {loading ? (
          <p className="text-center text-slate-500 py-12">Chargement…</p>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm font-medium">
            {error}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center text-slate-500 py-16">
            <div className="text-5xl mb-3">📂</div>
            <p className="font-bold text-lg">Aucun contrôle enregistré</p>
            <p className="text-sm mt-2">
              Quand Nabil sauvegarde un contrôle signé, il apparaîtra ici.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((s, i) => (
              <li
                key={s.id}
                className="bg-white rounded-xl shadow-sm border-2 border-slate-200 overflow-hidden"
              >
                <div className="p-3 flex items-center gap-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xl font-bold">
                    {list.length - i}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm leading-tight">
                      {formatDateTime(s.createdAt)}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">Technicien : {s.technicianName}</p>
                    {i === 0 && (
                      <span className="inline-block mt-1 text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full uppercase">
                        Dernier
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => openExport(s.id)}
                    className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold text-sm px-3 py-2 rounded-lg shadow flex items-center gap-1 flex-shrink-0"
                  >
                    📤 PDF
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SendModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        mode="snapshot"
        snapshot={active}
      />
    </div>
  );
}
