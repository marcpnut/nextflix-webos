const DATABASE = 'nextflix-provider-settings';
const STORE = 'settings';
const VERSION = 1;
const PROVIDER_KEY = 'xtream-provider';

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
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(PROVIDER_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error('Could not read the saved TV login.'));
    });
  } finally {
    database.close();
  }
}

export async function writeProviderRecord(value: unknown): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(value, PROVIDER_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the TV login.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving the TV login was interrupted.'));
    });
  } finally {
    database.close();
  }
}

export async function removeProviderRecord(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(PROVIDER_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove the saved TV login.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Removing the saved TV login was interrupted.'));
    });
  } finally {
    database.close();
  }
}
