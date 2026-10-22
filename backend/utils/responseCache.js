import crypto from 'crypto';

// Product and service rows carry their images as base64 (~110KB each), so one storefront page is
// a few megabytes pulled from Supabase, parsed, and serialized again. When a crowd opens the same
// page together, doing that per request multiplies the memory (Render's free instance has 512MB)
// and the database egress by the number of people. This keeps each public catalog response as one
// ready-to-send buffer for a short while, and requests that arrive while it's being built wait on
// that same build instead of starting their own.
//
// Only for public, identical-for-everyone GETs. Staff edits clear it (server.js), so a change shows
// up on the next load; anything else that drifts (stock after an order, a new review's rating) is
// at most TTL_MS stale, and checkout re-reads stock from the database regardless.

const TTL_MS = 30 * 1000;
const MAX_BYTES = 40 * 1024 * 1024;
const MAX_ENTRY_BYTES = 12 * 1024 * 1024;

const entries = new Map(); // key -> { status, body, etag, expires }; Map order = oldest first
const building = new Map(); // key -> Promise of the entry being built
let totalBytes = 0;
// Bumped by clearResponseCache, so a build that started before a staff edit doesn't get stored.
let generation = 0;

function remove(key) {
  const entry = entries.get(key);
  if (!entry) return;
  totalBytes -= entry.body.length;
  entries.delete(key);
}

function store(key, entry) {
  remove(key);
  if (entry.body.length > MAX_ENTRY_BYTES) return;
  // Oldest first, since a re-store above moved its key to the end.
  for (const k of entries.keys()) {
    if (totalBytes + entry.body.length <= MAX_BYTES) break;
    remove(k);
  }
  entries.set(key, entry);
  totalBytes += entry.body.length;
}

async function build(handler, req) {
  const { status = 200, json } = await handler(req);
  const body = Buffer.from(JSON.stringify(json));
  // Express would hash the body for its ETag on every send; doing it once here lets each request
  // skip that, and a browser revalidating an unchanged page still gets a bodyless 304.
  const etag = `W/"${crypto.createHash('sha1').update(body).digest('base64')}"`;
  return { status, body, etag, expires: Date.now() + TTL_MS };
}

// Wraps a route whose handler returns { status?, json } instead of writing to res.
export function cachedJson(handler) {
  return async (req, res) => {
    const key = req.originalUrl;
    let entry = entries.get(key);
    if (!entry || entry.expires <= Date.now()) {
      let pending = building.get(key);
      if (!pending) {
        const startedAt = generation;
        pending = build(handler, req)
          .then((built) => {
            if (startedAt === generation) store(key, built);
            return built;
          })
          .finally(() => {
            if (building.get(key) === pending) building.delete(key);
          });
        building.set(key, pending);
      }
      entry = await pending;
    }
    res.status(entry.status).set('ETag', entry.etag).type('application/json').send(entry.body);
  };
}

export function clearResponseCache() {
  generation++;
  entries.clear();
  // Builds already running read the database before the edit; requests from here on start fresh.
  building.clear();
  totalBytes = 0;
}
