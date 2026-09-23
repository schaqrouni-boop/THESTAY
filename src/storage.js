// Couche d'accès aux données — backed par Supabase (était IndexedDB en local).
//
// API maintenue similaire à l'ancienne version IDB pour minimiser les changements ailleurs.
// Différence importante : les photos renvoient désormais `.url` (signed URL Supabase Storage)
// au lieu de `.blob`. Les composants doivent utiliser `.url`.

import { supabase } from './supabase.js';

const PHOTOS_BUCKET = 'photos';
const SIGNED_TTL_SECONDS = 60 * 60;

// === DRAFT STATE (partagé temps réel entre appareils) ===

export async function getDraftState() {
  const { data, error } = await supabase
    .from('draft_state')
    .select('state')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data?.state || {};
}

export async function setDraftState(state, updatedBy) {
  const { error } = await supabase
    .from('draft_state')
    .update({
      state,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null
    })
    .eq('id', 1);
  if (error) throw error;
}

export function subscribeDraftState(onChange) {
  const channel = supabase
    .channel('rt:draft_state')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'draft_state' },
      (payload) => {
        onChange(payload.new?.state || {}, payload.new?.updated_by);
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// === SNAPSHOTS ===

function mapSnapshotRow(row) {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    technicianName: row.technician_name,
    signatureDataUrl: row.signature_data_url,
    state: row.state
  };
}

export async function listSnapshots() {
  const { data, error } = await supabase
    .from('snapshots')
    .select('id, created_at, technician_name')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    technicianName: row.technician_name
  }));
}

export async function getSnapshot(id) {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSnapshotRow(data) : null;
}

export async function createSnapshot({ technicianName, signatureDataUrl, state }) {
  const { data: snap, error: insertErr } = await supabase
    .from('snapshots')
    .insert({
      technician_name: technicianName,
      signature_data_url: signatureDataUrl,
      state: state || {}
    })
    .select()
    .single();
  if (insertErr) throw insertErr;

  const { error: promoteErr } = await supabase
    .from('photos')
    .update({ session_id: snap.id })
    .is('session_id', null)
    .neq('typo_id', 'todo'); // ne pas happer les photos de la todo hebdo
  if (promoteErr) {
    console.warn('Échec promotion photos draft', promoteErr);
  }
  return mapSnapshotRow(snap);
}

export function subscribeSnapshots(onInsert) {
  const channel = supabase
    .channel('rt:snapshots')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'snapshots' },
      (payload) => {
        onInsert({
          id: payload.new.id,
          createdAt: new Date(payload.new.created_at).getTime(),
          technicianName: payload.new.technician_name
        });
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// === RÉCEPTIONS DE LOT (co-signées : THE STAY + entreprise) ===

function mapLotReceptionRow(row) {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    lotId: row.lot_id,
    technicianName: row.technician_name,
    technicianSignature: row.technician_signature,
    companyName: row.company_name,
    companyRepName: row.company_rep_name,
    companySignature: row.company_signature,
    snapshot: row.snapshot || null
  };
}

export async function createLotReception({
  lotId,
  technicianName,
  technicianSignature,
  companyName,
  companyRepName,
  companySignature,
  snapshot
}) {
  const { data, error } = await supabase
    .from('lot_receptions')
    .insert({
      lot_id: lotId,
      technician_name: technicianName,
      technician_signature: technicianSignature,
      company_name: companyName,
      company_rep_name: companyRepName,
      company_signature: companySignature,
      snapshot: snapshot || null
    })
    .select()
    .single();
  if (error) throw error;
  return mapLotReceptionRow(data);
}

export async function listLotReceptions(lotId) {
  const { data, error } = await supabase
    .from('lot_receptions')
    .select('*')
    .eq('lot_id', lotId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapLotReceptionRow);
}

// === PHOTOS ===

async function attachUrls(rows) {
  if (!rows || !rows.length) return [];
  const paths = rows.map((r) => r.storage_path);
  const { data: signed, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_TTL_SECONDS);
  if (error) throw error;
  const urlMap = new Map();
  for (const s of signed || []) {
    if (s.path && !s.error) urlMap.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    typoId: r.typo_id,
    unitId: r.unit_id,
    section: r.section,
    sessionId: r.session_id,
    storagePath: r.storage_path,
    createdAt: new Date(r.created_at).getTime(),
    url: urlMap.get(r.storage_path) || null
  }));
}

function applySessionFilter(query, sessionId) {
  if (sessionId === 'all') {
    // Toutes sessions confondues (draft + snapshots signés) — utilisé pour l'historique
    return query;
  }
  if (sessionId === 'draft' || sessionId == null) {
    return query.is('session_id', null);
  }
  return query.eq('session_id', sessionId);
}

export async function addPhoto({ typoId, unitId, section, blob, sessionId = 'draft' }) {
  const ext =
    blob.type?.includes('png') ? 'png' : blob.type?.includes('webp') ? 'webp' : 'jpg';
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${typoId}/${unitId}/${section}/${Date.now()}_${rand}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false
    });
  if (uploadErr) throw uploadErr;

  const dbSessionId = sessionId === 'draft' || sessionId == null ? null : sessionId;
  const { data, error } = await supabase
    .from('photos')
    .insert({
      typo_id: typoId,
      unit_id: unitId,
      section,
      session_id: dbSessionId,
      storage_path: path
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]).catch(() => {});
    throw error;
  }
  const [enriched] = await attachUrls([data]);
  return enriched;
}

