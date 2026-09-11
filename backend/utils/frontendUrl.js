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

// The Capacitor-packaged native app's WebView frequently sends no usable Origin header (or
// omits it) on cross-origin requests, so it can't be identified by MOBILE_ORIGINS alone --
// unlike Origin, this header is set by our own code (mobile/src/app/core/api.service.ts) on
// every request, so it's a reliable signal regardless of platform quirks. When it's present
// but Origin didn't match anything, land the PayMongo redirect on the deployed mobile web
// build rather than the public website -- it's a real, reachable page that looks like the
// app (same branding, its own /checkout/return + /bookings/return), not just a placeholder.
const MOBILE_CLIENT_HEADER = 'x-homelink-client';
const MOBILE_FALLBACK_ORIGIN = 'https://homelink-mobile-app.vercel.app';

/**
 * PayMongo's hosted checkout only takes one successUrl/cancelUrl per session, so we have to
 * pick a frontend up front when creating it. The Origin header the browser sends on the
 * checkout-session POST tells us which app the customer is actually paying from -- if it's
 * one of the mobile app's known origins, send them back there. Otherwise, if the request is
 * flagged as coming from the mobile app (native WebView requests often don't send a usable
 * Origin at all), fall back to the mobile web origin instead of the public website. Only a
 * request that's neither -- the React web app, or any other caller -- falls back to
 * FRONTEND_URL exactly as before.
 */
export function resolveFrontendUrl(req) {
  const origin = req.get('origin');
  if (origin && MOBILE_ORIGINS.includes(origin)) return origin;
  if (req.get(MOBILE_CLIENT_HEADER)) return MOBILE_FALLBACK_ORIGIN;
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}
