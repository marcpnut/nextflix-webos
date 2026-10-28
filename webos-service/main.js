/* Keep this service ES5-compatible with the C9 webOS 4.10 runtime. */
var Service = require('webos-service');
var http = require('http');
var https = require('https');
var url = require('url');
var querystring = require('querystring');

var APP_ID = 'com.nextflix.iptv';
var SERVICE_ID = 'com.nextflix.iptv.network';
var CHUNK_SIZE = 192 * 1024;
var MAX_BODY_SIZE = 32 * 1024 * 1024;
var nextChunkId = 0;
var chunkStore = Object.create(null);
var service = new Service(SERVICE_ID);

function isAllowedCaller(message) {
  var sender = String(message.sender || '');
  return sender === APP_ID || sender.indexOf(APP_ID + ' ') === 0;
}

function respond(message, payload) {
  try { message.respond(payload); } catch (ignore) { /* Request was already cancelled. */ }
}

function fail(message, text) {
  respond(message, { returnValue: false, errorText: text });
}

function providerUrl(payload) {
  if (!payload || typeof payload.base !== 'string' || typeof payload.username !== 'string' || typeof payload.password !== 'string') {
    throw new Error('Invalid provider request.');
  }
  var parsed = url.parse(payload.base);
  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname || parsed.auth) {
    throw new Error('Enter a valid HTTP or HTTPS provider URL.');
  }
  if (parsed.search || parsed.hash) throw new Error('Provider URL must not contain query parameters or a fragment.');

  var query = {
    username: payload.username,
    password: payload.password
  };
  if (payload.action) query.action = String(payload.action);
  var extra = payload.extra && typeof payload.extra === 'object' ? payload.extra : {};
  Object.keys(extra).forEach(function (key) {
    if (key === 'username' || key === 'password' || key === 'action') return;
    if (typeof extra[key] === 'string') query[key] = extra[key];
  });

  var pathname = (parsed.pathname || '').replace(/\/+$/, '');
  return url.format({
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port || undefined,
    pathname: pathname + '/player_api.php',
    search: '?' + querystring.stringify(query)
  });
}

function sendProviderRequest(target, timeoutMs, redirectCount, callback) {
  var parsed = url.parse(target);
  var transport = parsed.protocol === 'https:' ? https : http;
  var completed = false;
  function finish(error, result) {
    if (completed) return;
    completed = true;
    callback(error, result);
  }
  var request = transport.request({
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port || undefined,
    path: (parsed.pathname || '/') + (parsed.search || ''),
    method: 'GET',
    headers: { Accept: '*/*' }
  }, function (response) {
    var status = Number(response.statusCode) || 0;
    var location = response.headers.location;
    if (status >= 300 && status < 400 && location) {
      if (redirectCount >= 5) {
        response.resume();
        finish(new Error('Too many provider redirects.'));
        return;
      }
      var nextTarget = url.resolve(target, location);
      var current = url.parse(target);
      var next = url.parse(nextTarget);
      response.resume();
      if ((next.protocol !== 'http:' && next.protocol !== 'https:') ||
          current.protocol !== next.protocol || current.hostname !== next.hostname || current.port !== next.port) {
        finish(new Error('Provider redirected to a different server; credentials were not forwarded.'));
        return;
      }
      sendProviderRequest(nextTarget, timeoutMs, redirectCount + 1, callback);
      return;
    }

    var chunks = [];
    var total = 0;
    response.setEncoding('utf8');
    response.on('data', function (chunk) {
      total += Buffer.byteLength(chunk, 'utf8');
      if (total > MAX_BODY_SIZE) {
        request.abort();
        finish(new Error('Provider response is too large.'));
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', function () {
      finish(null, {
        statusCode: status,
        contentType: String(response.headers['content-type'] || ''),
        server: String(response.headers.server || ''),
        body: chunks.join(''),
        responseOrigin: parsed.protocol + '//' + parsed.host
      });
    });
    response.on('error', function () { finish(new Error('Provider response failed.')); });
  });

  request.setTimeout(timeoutMs, function () { request.abort(); });
  request.on('error', function () { finish(new Error('Could not reach the provider. Check the URL, network, and TLS.')); });
  request.end();
}

function sendBody(message, result) {
  if (result.body.length <= CHUNK_SIZE) {
    respond(message, {
      returnValue: true,
      statusCode: result.statusCode,
      contentType: result.contentType,
      server: result.server,
      responseOrigin: result.responseOrigin,
      body: result.body
    });
    return;
  }

  var id = String(Date.now()) + '-' + String(++nextChunkId) + '-' + String(Math.floor(Math.random() * 1000000));
  chunkStore[id] = result;
  setTimeout(function () { delete chunkStore[id]; }, 120000);
  respond(message, {
    returnValue: true,
    statusCode: result.statusCode,
    contentType: result.contentType,
    server: result.server,
    responseOrigin: result.responseOrigin,
    chunked: true,
    requestId: id,
    bodyLength: result.body.length,
    chunkSize: CHUNK_SIZE
  });
}

service.register('request', function (message) {
  if (!isAllowedCaller(message)) return fail(message, 'Request is not permitted.');
  var payload = message.payload || {};
  var target;
  var timeoutMs = Math.max(1000, Math.min(Number(payload.timeoutMs) || 60000, 180000));
  try { target = providerUrl(payload); }
  catch (error) { return fail(message, error.message || 'Invalid provider request.'); }

  sendProviderRequest(target, timeoutMs, 0, function (error, result) {
    if (error) return fail(message, error.message || 'Provider request failed.');
    sendBody(message, result);
  });
});

service.register('readChunk', function (message) {
  if (!isAllowedCaller(message)) return fail(message, 'Request is not permitted.');
  var payload = message.payload || {};
  var stored = chunkStore[String(payload.requestId || '')];
  var offset = Number(payload.offset);
  if (!stored || !isFinite(offset) || offset < 0 || Math.floor(offset) !== offset || offset >= stored.body.length) {
    return fail(message, 'Provider response chunk is unavailable.');
  }
  respond(message, { returnValue: true, chunk: stored.body.slice(offset, offset + CHUNK_SIZE) });
});

service.register('release', function (message) {
  if (!isAllowedCaller(message)) return fail(message, 'Request is not permitted.');
  delete chunkStore[String((message.payload || {}).requestId || '')];
  respond(message, { returnValue: true });
});
