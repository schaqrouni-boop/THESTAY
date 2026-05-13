import { useEffect, useMemo, useState, useCallback } from 'react';
import { TYPOLOGIES, itemsForTypology, totalItemsFor } from './data.js';
import Login from './Login.jsx';
import SendModal from './SendModal.jsx';
import PhotosSection from './PhotosSection.jsx';
import { clearAllPhotos } from './storage.js';

const STORAGE_KEY = 'suivi-chantier-v1';
const AUTH_KEY = 'suivi-chantier-auth';

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
    console.warn('Échec de la sauvegarde localStorage', e);
  }
}

// ---------- Helpers ----------

function unitProgress(state, typoId, unitId) {
  const { cuisine, menuiserie } = itemsForTypology(typoId);
  const unitState = state?.[typoId]?.[unitId] || {};
  const cuisineDone = cuisine.filter((it) => unitState.cuisine?.[it]).length;
  const menuiserieDone = menuiserie.filter((it) => unitState.menuiserie?.[it]).length;
  const done = cuisineDone + menuiserieDone;
  const total = cuisine.length + menuiserie.length;
  return { done, total };
}

function unitStatus(done, total) {
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
  const per = totalItemsFor(typoId);
  const total = per * units.length;
  let done = 0;
  for (const u of units) {
    done += unitProgress(state, typoId, u).done;
  }
  return { done, total };
}

// ---------- Composants ----------

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

