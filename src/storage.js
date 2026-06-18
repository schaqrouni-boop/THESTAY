// Stockage IndexedDB : deux stores
//   - photos : { id, typoId, unitId, section, sessionId, blob, createdAt }
//     sessionId = 'draft' (en cours de travail) ou id numérique de snapshot (figées)
//   - snapshots : { id, createdAt, technicianName, signatureDataUrl, state }
//
// Convention : une photo sans sessionId (ancien schéma) est considérée comme 'draft'.

const DB_NAME = 'suivi-chantier';
const DB_VERSION = 2;
const PHOTOS = 'photos';
const SNAPSHOTS = 'snapshots';
const DRAFT = 'draft';

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const tx = req.transaction;
      if (!db.objectStoreNames.contains(PHOTOS)) {
        const store = db.createObjectStore(PHOTOS, {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('unit', ['typoId', 'unitId', 'section'], { unique: false });
        store.createIndex('section', 'section', { unique: false });
      }
      const photoStore = tx.objectStore(PHOTOS);
      if (!photoStore.indexNames.contains('session')) {
        photoStore.createIndex('session', 'sessionId', { unique: false });
      }
      if (!photoStore.indexNames.contains('unit_session')) {
        photoStore.createIndex('unit_session', ['typoId', 'unitId', 'section', 'sessionId'], {
          unique: false
        });
      }
      if (!db.objectStoreNames.contains(SNAPSHOTS)) {
        const snapStore = db.createObjectStore(SNAPSHOTS, {
          keyPath: 'id',
          autoIncrement: true
        });
        snapStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function normalizeSession(p) {
  return p?.sessionId || DRAFT;
}

// --------- PHOTOS ---------

export async function addPhoto({ typoId, unitId, section, blob, sessionId = DRAFT }) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTOS, 'readwrite');
    const record = {
      typoId,
      unitId,
      section,
      sessionId,
      blob,
      createdAt: Date.now()
    };
    const req = tx.objectStore(PHOTOS).add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

export async function getPhotosForUnit(typoId, unitId, section, sessionId = DRAFT) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTOS, 'readonly');
    const idx = tx.objectStore(PHOTOS).index('unit');
    const req = idx.getAll([typoId, unitId, section]);
    req.onsuccess = () => {
      const arr = (req.result || [])
        .filter((p) => normalizeSession(p) === sessionId)
        .sort((a, b) => a.createdAt - b.createdAt);
      resolve(arr);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPhotosBySection(section, sessionId = DRAFT) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTOS, 'readonly');
    const idx = tx.objectStore(PHOTOS).index('section');
    const req = idx.getAll(section);
    req.onsuccess = () => {
      const arr = (req.result || [])
        .filter((p) => normalizeSession(p) === sessionId)
        .sort((a, b) => {
          if (a.typoId !== b.typoId) return a.typoId.localeCompare(b.typoId);
          if (a.unitId !== b.unitId) return a.unitId.localeCompare(b.unitId);
          return a.createdAt - b.createdAt;
        });
      resolve(arr);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhoto(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTOS, 'readwrite');
    tx.objectStore(PHOTOS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllPhotos() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTOS, 'readwrite');
    tx.objectStore(PHOTOS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function countPhotosBySection(section, sessionId = DRAFT) {
  const photos = await getPhotosBySection(section, sessionId);
  return photos.length;
}

// --------- SNAPSHOTS ---------

// Crée un snapshot ET fige (promeut) toutes les photos 'draft' vers ce snapshot.
// Une fois sauvegardé, les photos draft disparaissent (= associées au snapshot),
// la prochaine session démarre avec 0 photo.
export async function createSnapshot({ technicianName, signatureDataUrl, state }) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SNAPSHOTS, PHOTOS], 'readwrite');
    let snapshotId = null;
    const snapStore = tx.objectStore(SNAPSHOTS);
    const record = {
      createdAt: Date.now(),
      technicianName,
      signatureDataUrl,
      state: JSON.parse(JSON.stringify(state || {}))
    };
    const addReq = snapStore.add(record);
    addReq.onsuccess = () => {
      snapshotId = addReq.result;
      const photoStore = tx.objectStore(PHOTOS);
      const photoReq = photoStore.openCursor();
      photoReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          if (normalizeSession(val) === DRAFT) {
            val.sessionId = snapshotId;
            cursor.update(val);
          }
          cursor.continue();
        }
      };
    };
    tx.oncomplete = () => resolve({ id: snapshotId, ...record });
    tx.onerror = () => reject(tx.error);
  });
}

export async function listSnapshots() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, 'readonly');
    const req = tx.objectStore(SNAPSHOTS).getAll();
    req.onsuccess = () => {
      const arr = (req.result || [])
        .map(({ id, createdAt, technicianName }) => ({ id, createdAt, technicianName }))
        .sort((a, b) => b.createdAt - a.createdAt);
      resolve(arr);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSnapshot(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, 'readonly');
    const req = tx.objectStore(SNAPSHOTS).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
