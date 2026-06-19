import { useState } from 'react';
import { signIn } from './supabase.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data, error: authErr } = await signIn(username, password);
      if (authErr) {
        setError('Identifiant ou mot de passe incorrect.');
        return;
      }
      if (data?.user) {
        onLogin?.(data.user);
      } else {
        setError('Connexion impossible. Réessayez.');
      }
    } catch (e2) {
      console.error(e2);
      setError('Connexion impossible. Vérifie ta connexion internet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-blue-800 px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex justify-center mb-6">
            <img src="logo.svg" alt="THE STAY" className="h-14 w-auto" draggable="false" />
          </div>

          <h1 className="text-center text-xl font-bold text-slate-900 mb-1">Suivi Chantier</h1>
          <p className="text-center text-sm text-slate-500 mb-6">Réception travaux</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Identifiant
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                className="w-full px-4 py-3 text-base border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                required
                disabled={busy}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-16 text-base border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded"
                  disabled={busy}
                >
                  {showPwd ? 'Cacher' : 'Voir'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-blue-800 hover:bg-blue-900 active:bg-blue-950 disabled:opacity-60 text-white font-bold text-base py-3 rounded-lg shadow active:scale-[0.98] transition-transform"
            >
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-blue-100 mt-4">© THE STAY · Accès réservé</p>
      </div>
    </div>
  );
}
