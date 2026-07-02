import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
import LotDashboardView from './LotDashboardView.jsx';
import SaveModal from './SaveModal.jsx';
import PhotosSection from './PhotosSection.jsx';
import {
  supabase,
  userInfoFromAuth,
  signOut,
  getCurrentSession
} from './supabase.js';
import {
  getDraftState,
  setDraftState,
  subscribeDraftState
} from './storage.js';

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
  const [authChecked, setAuthChecked] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [state, setState] = useState({});
  const [stateLoaded, setStateLoaded] = useState(false);
  const [view, setView] = useState({ type: 'home' });
  const [saveOpen, setSaveOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [photosKey, setPhotosKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const pushTimerRef = useRef(null);
  const lastPushedStateRef = useRef(JSON.stringify({}));

  // ---- Auth bootstrap ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      const session = await getCurrentSession();
      if (mounted) {
        setAuthUser(session?.user || null);
        setAuthChecked(true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // ---- Charge le draft state cloud quand authentifié ----
  useEffect(() => {
    if (!authUser) {
      setState({});
      setStateLoaded(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const cloudState = await getDraftState();
        if (mounted) {
          lastPushedStateRef.current = JSON.stringify(cloudState);
          setState(cloudState);
          setStateLoaded(true);
        }
      } catch (e) {
        console.warn('Lecture draft state KO', e);
        if (mounted) setStateLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authUser?.id]);

  // ---- Realtime subscription au draft state ----
  useEffect(() => {
    if (!authUser) return;
    const unsub = subscribeDraftState((newState) => {
      const newStr = JSON.stringify(newState || {});
      if (newStr !== lastPushedStateRef.current) {
        lastPushedStateRef.current = newStr;
        setState(newState || {});
      }
    });
    return unsub;
  }, [authUser?.id]);

  // ---- Push debounced du draft state ----
  useEffect(() => {
    if (!authUser || !stateLoaded) return;
    const stateStr = JSON.stringify(state);
    if (stateStr === lastPushedStateRef.current) return;

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      try {
        lastPushedStateRef.current = stateStr;
        await setDraftState(state, authUser?.email);
      } catch (e) {
        console.warn('Push draft state KO', e);
      }
    }, 800);
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [state, authUser, stateLoaded]);

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

  const logout = useCallback(async () => {
    if (!window.confirm('Se déconnecter ?')) return;
    try {
      await signOut();
    } catch (e) {
      console.warn('Sign out KO', e);
    }
    setView({ type: 'home' });
  }, []);

  const handleSaved = useCallback((snap) => {
    setSaveOpen(false);
    setToast(`Contrôle #${snap.id} enregistré le ${new Date(snap.createdAt).toLocaleString('fr-FR')}.`);
    setPhotosKey((k) => k + 1);
    setRefreshKey((k) => k + 1);
  }, []);

  // ---- Loading / Login gates ----

  if (!authChecked) {
    return (
      <div className="min-h-full flex items-center justify-center bg-blue-800 text-white">
        <p className="text-sm">Chargement…</p>
      </div>
    );
  }

  if (!authUser) {
    return <Login onLogin={(user) => setAuthUser(user)} />;
  }

  const userInfo = userInfoFromAuth(authUser);
  const role = userInfo?.role || 'tech';
  const displayName = userInfo?.displayName || authUser.email;

  if (!stateLoaded) {
    return (
      <div className="min-h-full flex items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">Synchronisation des données…</p>
      </div>
    );
  }

  if (view.type === 'history') {
    return <HistoryView onClose={() => setView({ type: 'home' })} />;
  }

  if (view.type === 'lotDashboard') {
    return <LotDashboardView state={state} onClose={() => setView({ type: 'home' })} />;
  }

  if (view.type === 'home') {
    return (
      <>
        <Home
          user={displayName}
          role={role}
          state={state}
          refreshKey={refreshKey}
          onSelectTypology={(typoId) => setView({ type: 'typology', typoId })}
          onOpenHistory={() => setView({ type: 'history' })}
          onOpenLotDashboard={() => setView({ type: 'lotDashboard' })}
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
        user={displayName}
        role={role}
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
        technicianName={displayName}
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
