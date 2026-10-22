import { useSyncExternalStore } from 'react';

// Whether the HomeLink API can be reached, for ServiceStatusBanner. Every request in client.js
// reports here: how long it's taking, and whether it reached the server at all. The frontend is
// static on Vercel and keeps loading when the API on Render is asleep, restarting or down, so
// without this a customer just sees spinners that never finish and buttons that do nothing.

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

// A request still waiting after this long is flagged as slow. Render's free instance sleeps after
// 15 idle minutes and takes up to a minute to wake, which looks exactly like a hang.
const SLOW_AFTER_MS = 10_000;
const HEALTH_TIMEOUT_MS = 20_000;
const RETRY_EVERY_MS = 10_000;
const RECOVERED_FOR_MS = 4_000;

let state = {
  offline: typeof navigator !== 'undefined' && navigator.onLine === false,
  down: false,
  slow: false,
  recovered: false,
};
const listeners = new Set();
let slowCount = 0;
let checking = null;
let retryTimer = null;
let recoveredTimer = null;

function update(patch) {
  const next = { ...state, ...patch };
  if (Object.keys(next).every((k) => next[k] === state[k])) return;
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useServerStatus() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

// Call when a request starts; call the returned function once the server has answered (or the
// request has failed). Requests that are slow by nature (the AI assistant) pass expectSlow.
export function trackRequest({ expectSlow = false } = {}) {
  if (expectSlow) return () => {};
  let counted = false;
  const timer = setTimeout(() => {
    counted = true;
    slowCount++;
    update({ slow: true });
  }, SLOW_AFTER_MS);
  return () => {
    clearTimeout(timer);
    if (!counted) return;
    slowCount--;
    if (slowCount === 0) update({ slow: false });
  };
}

async function healthy() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: 'no-store', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function markUp() {
  clearTimeout(retryTimer);
  retryTimer = null;
  if (!state.down) return;
  update({ down: false, recovered: true });
  clearTimeout(recoveredTimer);
  recoveredTimer = setTimeout(() => update({ recovered: false }), RECOVERED_FOR_MS);
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => checkNow(), RETRY_EVERY_MS);
}

// Asks /health directly. Exported for the banner's "Try again" button.
export function checkNow() {
  if (checking) return checking;
  checking = healthy()
    .then((ok) => {
      if (ok) markUp();
      else {
        update({ down: true, recovered: false });
        if (!state.offline) scheduleRetry();
      }
      return ok;
    })
    .finally(() => { checking = null; });
  return checking;
}

// A request got an answer from the API, so it's up, whatever the answer said.
export function reportReachable() {
  if (state.down) markUp();
}

// A request never reached the API (network error, or a gateway error page instead of our JSON).
// One failure can be a blip on the customer's own connection, so /health gets asked before the
// banner says the site is down.
export function reportUnreachable() {
  if (state.offline || state.down) return;
  checkNow();
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => update({ offline: true }));
  window.addEventListener('online', () => {
    update({ offline: false });
    if (state.down) checkNow();
  });
}
