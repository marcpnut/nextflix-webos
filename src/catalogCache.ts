export type CatalogCategory = { category_id?: string | number; category_name?: string };
export type CatalogChannel = {
  num?: number | string; name?: string; stream_id: number | string; stream_url?: string;
  stream_icon?: string; category_id?: string | number; tv_archive?: boolean | number | string;
  tv_archive_duration?: number | string;
};
export type CatalogMovie = {
  stream_id: number | string; name?: string; stream_icon?: string; category_id?: string | number;
  container_extension?: string; added?: string | number; rating?: string | number; plot?: string; year?: string | number;
};
export type CatalogSeries = {
  series_id: number | string; name?: string; cover?: string; category_id?: string | number;
  plot?: string; releaseDate?: string; rating?: string | number; genre?: string;
};
export type SeriesEpisode = {
  id: number | string; title?: string; episode_num?: number | string; season?: number | string;
  container_extension?: string; info?: { movie_image?: string; plot?: string; duration?: string; releasedate?: string };
};
export type CatalogDataset = 'live' | 'movies' | 'series';
export type CatalogSyncState = {
  lastAttemptAt?: number; lastSuccessAt?: number; lastError?: string; retryCount?: number;
};
export type CachedCatalog = {
  key: string; savedAt: number; sourceType?: 'xtream' | 'm3u';
  categories: CatalogCategory[]; channels: CatalogChannel[];
  movieCategories?: CatalogCategory[]; movies?: CatalogMovie[];
  seriesCategories?: CatalogCategory[]; series?: CatalogSeries[];
  playbackBase?: string; allowedFormats?: string[]; liveFormat?: string;
  syncState?: Partial<Record<CatalogDataset, CatalogSyncState>>;
};

/*
 * A normal packaged webOS web app has no supported SQLite driver/service.
 * IndexedDB is the persistent, transactional database available to both webOS
 * 4.x (C9) and 6.x. Versioned object stores keep upgrades in place and leave
 * the v1 snapshot store intact so existing installations migrate without loss.
 */
const DATABASE = 'nextflix-catalog-cache';
const CATALOGS = 'catalogs';
const PROVIDERS = 'providers';
const SYNC = 'sync-state';
const EPISODES = 'episodes';
const SETTINGS = 'settings';
const VERSION = 4;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB is unavailable.')); return; }
    const request = window.indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CATALOGS)) {
        const store = db.createObjectStore(CATALOGS, { keyPath: 'key' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(PROVIDERS)) {
        const store = db.createObjectStore(PROVIDERS, { keyPath: 'key' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(SYNC)) {
        const store = db.createObjectStore(SYNC, { keyPath: 'key' });
        store.createIndex('providerId', 'providerId', { unique: false });
        store.createIndex('providerDataset', ['providerId', 'dataset'], { unique: true });
      }
      if (!db.objectStoreNames.contains(EPISODES)) {
        const store = db.createObjectStore(EPISODES, { keyPath: 'key' });
        store.createIndex('providerId', 'providerId', { unique: false });
        store.createIndex('providerSeries', ['providerId', 'seriesId'], { unique: true });
      }
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open catalog database.'));
    request.onblocked = () => reject(new Error('Catalog database upgrade is blocked. Close other NextFlix windows and retry.'));
  });
}

export async function readCatalog(key: string): Promise<CachedCatalog | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([CATALOGS, SYNC], 'readonly');
      const request = tx.objectStore(CATALOGS).get(key);
      const syncState: Partial<Record<CatalogDataset, CatalogSyncState>> = {};
      const syncCursor = tx.objectStore(SYNC).index('providerId').openCursor(IDBKeyRange.only(key));
      syncCursor.onsuccess = () => {
        const cursor = syncCursor.result;
        if (!cursor) return;
        const row = cursor.value as { dataset?: CatalogDataset; state?: CatalogSyncState };
        if (row.dataset && row.state) syncState[row.dataset] = row.state;
        cursor.continue();
      };
      request.onsuccess = () => {
        const catalog = (request.result as CachedCatalog | undefined) ?? null;
        if (catalog) catalog.syncState = { ...(catalog.syncState ?? {}), ...syncState };
        (tx as IDBTransaction & { resultCatalog?: CachedCatalog | null }).resultCatalog = catalog;
      };
      request.onerror = () => reject(request.error ?? new Error('Could not read saved catalog.'));
      tx.oncomplete = () => resolve((tx as IDBTransaction & { resultCatalog?: CachedCatalog | null }).resultCatalog ?? null);
      tx.onerror = () => reject(tx.error ?? new Error('Could not read saved catalog.'));
      tx.onabort = () => reject(tx.error ?? new Error('Catalog read was interrupted.'));
    });
  } finally { db.close(); }
}