export async function getPhotosForUnit(typoId, unitId, section, sessionId = 'draft') {
  const q = supabase
    .from('photos')
    .select('*')
    .eq('typo_id', typoId)
    .eq('unit_id', unitId)
    .eq('section', section)
    .order('created_at', { ascending: true });
  const { data, error } = await applySessionFilter(q, sessionId);
  if (error) throw error;
  return await attachUrls(data || []);
}

export async function getPhotosBySection(section, sessionId = 'draft') {
  const q = supabase
    .from('photos')
    .select('*')
    .eq('section', section)
    .order('typo_id', { ascending: true })
    .order('unit_id', { ascending: true })
    .order('created_at', { ascending: true });
  const { data, error } = await applySessionFilter(q, sessionId);
  if (error) throw error;
  return await attachUrls(data || []);
}

export async function countPhotosBySection(section, sessionId = 'draft') {
  const q = supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('section', section);
  const { count, error } = await applySessionFilter(q, sessionId);
  if (error) throw error;
  return count || 0;
}

export async function deletePhoto(id) {
  const { data: row, error: fetchErr } = await supabase
    .from('photos')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  if (row?.storage_path) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([row.storage_path]).catch((e) => {
      console.warn('Suppression fichier storage KO', e);
    });
  }
  const { error } = await supabase.from('photos').delete().eq('id', id);
  if (error) throw error;
}

export async function clearAllPhotos() {
  console.warn('clearAllPhotos: opération désactivée en mode cloud.');
}

// === TODO HEBDOMADAIRE ===
// todo_items  : les points (gérés par l'admin), groupés par catégorie.
// todo_entries: le remplissage du technicien, une ligne par (semaine, point).
// Les photos réutilisent la table photos : typo_id='todo', unit_id=week_key,
// section=String(item_id), session_id NULL (exclues de la promotion snapshot).

export async function listTodoItems({ includeArchived = false } = {}) {
  let q = supabase
    .from('todo_items')
    .select('*')
    .order('position', { ascending: true })
    .order('id', { ascending: true });
  if (!includeArchived) q = q.eq('archived', false);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createTodoItem({ category, title, position, priority }) {
  const { data, error } = await supabase
    .from('todo_items')
    .insert({
      category: category || '',
      title,
      position: position ?? Date.now(),
      priority: priority || 'NORMALE'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTodoItem(id, patch) {
  const { data, error } = await supabase
    .from('todo_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTodoItem(id) {
  const { error } = await supabase.from('todo_items').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeTodoItems(onChange) {
  const channel = supabase
    .channel('rt:todo_items')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_items' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function getTodoEntries(weekKey) {
  const { data, error } = await supabase
    .from('todo_entries')
    .select('*')
    .eq('week_key', weekKey);
  if (error) throw error;
  return data || [];
}

export async function upsertTodoEntry({ weekKey, item, done, comment, updatedBy }) {
  const row = {
    week_key: weekKey,
    item_id: item.id,
    item_category: item.category || '',
    item_title: item.title || '',
    item_priority: item.priority || 'NORMALE',
    done: !!done,
    comment: comment || '',
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || null
  };
  const { data, error } = await supabase
    .from('todo_entries')
    .upsert(row, { onConflict: 'week_key,item_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function subscribeTodoEntries(weekKey, onChange) {
  const channel = supabase
    .channel('rt:todo_entries:' + weekKey)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'todo_entries', filter: `week_key=eq.${weekKey}` },
      onChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// === REGISTRE DES LOGEMENTS FINIS ET FERMÉS ===

// Checklist d'avancement par logement : { [unitId]: { [itemKey]: bool } }
export async function getApartmentClosure() {
  const { data, error } = await supabase.from('apartments_closed').select('unit_id, items');
  if (error) throw error;
  const map = {};
  for (const r of data || []) map[r.unit_id] = r.items || {};
  return map;
}

export async function setApartmentClosure(unitId, items, updatedBy) {
  const { error } = await supabase.from('apartments_closed').upsert(
    { unit_id: unitId, items: items || {}, updated_at: new Date().toISOString(), updated_by: updatedBy || null },
    { onConflict: 'unit_id' }
  );
  if (error) throw error;
}

export function subscribeClosedApartments(onChange) {
  const channel = supabase
    .channel('rt:apartments_closed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'apartments_closed' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// Nombre de photos par point pour une semaine : { [section=item_id]: count }.
export async function getTodoPhotoCounts(weekKey) {
  const { data, error } = await supabase
    .from('photos')
    .select('section')
    .eq('typo_id', 'todo')
    .eq('unit_id', weekKey);
  if (error) throw error;
  const counts = {};
  for (const r of data || []) counts[r.section] = (counts[r.section] || 0) + 1;
  return counts;
}

// Semaines présentes dans l'historique (du plus récent au plus ancien).
export async function listTodoWeeks() {
  const { data, error } = await supabase
    .from('todo_entries')
    .select('week_key')
    .order('week_key', { ascending: false });
  if (error) throw error;
  const seen = new Set();
  const out = [];
  for (const r of data || []) {
    if (!seen.has(r.week_key)) {
      seen.add(r.week_key);
      out.push(r.week_key);
    }
  }
  return out;
}
