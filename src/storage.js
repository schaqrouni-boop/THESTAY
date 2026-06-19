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
    .is('session_id', null);
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