function mergeDataset(previous: CachedCatalog | undefined, incoming: CachedCatalog, dataset: CatalogDataset): CachedCatalog {
  const next: CachedCatalog = { ...(previous ?? incoming), key: incoming.key, savedAt: Date.now(),
    sourceType: incoming.sourceType ?? previous?.sourceType,
    playbackBase: incoming.playbackBase ?? previous?.playbackBase,
    allowedFormats: incoming.allowedFormats ?? previous?.allowedFormats,
    liveFormat: incoming.liveFormat ?? previous?.liveFormat };
  // Each catalog is refreshed independently; omitted or empty response data
  // never replaces previously valid data.
  if (dataset === 'live' && incoming.channels.length > 0) {
    next.categories = incoming.categories;
    next.channels = incoming.channels;
  } else if (dataset === 'movies' && (incoming.movies?.length ?? 0) > 0) {
    next.movieCategories = incoming.movieCategories ?? previous?.movieCategories ?? [];
    next.movies = incoming.movies ?? [];
  } else if (dataset === 'series' && (incoming.series?.length ?? 0) > 0) {
    next.seriesCategories = incoming.seriesCategories ?? previous?.seriesCategories ?? [];
    next.series = incoming.series ?? [];
  }
  next.syncState = { ...(previous?.syncState ?? {}), ...(incoming.syncState ?? {}) };
  return next;
}

export async function writeCatalog(catalog: CachedCatalog, datasets: CatalogDataset[] = ['live', 'movies', 'series']): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([CATALOGS, PROVIDERS, SYNC], 'readwrite');
      const catalogStore = tx.objectStore(CATALOGS);
      const previousRequest = catalogStore.get(catalog.key);
      previousRequest.onsuccess = () => {
        const previous = previousRequest.result as CachedCatalog | undefined;
        let next = previous ?? { ...catalog, categories: [], channels: [], movieCategories: [], movies: [], seriesCategories: [], series: [] };
        datasets.forEach((dataset) => {
          const datasetHasData = dataset === 'live' ? catalog.channels.length > 0
            : dataset === 'movies' ? (catalog.movies?.length ?? 0) > 0 : (catalog.series?.length ?? 0) > 0;
          if (!datasetHasData) return;
          next = mergeDataset(next, catalog, dataset);
          const oldState = previous?.syncState?.[dataset] ?? {};
          const state: CatalogSyncState = { ...oldState, lastAttemptAt: Date.now(), lastSuccessAt: Date.now(), lastError: undefined, retryCount: 0 };
          next.syncState = { ...(next.syncState ?? {}), [dataset]: state };
          tx.objectStore(SYNC).put({ key: `${catalog.key}|${dataset}`, providerId: catalog.key, dataset, state });
        });
        // Preserve provider metadata even when a catalog endpoint returns empty.
        next = { ...next, sourceType: catalog.sourceType ?? next.sourceType, playbackBase: catalog.playbackBase ?? next.playbackBase,
          allowedFormats: catalog.allowedFormats ?? next.allowedFormats, liveFormat: catalog.liveFormat ?? next.liveFormat,
          savedAt: Date.now() };
        catalogStore.put(next);
        tx.objectStore(PROVIDERS).put({ key: catalog.key, providerId: catalog.key, sourceType: next.sourceType,
          playbackBase: next.playbackBase, allowedFormats: next.allowedFormats, liveFormat: next.liveFormat, updatedAt: Date.now() });
      };
      previousRequest.onerror = () => reject(previousRequest.error ?? new Error('Could not update saved catalog.'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not save catalog.'));
      tx.onabort = () => reject(tx.error ?? new Error('Catalog transaction was interrupted.'));
    });
  } finally { db.close(); }
}

export async function getCatalogSyncState(key: string): Promise<Partial<Record<CatalogDataset, CatalogSyncState>>> {
  return (await readCatalog(key))?.syncState ?? {};
}

