export type CatalogCategory = { category_id?: string | number; category_name?: string };
export type CatalogChannel = {
  num?: number | string;
  name?: string;
  stream_id: number | string;
  stream_url?: string;
  stream_icon?: string;
  category_id?: string | number;
  tv_archive?: boolean | number | string;
  tv_archive_duration?: number | string;
};

export type CatalogMovie = {
  stream_id: number | string;
  name?: string;
  stream_icon?: string;
  category_id?: string | number;
  container_extension?: string;
  added?: string | number;
  rating?: string | number;
  plot?: string;
  year?: string | number;
};

export type CatalogSeries = {
  series_id: number | string;
  name?: string;
  cover?: string;
  category_id?: string | number;
  plot?: string;
  releaseDate?: string;
  rating?: string | number;
  genre?: string;
};

export type SeriesEpisode = {
  id: number | string;
  title?: string;
  episode_num?: number | string;
  season?: number | string;
  container_extension?: string;
  info?: { movie_image?: string; plot?: string; duration?: string; releasedate?: string };
};

export type CachedCatalog = {
  key: string;
  savedAt: number;
  sourceType?: 'xtream' | 'm3u';
  categories: CatalogCategory[];
  channels: CatalogChannel[];
  movieCategories?: CatalogCategory[];
  movies?: CatalogMovie[];
  seriesCategories?: CatalogCategory[];
  series?: CatalogSeries[];
  playbackBase?: string;
  allowedFormats?: string[];
  liveFormat?: string;
};

const DATABASE = 'nextflix-catalog-cache';
const STORE = 'catalogs';
const LEGACY_EPG_STORE = 'epg';
const DATABASE_VERSION = 3;
const CACHE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

async function pruneStore(database: IDBDatabase, storeName: string, keepNewest: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const snapshots: { key: string; savedAt: number }[] = [];
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        const value = cursor.value as { key?: unknown; savedAt?: unknown };
        if (typeof value.key === 'string') snapshots.push({ key: value.key, savedAt: Number(value.savedAt) || 0 });
        cursor.continue();
        return;
      }
      snapshots.sort((left, right) => right.savedAt - left.savedAt);
      const cutoff = Date.now() - CACHE_RETENTION_MS;
      snapshots.forEach((snapshot, index) => {
        if (index >= keepNewest || snapshot.savedAt < cutoff) store.delete(snapshot.key);
      });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not prune old cache entries.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Cache pruning was interrupted.'));
  });
}

export async function pruneRebuildableCaches(): Promise<void> {
  const database = await openDatabase();
  try {
    await pruneStore(database, STORE, 2);
  } finally {
    database.close();
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    const request = window.indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'key' });
      if (database.objectStoreNames.contains(LEGACY_EPG_STORE)) database.deleteObjectStore(LEGACY_EPG_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open catalog storage.'));
    request.onblocked = () => reject(new Error('Catalog storage is busy.'));
  });
}

export async function readCatalog(key: string): Promise<CachedCatalog | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as CachedCatalog | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Could not read the saved catalog.'));
    });
  } finally {
    database.close();
  }
}

export async function writeCatalog(catalog: CachedCatalog): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(catalog);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the catalog.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Catalog save was interrupted.'));
    });
  } finally {
    database.close();
  }
}

export async function getRebuildableCacheCounts(): Promise<{ catalogs: number }> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readonly');
      const catalogs = transaction.objectStore(STORE).count();
      const counts = { catalogs: 0 };
      catalogs.onsuccess = () => { counts.catalogs = catalogs.result; };
      transaction.oncomplete = () => resolve(counts);
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not inspect saved cache data.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Cache inspection was interrupted.'));
    });
  } finally {
    database.close();
  }
}

export async function clearRebuildableCaches(): Promise<void> {
  if (!('indexedDB' in window)) throw new Error('IndexedDB is unavailable on this device.');
  await new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Could not clear cached catalog data.'));
    request.onblocked = () => reject(new Error('The cache is in use. Close other NextFlix tabs and try again.'));
  });
}
