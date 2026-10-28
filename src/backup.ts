const BACKUP_MAGIC = 'NEXTFLIX-ENCRYPTED-BACKUP';
const BACKUP_VERSION = 1;
const PBKDF2_ITERATIONS = 250_000;
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_BACKUP_FILE_BYTES = 14 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type BackupEnvelope = {
  magic: string;
  version: number;
  cipher: 'AES-GCM';
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

export type BackupPayload = {
  format: 'nextflix-settings';
  schemaVersion: 1;
  createdAt: string;
  values: Record<string, string>;
};

function requireCrypto(): SubtleCrypto {
  if (!window.crypto?.subtle || !window.crypto.getRandomValues) {
    throw new Error('Secure encryption is unavailable in this app environment. No backup was created.');
  }
  return window.crypto.subtle;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const subtle = requireCrypto();
  const material = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackup(payload: BackupPayload, password: string): Promise<Blob> {
  const subtle = requireCrypto();
  if (password.length < 8) throw new Error('Use a backup password with at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const plaintext = encoder.encode(JSON.stringify(payload));
  if (plaintext.byteLength > MAX_BACKUP_BYTES) throw new Error('The settings backup is larger than the 10 MB limit.');
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const envelope: BackupEnvelope = {
    magic: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    cipher: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted))
  };
  return new Blob([JSON.stringify(envelope)], { type: 'application/vnd.nextflix.backup+json' });
}

export async function decryptBackup(file: File, password: string): Promise<BackupPayload> {
  const subtle = requireCrypto();
  if (!password) throw new Error('Enter the password used to create this backup.');
  if (file.size <= 0 || file.size > MAX_BACKUP_FILE_BYTES) throw new Error('Choose a valid backup file under 14 MB.');

  let envelope: BackupEnvelope;
  try { envelope = JSON.parse(await file.text()) as BackupEnvelope; }
  catch { throw new Error('This file is not a readable NextFlix backup.'); }
  if (!envelope || envelope.magic !== BACKUP_MAGIC || envelope.version !== BACKUP_VERSION
    || envelope.cipher !== 'AES-GCM' || envelope.kdf !== 'PBKDF2-SHA-256'
    || envelope.iterations !== PBKDF2_ITERATIONS
    || typeof envelope.salt !== 'string' || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string') {
    throw new Error('This NextFlix backup format is not supported.');
  }

  try {
    const salt = fromBase64(envelope.salt);
    const iv = fromBase64(envelope.iv);
    const ciphertext = fromBase64(envelope.ciphertext);
    if (salt.byteLength !== 16 || iv.byteLength !== 12 || ciphertext.byteLength > MAX_BACKUP_BYTES + 16) {
      throw new Error('Invalid backup data.');
    }
    const key = await deriveKey(password, salt, envelope.iterations);
    const plaintext = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const payload = JSON.parse(decoder.decode(plaintext)) as BackupPayload;
    validatePayload(payload);
    return payload;
  } catch {
    throw new Error('Could not decrypt this backup. Check the password and try again.');
  }
}

function validatePayload(payload: BackupPayload): void {
  if (!payload || payload.format !== 'nextflix-settings' || payload.schemaVersion !== 1
    || !payload.values || typeof payload.values !== 'object' || Array.isArray(payload.values)) {
    throw new Error('Invalid backup contents.');
  }
  const entries = Object.entries(payload.values);
  if (entries.length > 2000) throw new Error('The backup contains too many settings.');
  let totalBytes = 0;
  for (const [key, value] of entries) {
    if (!key.startsWith('nextflix.') || typeof value !== 'string') throw new Error('The backup contains unsupported settings.');
    totalBytes += encoder.encode(key).byteLength + encoder.encode(value).byteLength;
    if (totalBytes > MAX_BACKUP_BYTES) throw new Error('The settings backup is larger than the 10 MB limit.');
  }
}
