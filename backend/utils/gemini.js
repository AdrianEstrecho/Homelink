const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Tried in order. Free-tier quotas are per model (as low as 20 requests a day) and the newest
// Flash models regularly answer "high demand" at peak, so the assistant keeps every free Flash
// model in line rather than going dark when one runs out — on a key without billing, a spent
// quota is just refused, never charged. GEMINI_MODEL overrides the list (comma-separated, e.g.
// "gemini-3.8-flash,gemini-3.5-flash-lite").
const DEFAULT_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];
// Overloaded, rate-limited, or a server-side failure: worth moving on to the next model for.
const RETRYABLE_STATUSES = new Set([429, 500, 503, 504]);
const TIMEOUT_MS = 25_000;
const DEFAULT_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 60 * 60 * 1000;

// Model -> time until which it's skipped. A spent daily quota answers 429 instantly for hours, so
// remembering Google's "retry in ..." spares every later message that wasted round trip.
const cooldowns = new Map();

export function isGeminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

export function isRetryable(err) {
  return RETRYABLE_STATUSES.has(err.status) || err.name === 'TimeoutError';
}

// The models worth trying right now, in order. If every one is cooling down, all of them are
// returned anyway — a stale cooldown shouldn't stop the assistant from trying at all.
export function availableModels() {
  const configured = (process.env.GEMINI_MODEL || '').split(',').map(m => m.trim()).filter(Boolean);
  const models = configured.length ? configured : DEFAULT_MODELS;
  const now = Date.now();
  const ready = models.filter(m => !(cooldowns.get(m) > now));
  return ready.length ? ready : models;
}

// Google's RetryInfo detail ("retryDelay": "43.2s") on a 429, when it sends one.
function retryDelayMs(error) {
  const info = error?.details?.find(d => d['@type']?.endsWith('RetryInfo'));
  const seconds = Number.parseFloat(info?.retryDelay);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

function coolDown(model, ms) {
  cooldowns.set(model, Date.now() + Math.min(ms ?? DEFAULT_COOLDOWN_MS, MAX_COOLDOWN_MS));
}

// One generateContent call against the Gemini REST API — plain fetch, like paymongo.js, rather
// than pulling in the SDK for a single endpoint. Stateless: the caller owns the conversation and
// passes the full `contents` history every time, including any model turns returned earlier
// (which must be sent back exactly as received so Gemini's thought signatures survive).
export async function generateContent(model, { systemInstruction, contents, tools, toolConfig }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  let res;
  try {
    res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        tools,
        toolConfig,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') coolDown(model);
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429 || res.status === 503) coolDown(model, retryDelayMs(data?.error));
    const err = new Error(data?.error?.message || `Gemini request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
