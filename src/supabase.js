// Client Supabase + helpers d'authentification.
//
// La "publishable key" (sb_publishable_*) est conçue pour être publique dans le bundle frontend.
// La sécurité repose sur les policies RLS (Row Level Security) côté Supabase.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mwiottnkuigxwuyojuox.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Aa3lTLaAruzJhds_VxpoNQ_Bc6bhQaE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  }
});

// Mapping email → rôle/displayName. Évite d'avoir à mettre la metadata côté Supabase
// (interface UI fastidieuse) — on hardcode ici car on a seulement 2 comptes.
const USER_DATA = {
  'nabil@thestay.local': { role: 'tech', displayName: 'Nabil' },
  'saad@thestay.local': { role: 'admin', displayName: 'Saad' }
};

export function userInfoFromAuth(authUser) {
  if (!authUser?.email) return null;
  const entry = USER_DATA[authUser.email.toLowerCase()];
  if (entry) return { email: authUser.email, ...entry };
  return { email: authUser.email, role: 'tech', displayName: authUser.email.split('@')[0] };
}

// Permet à Nabil/Saad de taper juste "Nabil" comme identifiant
// (on rajoute le domaine en interne avant d'envoyer à Supabase Auth).
export function usernameToEmail(username) {
  const t = String(username || '').trim().toLowerCase();
  if (!t) return '';
  if (t.includes('@')) return t;
  return `${t}@thestay.local`;
}

export async function signIn(username, password) {
  const email = usernameToEmail(username);
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}
