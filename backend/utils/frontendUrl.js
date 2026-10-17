// Origins that should be redirected back to the mobile app itself after a PayMongo
// hosted-checkout redirect (see routes/payments.js and routes/bookings.js), instead of
// always landing on the React web frontend. Same "who else talks to this backend" list
// server.js uses for CORS -- kept here so both stay in sync.
export const MOBILE_ORIGINS = [
  'https://homelink-mobile-app.vercel.app',
  'http://localhost:4200',
  'https://localhost',
  'http://localhost',
];

// The packaged APK's WebView serves the app from these origins. They only exist inside the
// app: PayMongo's page opens in the phone's browser (a Chrome Custom Tab), where
// https://localhost is nothing at all, so a redirect there strands the customer on an error
// page. Those customers go to /api/app-return instead (routes/appReturn.js), which hands the
// redirect back to the app through its com.homelink.mobile:// link.
const NATIVE_APP_ORIGINS = ['https://localhost', 'http://localhost', 'capacitor://localhost'];

// The Capacitor-packaged native app's WebView frequently sends no usable Origin header (or
// omits it) on cross-origin requests, so it can't be identified by MOBILE_ORIGINS alone --
// unlike Origin, this header is set by our own code (mobile/src/app/core/api.service.ts) on
// every request, so it's a reliable signal regardless of platform quirks. The APK sends its
// platform ('android'/'ios'); the mobile web build sends 'mobile'. When it's 'mobile' but
// Origin didn't match anything, land the PayMongo redirect on the deployed mobile web build
// rather than the public website -- it's a real, reachable page that looks like the app
// (same branding, its own /checkout/return + /bookings/return), not just a placeholder.
const MOBILE_CLIENT_HEADER = 'x-homelink-client';
const NATIVE_CLIENTS = ['android', 'ios'];
const MOBILE_FALLBACK_ORIGIN = 'https://homelink-mobile-app.vercel.app';

/** This API's own public base URL (…/api), as the customer's browser reaches it. */
function publicApiUrl(req) {
  if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL.replace(/\/$/, '');
  const proto = (req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
  const host = (req.get('x-forwarded-host') || req.get('host')).split(',')[0].trim();
  return `${proto}://${host}/api`;
}

/**
 * PayMongo's hosted checkout only takes one successUrl/cancelUrl per session, so we have to
 * pick a frontend up front when creating it. A request from the installed APK gets the
 * /api/app-return bounce page, which reopens the app. Otherwise the Origin header the browser
 * sends on the checkout-session POST tells us which app the customer is actually paying
 * from -- if it's one of the mobile app's known origins, send them back there. Otherwise, if
 * the request is flagged as coming from the mobile app, fall back to the mobile web origin
 * instead of the public website. Only a request that's none of these -- the React web app, or
 * any other caller -- falls back to FRONTEND_URL exactly as before.
 */
export function resolveFrontendUrl(req) {
  const origin = req.get('origin');
  const client = (req.get(MOBILE_CLIENT_HEADER) || '').toLowerCase();
  if (NATIVE_CLIENTS.includes(client) || NATIVE_APP_ORIGINS.includes(origin)) return `${publicApiUrl(req)}/app-return`;
  if (origin && MOBILE_ORIGINS.includes(origin)) return origin;
  if (client) return MOBILE_FALLBACK_ORIGIN;
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}
