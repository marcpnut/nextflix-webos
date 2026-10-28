const DATABASE = 'nextflix-provider-settings';
const STORE = 'settings';
const VERSION = 1;
const PROVIDER_KEY = 'xtream-provider';

async function readSetting(key: string): Promise<unknown | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error('Could not read the saved TV setting.'));
    });
  } finally {
    database.close();
  }
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the TV setting.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving the TV setting was interrupted.'));
    });
  } finally {
    database.close();
  }
}

async function removeSetting(key: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove the TV setting.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Removing the TV setting was interrupted.'));
    });
  } finally {
    database.close();
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is unavailable on this TV.'));
      return;
    }
    const request = window.indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open TV login storage.'));
    request.onblocked = () => reject(new Error('TV login storage is busy.'));
  });
}

export async function readProviderRecord(): Promise<unknown | null> {
  return readSetting(PROVIDER_KEY);
}

export async function writeProviderRecord(value: unknown): Promise<void> {
  return writeSetting(PROVIDER_KEY, value);
}

export async function removeProviderRecord(): Promise<void> {
  return removeSetting(PROVIDER_KEY);
}

export async function readAppSetting(key: string): Promise<unknown | null> {
  return readSetting(`app:${key}`);
}

export async function writeAppSetting(key: string, value: unknown): Promise<void> {
  return writeSetting(`app:${key}`, value);
}

export async function removeAppSetting(key: string): Promise<void> {
  return removeSetting(`app:${key}`);
}
