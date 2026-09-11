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

/**
 * PayMongo's hosted checkout only takes one successUrl/cancelUrl per session, so we have to
 * pick a frontend up front when creating it. The Origin header the browser sends on the
 * checkout-session POST tells us which app the customer is actually paying from -- if it's
 * one of the mobile app's known origins, send them back there; otherwise (the React web app,
 * or no Origin at all e.g. a native app's WebView not sending one) fall back to FRONTEND_URL
 * exactly as before.
 */
export function resolveFrontendUrl(req) {
  const origin = req.get('origin');
  if (origin && MOBILE_ORIGINS.includes(origin)) return origin;
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}
