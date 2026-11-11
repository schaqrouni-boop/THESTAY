// Contrôle à choix unique (segmenté) pour un item de réception spécial,
// ex. « Essayage Climatisation » → Validé / Moyen / Non (une option obligatoire).

const STYLES = {
  Validé: { on: 'bg-green-600 text-white border-green-600', off: 'bg-white text-green-700 border-green-300' },
  Moyen: { on: 'bg-orange-500 text-white border-orange-500', off: 'bg-white text-orange-700 border-orange-300' },
  Non: { on: 'bg-red-600 text-white border-red-600', off: 'bg-white text-red-700 border-red-300' }
};
const FALLBACK = {
  on: 'bg-blue-700 text-white border-blue-700',
  off: 'bg-white text-slate-600 border-slate-300'
};

export default function ChoiceControl({ options, value, onSelect, readOnly }) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => {
        const selected = value === opt;
        const s = STYLES[opt] || FALLBACK;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => !readOnly && onSelect?.(opt)}
            disabled={readOnly && !selected}
            className={`flex-1 px-2 py-2.5 rounded-lg text-sm font-bold border-2 transition-colors tap-target ${
              selected ? s.on : s.off
            } ${readOnly ? 'cursor-default' : 'active:scale-95'}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