export async function markCatalogSyncAttempt(key: string, dataset: CatalogDataset, error?: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([SYNC, CATALOGS], 'readwrite');
      const store = tx.objectStore(SYNC);
      const id = `${key}|${dataset}`;
      const request = store.get(id);
      request.onsuccess = () => {
        const prior = request.result as { state?: CatalogSyncState } | undefined;
        const state: CatalogSyncState = { ...(prior?.state ?? {}), lastAttemptAt: Date.now(),
          ...(error ? { lastError: error.slice(0, 240), retryCount: (prior?.state?.retryCount ?? 0) + 1 } : {}) };
        store.put({ key: id, providerId: key, dataset, state });
        const catalogRequest = tx.objectStore(CATALOGS).get(key);
        catalogRequest.onsuccess = () => {
          const catalog = catalogRequest.result as CachedCatalog | undefined;
          if (catalog) {
            catalog.syncState = { ...(catalog.syncState ?? {}), [dataset]: state };
            tx.objectStore(CATALOGS).put(catalog);
          }
        };
      };
      request.onerror = () => reject(request.error ?? new Error('Could not update sync status.'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not update sync status.'));
      tx.onabort = () => reject(tx.error ?? new Error('Sync status transaction was interrupted.'));
    });
  } finally { db.close(); }
}

export async function readSeriesEpisodes(providerId: string, seriesId: string | number): Promise<SeriesEpisode[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(EPISODES, 'readonly');
      const request = tx.objectStore(EPISODES).index('providerSeries').get([providerId, String(seriesId)]);
      request.onsuccess = () => resolve((request.result as { episodes?: SeriesEpisode[] } | undefined)?.episodes ?? []);
      request.onerror = () => reject(request.error ?? new Error('Could not read saved episodes.'));
      tx.onabort = () => reject(tx.error ?? new Error('Episode read was interrupted.'));
    });
  } finally { db.close(); }
}

export async function writeSeriesEpisodes(providerId: string, seriesId: string | number, episodes: SeriesEpisode[]): Promise<void> {
  if (!episodes.length) return;
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(EPISODES, 'readwrite');
      tx.objectStore(EPISODES).put({ key: `${providerId}|${seriesId}`, providerId, seriesId: String(seriesId), episodes, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not save episodes.'));
      tx.onabort = () => reject(tx.error ?? new Error('Episode save was interrupted.'));
    });
  } finally { db.close(); }
}

export async function readDatabaseSetting(key: string): Promise<unknown | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS, 'readonly');
      const request = tx.objectStore(SETTINGS).get(key);
      request.onsuccess = () => resolve((request.result as { value?: unknown } | undefined)?.value ?? null);
      request.onerror = () => reject(request.error ?? new Error('Could not read persistent app data.'));
    });
  } finally { db.close(); }
}

export async function writeDatabaseSetting(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SETTINGS, 'readwrite');
      tx.objectStore(SETTINGS).put({ key, value, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not save persistent app data.'));
      tx.onabort = () => reject(tx.error ?? new Error('App data transaction was interrupted.'));
    });
  } finally { db.close(); }
}

export async function getRebuildableCacheCounts(): Promise<{ catalogs: number }> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(CATALOGS, 'readonly');
      const request = tx.objectStore(CATALOGS).count();
      request.onsuccess = () => resolve({ catalogs: request.result });
      request.onerror = () => reject(request.error ?? new Error('Could not inspect catalog database.'));
    });
  } finally { db.close(); }
}

export async function pruneRebuildableCaches(): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([CATALOGS, EPISODES], 'readwrite');
      const request = tx.objectStore(CATALOGS).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const value = cursor.value as CachedCatalog;
          if (Date.now() - value.savedAt > 90 * 24 * 60 * 60 * 1000) cursor.delete();
          cursor.continue();
        }
      };
      const episodeCursor = tx.objectStore(EPISODES).openCursor();
      episodeCursor.onsuccess = () => {
        const cursor = episodeCursor.result;
        if (cursor) {
          const value = cursor.value as { savedAt?: number };
          if (!value.savedAt || Date.now() - value.savedAt > 180 * 24 * 60 * 60 * 1000) cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not prune old catalog snapshots.'));
      tx.onabort = () => reject(tx.error ?? new Error('Catalog pruning was interrupted.'));
    });
  } finally { db.close(); }
}

export async function clearRebuildableCaches(): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([CATALOGS, EPISODES, SYNC, PROVIDERS], 'readwrite');
      [CATALOGS, EPISODES, SYNC, PROVIDERS].forEach((name) => tx.objectStore(name).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not clear cached catalog data.'));
      tx.onabort = () => reject(tx.error ?? new Error('Catalog cleanup was interrupted.'));
    });
  } finally { db.close(); }
}
