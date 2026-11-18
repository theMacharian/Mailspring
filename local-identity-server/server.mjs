#!/usr/bin/env node
/**
 * Local stand-in for Mailspring's identity server (id.getmailspring.com), covering sign-in,
 * the identity endpoint and plugin metadata storage. That is enough for Snooze, Send Later
 * and Follow-up reminders, whose timers fire inside the sync engine itself.
 *
 * The app talks to it when config.json has `"env": "development"`. The protocol mirrors what
 * app/src/flux/mailspring-api-request.ts and mailsync/MailSync (MetadataWorker, TaskProcessor,
 * NetworkRequestUtils) expect; README.md has setup steps.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 5101);
const here = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(here, 'data', 'local-identity.db');

// The client treats a quota of 0 as "no limit" (FeatureUsageStore.isUsable).
const QUOTA = Number(process.env.FEATURE_QUOTA || 0);
const FEATURES = [
  'snooze',
  'send-later',
  'send-reminders',
  'thread-sharing',
  'link-tracking',
  'open-tracking',
  'contact-profiles',
  'translation',
  'grammar-check',
];

// The streaming client drops the connection after 30s below 1 byte/sec
// (MetadataWorker::fetchDeltasBlocking), so a heartbeat newline must go out well inside that.
const HEARTBEAT_MS = 10_000;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS identities (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS metadata (
    identity_id TEXT NOT NULL,
    aid TEXT NOT NULL,
    object_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    object_type TEXT NOT NULL,
    v INTEGER NOT NULL,
    value TEXT NOT NULL,
    header_message_id TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (identity_id, aid, object_id, plugin_id)
  );
  CREATE TABLE IF NOT EXISTS deltas (
    cursor INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_id TEXT NOT NULL,
    aid TEXT NOT NULL,
    attributes TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS deltas_by_account ON deltas (identity_id, aid, cursor);
  CREATE TABLE IF NOT EXISTS feature_usage (
    identity_id TEXT NOT NULL,
    feature TEXT NOT NULL,
    period TEXT NOT NULL,
    used INTEGER NOT NULL,
    PRIMARY KEY (identity_id, feature, period)
  );
`);

const q = {
  identityByToken: db.prepare('SELECT * FROM identities WHERE token = ?'),
  identityByEmail: db.prepare('SELECT * FROM identities WHERE email = ?'),
  insertIdentity: db.prepare(
    'INSERT INTO identities (id, token, first_name, last_name, email, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  updateIdentityName: db.prepare('UPDATE identities SET first_name = ?, last_name = ? WHERE id = ?'),
  metadataPage: db.prepare(
    'SELECT * FROM metadata WHERE identity_id = ? AND aid = ? ORDER BY object_id, plugin_id LIMIT ? OFFSET ?'
  ),
  metadataOne: db.prepare(
    'SELECT * FROM metadata WHERE identity_id = ? AND aid = ? AND object_id = ? AND plugin_id = ?'
  ),
  upsertMetadata: db.prepare(`
    INSERT INTO metadata (identity_id, aid, object_id, plugin_id, object_type, v, value, header_message_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (identity_id, aid, object_id, plugin_id) DO UPDATE SET
      object_type = excluded.object_type, v = excluded.v, value = excluded.value,
      header_message_id = COALESCE(excluded.header_message_id, metadata.header_message_id),
      updated_at = excluded.updated_at
  `),
  appendDelta: db.prepare('INSERT INTO deltas (identity_id, aid, attributes) VALUES (?, ?, ?)'),
  headCursor: db.prepare('SELECT COALESCE(MAX(cursor), 0) AS cursor FROM deltas'),
  deltasSince: db.prepare(
    'SELECT cursor, attributes FROM deltas WHERE identity_id = ? AND aid = ? AND cursor > ? ORDER BY cursor'
  ),
  usageForPeriod: db.prepare('SELECT feature, used FROM feature_usage WHERE identity_id = ? AND period = ?'),
  bumpUsage: db.prepare(`
    INSERT INTO feature_usage (identity_id, feature, period, used) VALUES (?, ?, ?, 1)
    ON CONFLICT (identity_id, feature, period) DO UPDATE SET used = used + 1
  `),
};

// The sync engine parses createdAt with exactly "%Y-%m-%dT%H:%M:%S.000Z" (Identity::createdAt).
const nowISO = () => new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
const currentPeriod = () => new Date().toISOString().slice(0, 7);

function identityJSON(row, { withToken = false } = {}) {
  const used = Object.fromEntries(
    q.usageForPeriod.all(row.id, currentPeriod()).map(r => [r.feature, r.used])
  );
  const featureUsage = Object.fromEntries(
    FEATURES.map(f => [
      f,
      { featureLimitName: 'local', period: 'monthly', usedInPeriod: used[f] || 0, quota: QUOTA },
    ])
  );
  return {
    object: 'identity',
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    emailAddress: row.email,
    createdAt: row.created_at,
    stripePlan: 'Basic',
    stripePlanEffective: 'Basic',
    featureUsage,
    ...(withToken ? { token: row.token } : {}),
  };
}

function metadataJSON(row) {
  return {
    object: 'metadata',
    aid: row.aid,
    object_type: row.object_type,
    object_id: row.object_id,
    plugin_id: row.plugin_id,
    v: row.v,
    value: JSON.parse(row.value),
    ...(row.header_message_id ? { header_message_id: row.header_message_id } : {}),
  };
}

// --- live delta streams, keyed by `${identityId}/${aid}` ---------------------------------
const streams = new Map();

function writeDelta(res, cursor, attributes) {
  // The engine stores the cursor with setDeltaCursor(string), so it must arrive as a string.
  res.write(`${JSON.stringify({ object: 'metadata', cursor: String(cursor), attributes })}\n`);
}

function publish(identityId, aid, cursor, attributes) {
  for (const res of streams.get(`${identityId}/${aid}`) || []) writeDelta(res, cursor, attributes);
}

// --- HTTP helpers -------------------------------------------------------------------------
function send(res, status, body, type = 'application/json') {
  const text = type === 'application/json' ? JSON.stringify(body) : body;
  res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function readJSON(req) {
  const text = await readBody(req);
  return text ? JSON.parse(text) : {};
}

function authenticate(req) {
  const m = /^Basic\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!m) return null;
  const token = Buffer.from(m[1], 'base64').toString('utf8').split(':')[0];
  return token ? q.identityByToken.get(token) : null;
}

const escapeHTML = s =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function page(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title)}</title>
<style>
  body{font:15px -apple-system,system-ui,sans-serif;color:#222;background:#fafafa;margin:0;display:flex;justify-content:center}
  main{max-width:420px;width:100%;padding:48px 24px}
  h1{font-size:22px;font-weight:600;margin:0 0 6px} p{color:#555;line-height:1.5}
  label{display:block;font-size:13px;margin:14px 0 4px;color:#444}
  input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:15px}
  button{margin-top:22px;width:100%;padding:10px;border:0;border-radius:6px;background:#1a73e8;color:#fff;font-size:15px}
</style></head><body><main>${body}</main></body></html>`;
}

function onboardingForm() {
  return page(
    'Local Mailspring ID',
    `<h1>Local Mailspring ID</h1>
<p>Signs you in to the local server on this computer. Nothing is sent to Mailspring.</p>
<form method="POST" action="/onboarding">
  <label for="firstName">First name</label><input id="firstName" name="firstName" required>
  <label for="lastName">Last name</label><input id="lastName" name="lastName">
  <label for="email">Email</label><input id="email" name="email" type="email" required>
  <button type="submit">Sign in</button>
</form>`
  );
}

// --- routes -------------------------------------------------------------------------------
async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const method = req.method;

  if (method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });

  // Sign-in. The app's AuthenticatePage loads this in a webview and, after each load, reads
  // base64(JSON identity) from #identity-result.
  if (url.pathname === '/onboarding') {
    if (method === 'GET') return send(res, 200, onboardingForm(), 'text/html');
    if (method === 'POST') {
      const form = new URLSearchParams(await readBody(req));
      const email = (form.get('email') || '').trim().toLowerCase();
      const firstName = (form.get('firstName') || '').trim();
      const lastName = (form.get('lastName') || '').trim();
      if (!email || !firstName) return send(res, 400, onboardingForm(), 'text/html');

      let row = q.identityByEmail.get(email);
      if (row) {
        q.updateIdentityName.run(firstName, lastName, row.id);
      } else {
        q.insertIdentity.run(
          crypto.randomUUID(),
          crypto.randomBytes(32).toString('hex'),
          firstName,
          lastName,
          email,
          nowISO()
        );
      }
      row = q.identityByEmail.get(email);
      const result = Buffer.from(JSON.stringify(identityJSON(row, { withToken: true }))).toString('base64');
      return send(
        res,
        200,
        page(
          'Signed in',
          `<h1>Signed in</h1><p>Signed in as ${escapeHTML(email)} on the local server.</p>
<div id="identity-result" style="display:none">${result}</div>`
        ),
        'text/html'
      );
    }
  }

  // Calendar/contacts discovery. Called without auth; an empty object means "no known hosts"
  // and the sync engine falls back to its own discovery (DAVWorker.cpp).
  if (method === 'POST' && url.pathname === '/api/resolve-dav-hosts') return send(res, 200, {});

  const identity = authenticate(req);
  if (!identity) return send(res, 401, { message: 'Unknown or missing token' });

  if (method === 'GET' && url.pathname === '/api/me') return send(res, 200, identityJSON(identity));

  // Single sign-on links into the billing site. There is no billing site locally, so hand back
  // the requested path unchanged.
  if (method === 'POST' && url.pathname === '/api/login-link') {
    const form = new URLSearchParams(await readBody(req));
    return send(res, 200, { path: form.get('next_path') || '/' });
  }

  if (method === 'POST' && url.pathname === '/api/feature_usage_event') {
    const { feature } = await readJSON(req);
    if (typeof feature !== 'string' || !feature) return send(res, 400, { message: 'feature is required' });
    q.bumpUsage.run(identity.id, feature, currentPeriod());
    return send(res, 200, identityJSON(identity).featureUsage[feature] || { feature });
  }

  // GET /metadata/:aid?limit=&offset=
  if (method === 'GET' && parts[0] === 'metadata' && parts.length === 2) {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 500, 1), 1000);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
    return send(res, 200, q.metadataPage.all(identity.id, parts[1], limit, offset).map(metadataJSON));
  }

  // POST /metadata/:aid/:objectId/:pluginId  {objectType, version, value, headerMessageId?}
  if (method === 'POST' && parts[0] === 'metadata' && parts.length === 4) {
    const [, aid, objectId, pluginId] = parts;
    const body = await readJSON(req);
    const version = Number(body.version);
    if (typeof body.objectType !== 'string' || !Number.isInteger(version)) {
      return send(res, 400, { message: 'objectType and integer version are required' });
    }
    const existing = q.metadataOne.get(identity.id, aid, objectId, pluginId);
    if (existing && existing.v > version) {
      // A newer write already landed; the engine resolves by version, so report the winner.
      return send(res, 200, metadataJSON(existing));
    }
    q.upsertMetadata.run(
      identity.id,
      aid,
      objectId,
      pluginId,
      body.objectType,
      version,
      JSON.stringify(body.value ?? null),
      typeof body.headerMessageId === 'string' ? body.headerMessageId : null,
      nowISO()
    );
    const attributes = metadataJSON(q.metadataOne.get(identity.id, aid, objectId, pluginId));
    const { lastInsertRowid } = q.appendDelta.run(identity.id, aid, JSON.stringify(attributes));
    publish(identity.id, aid, Number(lastInsertRowid), attributes);
    return send(res, 200, attributes);
  }

  // GET /deltas/:aid/head
  if (method === 'GET' && parts[0] === 'deltas' && parts[2] === 'head' && parts.length === 3) {
    return send(res, 200, { cursor: String(q.headCursor.get().cursor) });
  }

  // GET /deltas/:aid/streaming?cursor=&p=&ih=  — newline-delimited JSON, held open.
  if (method === 'GET' && parts[0] === 'deltas' && parts[2] === 'streaming' && parts.length === 3) {
    const aid = parts[1];
    // The engine keeps its cursor across a change of server, so a cursor issued by another
    // server can be ahead of this log. Replay everything rather than skip it.
    const requested = Number(url.searchParams.get('cursor')) || 0;
    const since = requested > q.headCursor.get().cursor ? 0 : requested;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.flushHeaders();
    for (const row of q.deltasSince.all(identity.id, aid, since)) {
      writeDelta(res, row.cursor, JSON.parse(row.attributes));
    }
    const key = `${identity.id}/${aid}`;
    if (!streams.has(key)) streams.set(key, new Set());
    streams.get(key).add(res);
    const beat = setInterval(() => res.write('\n'.repeat(16)), HEARTBEAT_MS);
    req.on('close', () => {
      clearInterval(beat);
      streams.get(key)?.delete(res);
    });
    return;
  }

  return send(res, 404, { message: `No route for ${method} ${url.pathname}` });
}

const server = http.createServer((req, res) => {
  const started = Date.now();
  res.on('finish', () => {
    if (!req.url.startsWith('/deltas/') || res.statusCode >= 400) {
      console.log(`${req.method} ${req.url.split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`);
    }
  });
  route(req, res).catch(err => {
    console.error(err);
    if (!res.headersSent) send(res, err instanceof SyntaxError ? 400 : 500, { message: err.message });
    else res.end();
  });
});

// Streams stay open indefinitely; Node's default request timeout would cut them at 5 minutes.
server.requestTimeout = 0;
server.listen(PORT, HOST, () => {
  console.log(`Local Mailspring identity server on http://${HOST}:${PORT}  (db: ${DB_PATH})`);
});
