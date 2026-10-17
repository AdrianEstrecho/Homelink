import { Router } from 'express';

// Where PayMongo sends a customer who paid from the installed APK (see resolveFrontendUrl in
// utils/frontendUrl.js). PayMongo's page runs in the phone's browser, not in the app, so
// this page's only job is to open the app again at the matching screen through its
// com.homelink.mobile:// link (registered in mobile/android/app/src/main/AndroidManifest.xml).
// It doesn't confirm anything itself: the app asks /payments/status or /bookings/status once
// it's back, the same as the web return pages do.
const router = Router();

const APP_SCHEME = 'com.homelink.mobile';
const APP_PACKAGE = 'com.homelink.mobile';
// Used only if the app isn't installed on the phone that opened this link.
const WEB_FALLBACK = 'https://homelink-mobile-app.vercel.app';

// The only screens PayMongo is ever told to send a customer back to, and the query params
// those screens read.
const ALLOWED_PATHS = [/^checkout$/, /^checkout\/return$/, /^bookings\/return$/, /^services\/[a-z0-9-]+\/book$/i];
const ALLOWED_PARAMS = ['pcid', 'pbid', 'buy', 'qty'];

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

router.get(/^\/(.+)$/, (req, res) => {
  const path = req.params[0].replace(/\/+$/, '');
  if (!ALLOWED_PATHS.some((re) => re.test(path))) return res.status(404).send('Not found');

  const params = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    const value = req.query[key];
    if (typeof value === 'string' && value) params.set(key, value);
  }
  const query = params.toString() ? `?${params}` : '';
  const target = `${path}${query}`;

  const isReturn = path.endsWith('/return');
  const heading = isReturn ? 'Taking you back to HomeLink' : 'Payment cancelled';
  const body = isReturn
    ? "We're opening the HomeLink app so it can confirm your payment."
    : "Nothing was charged. We're opening the HomeLink app so you can try again.";

  const appUrl = `${APP_SCHEME}://${target}`;
  // Android's Chrome only hands off to an app through an intent:// URL; the browser_fallback_url
  // keeps a phone without the app on a working page instead of the Play Store.
  const intentUrl = `intent://${target}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};`
    + `S.browser_fallback_url=${encodeURIComponent(`${WEB_FALLBACK}/${target}`)};end`;
  const isAndroid = /android/i.test(req.get('user-agent') || '');
  const openUrl = isAndroid ? intentUrl : appUrl;

  res.set('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>HomeLink</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0f2b5b; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #14181f; }
  .card { margin: 16px; max-width: 360px; width: 100%; background: #fff; border-radius: 20px; padding: 28px 24px;
    text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,.25); }
  .mark { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 16px; background: #ff6b35;
    display: flex; align-items: center; justify-content: center; }
  h1 { margin: 0 0 8px; font-size: 20px; color: #0f2b5b; }
  p { margin: 0 0 22px; font-size: 15px; line-height: 1.5; color: #4b5563; }
  a.btn { display: block; padding: 14px 16px; border-radius: 12px; background: #ff6b35; color: #fff;
    font-weight: 600; font-size: 16px; text-decoration: none; }
  a.btn:active { background: #e85a26; }
  small { display: block; margin-top: 14px; font-size: 12px; color: #9ca3af; }
</style>
</head>
<body>
<main class="card">
  <div class="mark" aria-hidden="true">
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>
  </div>
  <h1>${escapeHtml(heading)}</h1>
  <p>${escapeHtml(body)}</p>
  <a class="btn" id="open" href="${escapeHtml(openUrl)}">Open the HomeLink app</a>
  <small>If nothing happens, tap the button above.</small>
</main>
<script>
  // Chrome may ignore an app hand-off that no tap started, which is why the button stays.
  setTimeout(function () { window.location.href = ${JSON.stringify(openUrl).replace(/</g, '\\u003c')}; }, 50);
</script>
</body>
</html>`);
});

export default router;
