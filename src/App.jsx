import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  TYPOLOGIES,
  LOTS,
  lotsForTypology,
  groupsForLot,
  flatItemsForLot
} from './data.js';
import Login from './Login.jsx';
import Home from './Home.jsx';
import HistoryView from './HistoryView.jsx';
import SaveModal from './SaveModal.jsx';
import PhotosSection from './PhotosSection.jsx';
import { clearAllPhotos } from './storage.js';

const STORAGE_KEY = 'suivi-chantier-v2';
const AUTH_KEY = 'suivi-chantier-auth';
const MIGRATION_FLAG = 'suivi-chantier-migrated-v2';
const MIGRATION_V21_FLAG = 'suivi-chantier-migrated-v21';

// ---------- Migrations ----------

async function runV2MigrationIfNeeded() {
  if (localStorage.getItem(MIGRATION_FLAG) === '1') return;
  try {
    localStorage.removeItem('suivi-chantier-v1');
  } catch {}
  try {
    await clearAllPhotos();
  } catch (e) {
    console.warn('Migration v2 : suppression photos KO', e);
  }
  localStorage.setItem(MIGRATION_FLAG, '1');
}

const QUINCAILLERIE_REMAP = {
  studio: {
    boiserie_bibancom: {
      'Poignée Digitale': 'Quincaillerie — Poignée Digitale',
      'Canon Bouton SDB': 'Quincaillerie — Canon Bouton SDB',
      'Butoirs portes': 'Quincaillerie — Butoirs portes',
      'Poignées portes intérieur x 2': 'Quincaillerie — Poignées portes intérieur x 2'
    }
  },
  appt2c: {
    boiserie_bibancom: {
      'Butoirs portes x 5': 'Quincaillerie — Butoirs portes x 5',
      'Poignées portes intérieur x 5': 'Quincaillerie — Poignées portes intérieur x 5'
    }
  },
  appt3c: {
    boiserie_bibancom: {
      'Butoirs portes x 7': 'Quincaillerie — Butoirs portes x 7',
      'Poignées portes intérieur x 7': 'Quincaillerie — Poignées portes intérieur x 7'
    }
  }
};

function runV21KeyRemapIfNeeded() {
  if (localStorage.getItem(MIGRATION_V21_FLAG) === '1') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      if (state && typeof state === 'object') {
        for (const [typoId, typoMap] of Object.entries(QUINCAILLERIE_REMAP)) {
          const typoState = state[typoId];
          if (!typoState) continue;
          for (const unitId of Object.keys(typoState)) {
            const unitState = typoState[unitId];
            if (!unitState) continue;
            for (const [lotId, keyMap] of Object.entries(typoMap)) {
              const lotState = unitState[lotId];
              if (!lotState) continue;
              for (const [oldKey, newKey] of Object.entries(keyMap)) {
                if (oldKey in lotState) {
                  lotState[newKey] = lotState[oldKey];
                  delete lotState[oldKey];
                }
              }
            }
          }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    }
  } catch (e) {
    console.warn('Migration v2.1 : remap clés KO', e);
  }
  localStorage.setItem(MIGRATION_V21_FLAG, '1');
}

// ---------- Persistance ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Échec sauvegarde localStorage', e);
  }
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    // Ancien format : juste une string. On force re-login pour récupérer le rôle.
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      if (parsed?.username && parsed?.role) return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------- Helpers progression ----------

function lotProgress(state, typoId, unitId, lotId) {
  const items = flatItemsForLot(typoId, lotId);
  const us = state?.[typoId]?.[unitId]?.[lotId] || {};
  const done = items.filter((it) => us[it.key]).length;
  return { done, total: items.length };
}

function unitProgress(state, typoId, unitId) {
  let done = 0;
  let total = 0;
  for (const lot of LOTS) {
    const lp = lotProgress(state, typoId, unitId, lot.id);
    done += lp.done;
    total += lp.total;
  }
  return { done, total };
}

function unitStatus(done, total) {
  if (total === 0) return 'todo';
  if (done === 0) return 'todo';
  if (done >= total) return 'done';
  return 'inprogress';
}

