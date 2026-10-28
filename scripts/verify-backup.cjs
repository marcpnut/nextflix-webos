const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

globalThis.crypto = webcrypto;
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'backup.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const backupModule = { exports: {} };
new Function('exports', 'require', compiled)(backupModule.exports, require);

(async () => {
  const { encryptBackup, decryptBackup } = backupModule.exports;
  const payload = {
    format: 'nextflix-settings', schemaVersion: 1, createdAt: '2026-01-01T00:00:00.000Z',
    values: { 'nextflix.profiles.v1': '[{"id":"default","name":"Default"}]', 'nextflix.xtream.provider.v1': '{"password":"test-secret"}' }
  };
  const password = 'local-test-password';
  const blob = await encryptBackup(payload, password);
  const serialized = await blob.text();
  assert.ok(!serialized.includes('test-secret'), 'Backup exposed the provider password.');
  const file = { size: blob.size, text: () => blob.text() };
  assert.deepEqual(await decryptBackup(file, password), payload);
  await assert.rejects(decryptBackup(file, 'wrong-password'), /decrypt/);
  process.stdout.write('Encrypted backup round trip and wrong-password rejection passed.\n');
})().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