function ChecklistGroup({ title, items, values, onToggle }) {
  return (
    <div className="mb-4">
      <h4 className="font-bold text-slate-800 text-base mb-2 uppercase tracking-wide">
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item) => {
          const checked = !!values?.[item];
          return (
            <li key={item}>
              <label className="flex items-center gap-3 px-3 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 cursor-pointer tap-target border border-slate-200">
                <input
                  type="checkbox"
                  className="big-check flex-shrink-0"
                  checked={checked}
                  onChange={() => onToggle(item)}
                />
                <span
                  className={`text-base flex-1 ${
                    checked ? 'line-through text-slate-500' : 'text-slate-900 font-medium'
                  }`}
                >
                  {item}
                </span>
                {checked && (
                  <span className="text-green-600 text-xl font-bold flex-shrink-0">✓</span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UnitCard({ typoId, unitId, state, isOpen, onToggleOpen, onToggleItem }) {
  const { cuisine, menuiserie } = itemsForTypology(typoId);
  const unitState = state?.[typoId]?.[unitId] || { cuisine: {}, menuiserie: {} };
  const { done, total } = unitProgress(state, typoId, unitId);
  const status = unitStatus(done, total);
  const c = statusColor(status);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div
      className={`rounded-xl border-2 ${c.border} ${c.bg} shadow-sm overflow-hidden transition-all`}
    >
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
        <div className="px-4 pb-4 pt-2 border-t border-slate-200 bg-white">
          <ChecklistGroup
            title="Cuisine"
            items={cuisine}
            values={unitState.cuisine}
            onToggle={(item) => onToggleItem('cuisine', item)}
          />
          <PhotosSection
            typoId={typoId}
            unitId={unitId}
            section="cuisine"
            enabled={isOpen}
          />
          <div className="my-4 border-t border-slate-200" />
          <ChecklistGroup
            title="Menuiserie"
            items={menuiserie}
            values={unitState.menuiserie}
            onToggle={(item) => onToggleItem('menuiserie', item)}
          />
          <PhotosSection
            typoId={typoId}
            unitId={unitId}
            section="menuiserie"
            enabled={isOpen}
          />
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

// ---------- App ----------

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem(AUTH_KEY) || null);
  const [state, setState] = useState(() => loadState());
  const [activeTypoId, setActiveTypoId] = useState(TYPOLOGIES[0].id);
  const [openUnitId, setOpenUnitId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sendOpen, setSendOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const activeTypo = useMemo(
    () => TYPOLOGIES.find((t) => t.id === activeTypoId),
    [activeTypoId]
  );

  const toggleItem = useCallback(
    (typoId, unitId, section, item) => {
      setState((prev) => {
        const next = { ...prev };
        const typoBlock = { ...(next[typoId] || {}) };
        const unitBlock = { ...(typoBlock[unitId] || {}) };
        const sectionBlock = { ...(unitBlock[section] || {}) };
        sectionBlock[item] = !sectionBlock[item];
        unitBlock[section] = sectionBlock;
        typoBlock[unitId] = unitBlock;
        next[typoId] = typoBlock;
        return next;
      });
    },
    []
  );

  const filteredUnits = useMemo(() => {
    if (!activeTypo) return [];
    return activeTypo.units.filter((u) => {
      const { done, total } = unitProgress(state, activeTypo.id, u);
      const status = unitStatus(done, total);
      if (filter === 'all') return true;
      return status === filter;
    });
  }, [activeTypo, state, filter]);

  // ---------- Export CSV ----------

  const exportCSV = useCallback(() => {
    const rows = [['Typologie', 'Unité', 'Section', 'Élément', 'État']];
    for (const typo of TYPOLOGIES) {
      const { cuisine, menuiserie } = itemsForTypology(typo.id);
      for (const unit of typo.units) {
        const us = state?.[typo.id]?.[unit] || {};
        for (const it of cuisine) {
          rows.push([typo.label, unit, 'Cuisine', it, us.cuisine?.[it] ? 'OK' : '']);
        }
        for (const it of menuiserie) {
          rows.push([typo.label, unit, 'Menuiserie', it, us.menuiserie?.[it] ? 'OK' : '']);
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
    setMenuOpen(false);
  }, [state]);

  const resetAll = useCallback(async () => {
    if (
      window.confirm(
        'Réinitialiser toutes les données du chantier ?\n\nCela efface les cases cochées ET les photos.\nCette action est irréversible.'
      )
    ) {
      setState({});
      setOpenUnitId(null);
      try {
        await clearAllPhotos();
      } catch (e) {
        console.warn('Échec de la suppression des photos IDB', e);
      }
    }
    setMenuOpen(false);
  }, []);

  const logout = useCallback(() => {
    if (window.confirm('Se déconnecter ?')) {
      localStorage.removeItem(AUTH_KEY);
      setUser(null);
    }
    setMenuOpen(false);
  }, []);

  // ---------- Login gate ----------

  if (!user) {
    return (
      <Login
        onLogin={(u) => {
          localStorage.setItem(AUTH_KEY, u);
          setUser(u);
        }}
      />
    );
  }

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
      {/* HEADER FIXE */}
      <header className="sticky top-0 z-20 bg-blue-800 text-white shadow-lg">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-white rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0">
                <img
                  src="logo.svg"
                  alt="THE STAY"
                  className="h-7 w-auto block"
                  draggable="false"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold leading-tight truncate">Suivi Chantier</h1>
                <p className="text-[11px] text-blue-100">Menuiserie & Cuisines</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 relative">
              <button
                onClick={() => setSendOpen(true)}
                className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-sm px-3 py-2 rounded-lg shadow active:scale-95 flex items-center gap-1"
                title="Envoyer rapport PDF"
              >
                <span aria-hidden>📤</span>
                <span className="hidden xs:inline">Envoyer</span>
              </button>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="bg-blue-900 hover:bg-blue-950 text-white text-xl px-3 py-2 rounded-lg shadow active:scale-95"
                aria-label="Menu"
                aria-expanded={menuOpen}
              >
                ⋮
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-40 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 w-56 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                      <p className="text-xs text-slate-500">Connecté en tant que</p>
                      <p className="font-bold text-sm">{user}</p>
                    </div>
                    <button
                      onClick={exportCSV}
                      className="w-full text-left px-4 py-3 hover:bg-slate-100 active:bg-slate-200 text-sm font-semibold flex items-center gap-2"
                    >
                      <span>⤓</span> Exporter CSV
                    </button>
                    <button
                      onClick={resetAll}
                      className="w-full text-left px-4 py-3 hover:bg-slate-100 active:bg-slate-200 text-sm font-semibold text-red-700 flex items-center gap-2 border-t border-slate-100"
                    >
                      <span>↺</span> Réinitialiser
                    </button>
                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-3 hover:bg-slate-100 active:bg-slate-200 text-sm font-semibold flex items-center gap-2 border-t border-slate-100"
                    >
                      <span>⏻</span> Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Progression globale typologie */}
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

        {/* TABS TYPOLOGIES */}
        <nav className="flex border-t border-blue-700 bg-blue-800 overflow-x-auto">
          {TYPOLOGIES.map((t) => {
            const tp = typoProgress(state, t.id, t.units);
            const tpct = tp.total === 0 ? 0 : Math.round((tp.done / tp.total) * 100);
            const isActive = t.id === activeTypoId;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTypoId(t.id);
                  setOpenUnitId(null);
                }}
                className={`flex-1 min-w-[120px] py-3 px-2 text-sm font-bold border-b-4 transition-colors ${
                  isActive
                    ? 'border-white bg-blue-700 text-white'
                    : 'border-transparent text-blue-100 active:bg-blue-700'
                }`}
              >
                <div className="leading-tight">{t.short}</div>
                <div className="text-[11px] font-normal opacity-90 mt-0.5">
                  {t.units.length} unités · {tpct}%
                </div>
              </button>
            );
          })}
        </nav>
      </header>

      {/* BARRE DE FILTRES */}
      <div className="sticky top-[148px] z-10 bg-slate-100 border-b border-slate-200 px-3 py-2 overflow-x-auto">
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

      {/* LISTE DES UNITÉS */}
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
              onToggleItem={(section, item) => toggleItem(activeTypo.id, unitId, section, item)}
            />
          ))
        )}
      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-2 text-center text-xs text-slate-500">
        Données enregistrées localement · {filteredUnits.length} / {activeTypo.units.length} unités affichées
      </footer>

      {/* MODAL ENVOI */}
      <SendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        state={state}
        defaultTechnicianName={user}
      />
    </div>
  );
}
