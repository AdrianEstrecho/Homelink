import { API_BASE as API, trackRequest, reportReachable, reportUnreachable } from './serverStatus';

const UNREACHABLE_MESSAGE = "We can't reach HomeLink right now. Check your internet connection, then try again in a moment.";
const UNAVAILABLE_MESSAGE = 'HomeLink is temporarily unavailable. Please try again in a moment.';

function failure(message, code, data = {}) {
  const err = new Error(message);
  if (code) err.code = code;
  // The whole body, for errors that carry more than a message (e.g. wrong_portal's `portal`).
  err.data = data;
  return err;
}

async function request(path, options = {}, { expectSlow } = {}) {
  const token = localStorage.getItem('homelink_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const answered = trackRequest({ expectSlow });
  let res;
  try {
    res = await fetch(`${API}${path}`, { ...options, headers });
  } catch (err) {
    answered();
    if (err?.name === 'AbortError') throw err;
    // fetch only rejects when no response arrived at all: offline, DNS, the server not
    // answering, or a CORS-blocked error page. The browser's own wording ("Failed to fetch")
    // means nothing to a customer.
    reportUnreachable();
    throw failure(UNREACHABLE_MESSAGE, 'network');
  }
  answered();

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Every error the API itself sends is JSON. A 5xx that isn't came from whatever sits in
    // front of it (Render's proxy while the server restarts or is down), not from HomeLink.
    if (data === null && res.status >= 500) {
      reportUnreachable();
      throw failure(UNAVAILABLE_MESSAGE, 'unavailable');
    }
    reportReachable();
    const fallback = res.status >= 500 ? 'Something went wrong on our end. Please try again.' : 'Request failed';
    throw failure(data?.error || fallback, data?.code, data ?? {});
  }
  reportReachable();
  return data ?? {};
}

// opts.expectSlow: for requests that are slow by nature (the AI assistant), so they don't
// trigger the "taking longer than usual" banner.
export const api = {
  get: (path, opts) => request(path, {}, opts),
  post: (path, body, opts) => request(path, { method: 'POST', body: JSON.stringify(body) }, opts),
  put: (path, body, opts) => request(path, { method: 'PUT', body: JSON.stringify(body) }, opts),
  delete: (path, body, opts) => request(path, { method: 'DELETE', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, opts),
};

// The currency from Platform Settings. SiteSettingsContext sets these from the last visit's copy
// before the first render and again once /promos/storefront answers, so formatPrice can stay a
// plain function instead of every caller needing the settings hook.
let currency = { symbol: '₱', code: 'PHP' };
export function setCurrency({ symbol, code }) {
  currency = { symbol: symbol || '₱', code: code || 'PHP' };
}
export const currencySymbol = () => currency.symbol;
export const currencyCode = () => currency.code;

export function formatPrice(n) {
  return `${currency.symbol}${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`;
}

export function statusColor(status) {
  const map = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    returned: 'bg-orange-100 text-orange-800',
    refunded: 'bg-orange-100 text-orange-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    paid: 'bg-green-100 text-green-800',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
}
