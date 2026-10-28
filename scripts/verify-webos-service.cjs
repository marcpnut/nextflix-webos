const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const url = require('node:url');
const querystring = require('node:querystring');

let serviceInstance;
let currentBody = '{"user_info":{"auth":1,"status":"Active"}}';
let lastRequestOptions;

class MockService {
  constructor(id) {
    this.id = id;
    this.methods = {};
    serviceInstance = this;
  }

  register(name, callback) {
    this.methods[name] = callback;
  }
}

function mockTransport() {
  return {
    request(options, onResponse) {
      lastRequestOptions = options;
      const request = new EventEmitter();
      request.setTimeout = () => {};
      request.abort = () => {};
      request.end = () => {
        process.nextTick(() => {
          const response = new EventEmitter();
          response.statusCode = 200;
          response.headers = { 'content-type': 'application/json', server: 'nginx' };
          response.setEncoding = () => {};
          response.resume = () => {};
          onResponse(response);
          response.emit('data', currentBody);
          response.emit('end');
        });
      };
      return request;
    }
  };
}

const source = fs.readFileSync(path.join(__dirname, '..', 'webos-service', 'main.js'), 'utf8');
vm.runInNewContext(source, {
  require(name) {
    if (name === 'webos-service') return MockService;
    if (name === 'http' || name === 'https') return mockTransport();
    if (name === 'url') return url;
    if (name === 'querystring') return querystring;
    throw new Error(`Unexpected service dependency: ${name}`);
  },
  Buffer,
  Object,
  String,
  Number,
  Math,
  Date,
  isFinite,
  setTimeout: () => 0
}, { filename: 'webos-service/main.js' });

function invoke(method, sender, payload) {
  return new Promise((resolve) => {
    serviceInstance.methods[method]({ sender, payload, respond: resolve });
  });
}

async function main() {
  assert.equal(serviceInstance.id, 'com.nextflix.iptv.network');
  const request = await invoke('request', 'com.nextflix.iptv', {
    base: 'http://provider.example:8080/prefix/',
    username: 'user+name',
    password: 'p/ss word',
    action: 'get_live_streams',
    extra: { category_id: '17' },
    timeoutMs: 60000
  });
  assert.equal(request.returnValue, true);
  assert.equal(request.statusCode, 200);
  assert.deepEqual(JSON.parse(request.body), { user_info: { auth: 1, status: 'Active' } });
  assert.equal(lastRequestOptions.protocol, 'http:');
  assert.equal(lastRequestOptions.port, '8080');
  assert.equal(lastRequestOptions.path.startsWith('/prefix/player_api.php?'), true);
  assert.equal(lastRequestOptions.headers.Origin, undefined);
  const query = new URLSearchParams(lastRequestOptions.path.split('?')[1]);
  assert.equal(query.get('username'), 'user+name');
  assert.equal(query.get('password'), 'p/ss word');
  assert.equal(query.get('category_id'), '17');

  const denied = await invoke('request', 'unrelated.app', { base: 'http://provider.example', username: 'x', password: 'y' });
  assert.equal(denied.returnValue, false);

  currentBody = `{"payload":"${'x'.repeat(500000)}"}`;
  const chunked = await invoke('request', 'com.nextflix.iptv', {
    base: 'http://provider.example', username: 'u', password: 'p', timeoutMs: 60000
  });
  assert.equal(chunked.chunked, true);
  let combined = '';
  for (let offset = 0; offset < chunked.bodyLength; offset += chunked.chunkSize) {
    const part = await invoke('readChunk', 'com.nextflix.iptv', { requestId: chunked.requestId, offset });
    assert.equal(part.returnValue, true);
    combined += part.chunk;
  }
  assert.equal(combined, currentBody);
  const released = await invoke('release', 'com.nextflix.iptv', { requestId: chunked.requestId });
  assert.equal(released.returnValue, true);
  const missing = await invoke('readChunk', 'com.nextflix.iptv', { requestId: chunked.requestId, offset: 0 });
  assert.equal(missing.returnValue, false);

  process.stdout.write('webOS service checks passed: no Origin header, encoded credentials, caller restriction, and chunk transfer.\n');
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
