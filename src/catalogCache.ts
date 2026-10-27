export type CatalogCategory = { category_id?: string | number; category_name?: string };
export type CatalogChannel = {
  num?: number | string;
  name?: string;
  stream_id: number | string;
  stream_url?: string;
  stream_icon?: string;
  category_id?: string | number;
  epg_channel_id?: string;
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
const DATABASE_VERSION = 1;

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
