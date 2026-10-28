const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { indexedDB } = require('fake-indexeddb');

global.window = { indexedDB };
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'providerStorage.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const storage = { exports: {} };
new Function('exports', 'require', js)(storage.exports, require);

(async () => {
  const record = { base: 'http://provider.example:8080', username: 'test-user', password: 'test-password', format: 'auto', kind: 'xtream' };
  await storage.exports.writeProviderRecord(record);
  assert.deepEqual(await storage.exports.readProviderRecord(), record, 'provider login survives IndexedDB connection close/reopen');
  await storage.exports.writeAppSetting('metadata-api-keys', { tmdb: 'sample-key', opensubtitles: '' });
  assert.deepEqual(await storage.exports.readAppSetting('metadata-api-keys'), { tmdb: 'sample-key', opensubtitles: '' });
  await storage.exports.removeAppSetting('metadata-api-keys');
  assert.equal(await storage.exports.readAppSetting('metadata-api-keys'), null);
  process.stdout.write('Provider storage checks passed: credentials and API settings persist across database reopen; settings removal is isolated.\n');
})().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
