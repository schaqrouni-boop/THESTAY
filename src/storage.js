// Stockage des photos en IndexedDB (les blobs peuvent peser plusieurs Mo,
// localStorage est trop limité ~5-10 Mo total).

const DB_NAME = 'suivi-chantier';
const DB_VERSION = 1;
const STORE = 'photos';

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('unit', ['typoId', 'unitId', 'section'], { unique: false });
        store.createIndex('section', 'section', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

export async function addPhoto({ typoId, unitId, section, blob }) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const record = {
      typoId,
      unitId,
      section,
      blob,
      createdAt: Date.now()
    };
    const req = tx.objectStore(STORE).add(record);
    req.onsuccess = () => resolve({ id: req.result, ...record });
    req.onerror = () => reject(req.error);
  });
}

export async function getPhotosForUnit(typoId, unitId, section) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('unit');
    const req = idx.getAll([typoId, unitId, section]);
    req.onsuccess = () => {
      const arr = (req.result || []).sort((a, b) => a.createdAt - b.createdAt);
      resolve(arr);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPhotosBySection(section) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('section');
    const req = idx.getAll(section);
    req.onsuccess = () => {
      const arr = (req.result || []).sort((a, b) => {
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
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllPhotos() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function countPhotosBySection(section) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('section');
    const req = idx.count(section);
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}
