const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');

global.window = { indexedDB };
global.IDBKeyRange = IDBKeyRange;

function openLegacyCatalog() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('nextflix-catalog-cache', 3);
    request.onupgradeneeded = () => request.result.createObjectStore('catalogs', { keyPath: 'key' });
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('catalogs', 'readwrite');
      tx.objectStore('catalogs').put({
        key: 'provider-test', savedAt: Date.now() - 1000, sourceType: 'xtream',
        categories: [{ category_id: 1, category_name: 'Live' }],
        channels: [{ stream_id: 10, name: 'Channel 10', category_id: 1 }],
        movieCategories: [{ category_id: 2, category_name: 'Movies' }],
        movies: [{ stream_id: 20, name: 'Movie 20', category_id: 2 }],
        seriesCategories: [{ category_id: 3, category_name: 'Series' }],
        series: [{ series_id: 30, name: 'Series 30', category_id: 3 }]
      });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

async function main() {
  await openLegacyCatalog();
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'catalogCache.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const moduleExports = {};
  new Function('exports', 'require', js)(moduleExports, require);
  const cache = moduleExports;

  const migrated = await cache.readCatalog('provider-test');
  assert.equal(migrated.movies[0].name, 'Movie 20', 'migration retains the movie catalog');
  assert.equal(migrated.series[0].name, 'Series 30', 'migration retains the series catalog');
  assert.equal(migrated.channels[0].name, 'Channel 10', 'migration retains Live TV');

  await cache.writeCatalog({
    key: 'provider-test', savedAt: Date.now(), sourceType: 'xtream',
    categories: [{ category_id: 1, category_name: 'Live Updated' }], channels: [{ stream_id: 11, name: 'Channel 11', category_id: 1 }],
    movieCategories: [], movies: [], seriesCategories: [], series: []
  }, ['live']);
  let saved = await cache.readCatalog('provider-test');
  assert.equal(saved.channels[0].stream_id, 11);
  assert.equal(saved.movies[0].stream_id, 20, 'Live TV refresh does not overwrite Movies');
  assert.equal(saved.series[0].series_id, 30, 'Live TV refresh does not overwrite Series');

  await cache.writeCatalog({ key: 'provider-test', savedAt: Date.now(), categories: [], channels: [], movies: [], series: [] }, ['movies', 'series', 'live']);
  saved = await cache.readCatalog('provider-test');
  assert.equal(saved.channels[0].stream_id, 11, 'empty response cannot erase the last valid catalog');
  assert.equal(saved.movies[0].stream_id, 20);
  assert.equal(saved.series[0].series_id, 30);

  await cache.markCatalogSyncAttempt('provider-test', 'movies', 'offline test');
  assert.equal((await cache.readCatalog('provider-test')).syncState.movies.lastError, 'offline test');
  await cache.writeCatalog({ key: 'provider-test', savedAt: Date.now(), categories: [], channels: [], movieCategories: [{ category_id: 2 }], movies: [{ stream_id: 21, name: 'Movie 21' }] }, ['movies']);
  saved = await cache.readCatalog('provider-test');
  assert.equal(saved.movies[0].stream_id, 21);
  assert.equal(saved.syncState.movies.lastError, undefined, 'successful refresh clears the previous error');

  await cache.writeSeriesEpisodes('provider-test', 30, [{ id: 301, title: 'Episode 1', season: 1 }]);
  assert.equal((await cache.readSeriesEpisodes('provider-test', 30))[0].title, 'Episode 1');
  await cache.writeDatabaseSetting('test-setting', { keep: true });
  assert.deepEqual(await cache.readDatabaseSetting('test-setting'), { keep: true });
  assert.equal((await cache.getRebuildableCacheCounts()).catalogs, 1, 'snapshot key prevents duplicate provider rows');

  process.stdout.write('Catalog storage checks passed: v3 migration, independent catalogs, empty/failed refresh retention, sync state, episodes, settings, and provider deduplication.\n');
}

main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