function statusColor(status) {
  switch (status) {
    case 'done':
      return { bar: 'bg-green-600', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-500', dot: 'bg-green-600' };
    case 'inprogress':
      return { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-400', dot: 'bg-orange-500' };
    default:
      return { bar: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-white', border: 'border-slate-300', dot: 'bg-slate-400' };
  }
}

function typoProgress(state, typoId, units) {
  let done = 0;
  let total = 0;
  for (const u of units) {
    const up = unitProgress(state, typoId, u);
    done += up.done;
    total += up.total;
  }
  return { done, total };
}

// ---------- Composants UI ----------

function ProgressBar({ done, total, size = 'md' }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const status = unitStatus(done, total);
  const c = statusColor(status);
  const height = size === 'sm' ? 'h-2' : 'h-3';
  return (
    <div className={`w-full bg-slate-200 rounded-full overflow-hidden ${height}`}>
      <div
        className={`${c.bar} ${height} transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function LotChecklist({ groups, values, onToggle, readOnly }) {
  return (
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
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg bg-slate-50 ${
                      readOnly
                        ? 'cursor-default opacity-90'
                        : 'hover:bg-slate-100 active:bg-slate-200 cursor-pointer'
                    } tap-target border border-slate-200`}
                  >
                    <input
                      type="checkbox"
                      className="big-check flex-shrink-0"
                      checked={checked}
                      onChange={() => !readOnly && onToggle(it.key)}
                      disabled={readOnly}
                    />
                    <span
                      className={`text-base flex-1 ${
                        checked ? 'line-through text-slate-500' : 'text-slate-900 font-medium'
                      }`}
                    >
                      {it.label}
                    </span>
                    {checked && (
                      <span className="text-green-600 text-xl font-bold flex-shrink-0">✓</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function LotSection({ typoId, unitId, lot, state, onToggleItem, readOnly, photosKey }) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupsForLot(typoId, lot.id), [typoId, lot.id]);
  const { done, total } = lotProgress(state, typoId, unitId, lot.id);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const status = unitStatus(done, total);
  const c = statusColor(status);
  const values = state?.[typoId]?.[unitId]?.[lot.id] || {};

  return (
    <div className={`rounded-lg border-2 ${c.border} ${c.bg} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-3 flex items-center gap-2 text-left tap-target"
        aria-expanded={open}
      >
        <span className="text-xl flex-shrink-0" aria-hidden>{lot.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-bold text-sm text-slate-900 truncate">{lot.label}</span>
            <span className={`text-xs font-semibold ${c.text} flex-shrink-0`}>
              {done}/{total} · {pct}%
            </span>
          </div>
          <div className="mt-1.5">
            <ProgressBar done={done} total={total} size="sm" />
          </div>
        </div>
        <span
          className={`text-lg text-slate-500 transform transition-transform flex-shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-200 bg-white">
          <LotChecklist
            groups={groups}
            values={values}
            onToggle={(itemKey) => onToggleItem(lot.id, itemKey)}
            readOnly={readOnly}
          />
          <div className="mt-3">
            <PhotosSection
              key={photosKey}
              typoId={typoId}
              unitId={unitId}
              section={lot.id}
              enabled={open}
              labelOverride={`Photos ${lot.short.toLowerCase()}`}
              readOnly={readOnly}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function UnitCard({ typoId, unitId, state, isOpen, onToggleOpen, onToggleItem, readOnly, photosKey }) {
  const { done, total } = unitProgress(state, typoId, unitId);
  const status = unitStatus(done, total);
  const c = statusColor(status);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className={`rounded-xl border-2 ${c.border} ${c.bg} shadow-sm overflow-hidden transition-all`}>
      <button
        onClick={onToggleOpen}
        className="w-full px-4 py-4 flex items-center gap-3 text-left tap-target"
        aria-expanded={isOpen}
      >
        <span className={`w-3 h-3 rounded-full ${c.dot} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-bold text-lg text-slate-900">{unitId}</span>
            <span className={`text-sm font-semibold ${c.text}`}>
              {done}/{total} · {pct}%
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar done={done} total={total} size="sm" />
          </div>
        </div>
        <span
          className={`text-2xl text-slate-500 transform transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-3 border-t border-slate-200 bg-white space-y-2">
          {lotsForTypology(typoId).map((lot) => (
            <LotSection
              key={lot.id}
              typoId={typoId}
              unitId={unitId}
              lot={lot}
              state={state}
              onToggleItem={(lotId, itemKey) => onToggleItem(lotId, itemKey)}
              readOnly={readOnly}
              photosKey={photosKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const FILTERS = [
  { id: 'all', label: 'Tout' },
  { id: 'todo', label: 'Non commencé' },
  { id: 'inprogress', label: 'En cours' },
  { id: 'done', label: 'Terminé' }
];

function TypologyView({ user, role, typoId, state, onToggleItem, onBack, onExportCSV, onSave, photosKey }) {
  const [openUnitId, setOpenUnitId] = useState(null);
  const [filter, setFilter] = useState('all');

  const activeTypo = useMemo(() => TYPOLOGIES.find((t) => t.id === typoId), [typoId]);
  if (!activeTypo) return null;

  const readOnly = role === 'admin';

  const filteredUnits = activeTypo.units.filter((u) => {
    const { done, total } = unitProgress(state, activeTypo.id, u);
    const status = unitStatus(done, total);
    if (filter === 'all') return true;
    return status === filter;
  });

  const typoProg = typoProgress(state, activeTypo.id, activeTypo.units);
  const typoPct = typoProg.total === 0 ? 0 : Math.round((typoProg.done / typoProg.total) * 100);

  const counts = (() => {
    const out = { all: activeTypo.units.length, todo: 0, inprogress: 0, done: 0 };
    for (const u of activeTypo.units) {
      const { done, total } = unitProgress(state, activeTypo.id, u);
      out[unitStatus(done, total)] += 1;
    }
    return out;
  })();

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 bg-blue-800 text-white shadow-lg">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onBack}
              className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold px-3 py-2 rounded-lg shadow active:scale-95 flex-shrink-0"
            >
              ←
            </button>
            <div className="flex-1 min-w-0 px-2">
              <h1 className="text-base font-bold leading-tight truncate text-center">
                {activeTypo.label}
              </h1>
              <p className="text-[11px] text-blue-100 text-center">
                {user} · {role === 'admin' ? 'lecture seule' : 'contrôle'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!readOnly && (
                <button
                  onClick={onSave}
                  className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-sm px-3 py-2 rounded-lg shadow active:scale-95 flex items-center gap-1"
                  title="Sauvegarder le contrôle signé"
                >
                  <span aria-hidden>💾</span>
                  <span className="hidden sm:inline">Sauver</span>
                </button>
              )}
              <button
                onClick={onExportCSV}
                className="bg-blue-900 hover:bg-blue-950 text-white text-sm px-3 py-2 rounded-lg shadow active:scale-95"
                title="Exporter CSV"
              >
                ⤓
              </button>
            </div>
          </div>

          <div className="mt-3 bg-blue-900/40 rounded-lg p-2">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>{activeTypo.label}</span>
              <span>
                {typoProg.done}/{typoProg.total} · {typoPct}%
              </span>
            </div>
            <div className="mt-1 w-full bg-blue-950/60 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-400 h-2 transition-all duration-300"
                style={{ width: `${typoPct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-[110px] z-10 bg-slate-100 border-b border-slate-200 px-3 py-2 overflow-x-auto">
        <div className="flex gap-2">
          {FILTERS.map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`whitespace-nowrap px-3 py-2 rounded-full text-sm font-semibold border-2 transition-colors ${
                  isActive
                    ? 'bg-blue-800 text-white border-blue-800'
                    : 'bg-white text-slate-700 border-slate-300 active:bg-slate-100'
                }`}
              >
                {f.label}{' '}
                <span
                  className={`ml-1 inline-block min-w-[22px] text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {counts[f.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 px-3 py-3 pb-24 space-y-3">
        {filteredUnits.length === 0 ? (
          <div className="text-center text-slate-500 py-12">
            <div className="text-4xl mb-2">∅</div>
            <p className="font-semibold">Aucune unité dans ce filtre</p>
            <p className="text-sm mt-1">Essayez "Tout"</p>
          </div>
        ) : (
          filteredUnits.map((unitId) => (
            <UnitCard
              key={unitId}
              typoId={activeTypo.id}
              unitId={unitId}
              state={state}
              isOpen={openUnitId === unitId}
              onToggleOpen={() => setOpenUnitId((prev) => (prev === unitId ? null : unitId))}
              onToggleItem={(lotId, itemKey) => onToggleItem(activeTypo.id, unitId, lotId, itemKey)}
              readOnly={readOnly}
              photosKey={photosKey}
            />
          ))
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-2 text-center text-xs text-slate-500">
        {filteredUnits.length} / {activeTypo.units.length} unités affichées
      </footer>
    </div>
  );
}

// ---------- App ----------

export default function App() {
  const [auth, setAuth] = useState(() => loadAuth());
  const [state, setState] = useState(() => loadState());
  const [view, setView] = useState({ type: 'home' });
  const [saveOpen, setSaveOpen] = useState(false);
  const [toast, setToast] = useState(null);
  // Bump pour forcer le refresh des PhotosSection après save (photos draft vidées)
  const [photosKey, setPhotosKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    runV2MigrationIfNeeded();
    runV21KeyRemapIfNeeded();
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleItem = useCallback((typoId, unitId, lotId, itemKey) => {
    setState((prev) => {
      const next = { ...prev };
      const typoBlock = { ...(next[typoId] || {}) };
      const unitBlock = { ...(typoBlock[unitId] || {}) };
      const lotBlock = { ...(unitBlock[lotId] || {}) };
      lotBlock[itemKey] = !lotBlock[itemKey];
      unitBlock[lotId] = lotBlock;
      typoBlock[unitId] = unitBlock;
      next[typoId] = typoBlock;
      return next;
    });
  }, []);

  const exportCSV = useCallback(() => {
    const rows = [['Typologie', 'Unité', 'Lot', 'Groupe', 'Élément', 'État']];
    for (const typo of TYPOLOGIES) {
      for (const unit of typo.units) {
        const us = state?.[typo.id]?.[unit] || {};
        for (const lot of LOTS) {
          const items = flatItemsForLot(typo.id, lot.id);
          const lotState = us[lot.id] || {};
          for (const it of items) {
            rows.push([
              typo.label,
              unit,
              lot.label,
              it.group || '',
              it.label,
              lotState[it.key] ? 'OK' : ''
            ]);
          }
        }
      }
    }
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `suivi-chantier-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state]);

  const logout = useCallback(() => {
    if (window.confirm('Se déconnecter ?')) {
      localStorage.removeItem(AUTH_KEY);
      setAuth(null);
      setView({ type: 'home' });
    }
  }, []);

  const handleSaved = useCallback((snap) => {
    setSaveOpen(false);
    setToast(`Contrôle #${snap.id} enregistré le ${new Date(snap.createdAt).toLocaleString('fr-FR')}.`);
    // Refresh photos sections (draft est maintenant vide)
    setPhotosKey((k) => k + 1);
    setRefreshKey((k) => k + 1);
  }, []);

  // ---------- Login gate ----------

  if (!auth) {
    return (
      <Login
        onLogin={(username, role) => {
          const a = { username, role };
          localStorage.setItem(AUTH_KEY, JSON.stringify(a));
          setAuth(a);
          setView({ type: 'home' });
        }}
      />
    );
  }

  // ---------- Routes ----------

  if (view.type === 'history') {
    return <HistoryView onClose={() => setView({ type: 'home' })} />;
  }

  if (view.type === 'home') {
    return (
      <>
        <Home
          user={auth.username}
          role={auth.role}
          refreshKey={refreshKey}
          onSelectTypology={(typoId) => setView({ type: 'typology', typoId })}
          onOpenHistory={() => setView({ type: 'history' })}
          onLogout={logout}
        />
        {toast && (
          <div className="fixed bottom-20 inset-x-0 px-4 z-50">
            <div className="mx-auto max-w-md bg-green-700 text-white font-semibold px-4 py-3 rounded-lg shadow-2xl">
              ✓ {toast}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <TypologyView
        user={auth.username}
        role={auth.role}
        typoId={view.typoId}
        state={state}
        onToggleItem={toggleItem}
        onBack={() => setView({ type: 'home' })}
        onExportCSV={exportCSV}
        onSave={() => setSaveOpen(true)}
        photosKey={photosKey}
      />
      <SaveModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        state={state}
        technicianName={auth.username}
        onSaved={handleSaved}
      />
      {toast && (
        <div className="fixed bottom-20 inset-x-0 px-4 z-50">
          <div className="mx-auto max-w-md bg-green-700 text-white font-semibold px-4 py-3 rounded-lg shadow-2xl">
            ✓ {toast}
          </div>
        </div>
      )}
    </>
  );
}
