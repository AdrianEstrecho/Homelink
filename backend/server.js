import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Patches Express's router so a rejected promise in any `async (req, res) => {}` handler
// below is forwarded to the error middleware instead of becoming an unhandled rejection —
// which, on modern Node, crashes the whole process (taking down every route, not just the
// one that errored) rather than just failing the one request. Must load before the routers.
import 'express-async-errors';
import './db/database.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import serviceRoutes from './routes/services.js';
import orderRoutes from './routes/orders.js';
import returnRoutes from './routes/returns.js';
import bookingRoutes from './routes/bookings.js';
import promoRoutes from './routes/promos.js';
import adminRoutes from './routes/admin.js';
import employeeRoutes from './routes/employee.js';
import addressRoutes from './routes/addresses.js';
import geoRoutes from './routes/geo.js';
import paymentMethodRoutes from './routes/paymentMethods.js';
import reviewRoutes from './routes/reviews.js';
import supportRoutes from './routes/support.js';
import notificationRoutes from './routes/notifications.js';
import messageRoutes from './routes/messages.js';
import wishlistRoutes from './routes/wishlist.js';
import cartRoutes from './routes/cart.js';
import paymentRoutes, { paymongoWebhookHandler } from './routes/payments.js';
import assistantRoutes from './routes/assistant.js';
import appReturnRoutes from './routes/appReturn.js';
import db from './db/database.js';
import { MOBILE_ORIGINS } from './utils/frontendUrl.js';
import { reconcilePendingPayments } from './utils/paymentReconciliation.js';
import { cachedJson, clearResponseCache } from './utils/responseCache.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// The web frontend's origin, plus the Angular mobile app's dev server, its
// packaged Capacitor WebView origins (https://localhost is the Android default;
// http://localhost covers an androidScheme override), and its deployed web build
// on Vercel. Additive to the existing single-origin config -- doesn't change the
// web app's CORS behavior.
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  ...MOBILE_ORIGINS,
  ...(process.env.ADDITIONAL_CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
];
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Must precede express.json() — PayMongo webhook signature verification needs the exact raw
// bytes of the request body, which express.json() would otherwise parse away.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymongoWebhookHandler);

// Default limit is 100kb, which a base64-encoded product/gallery image (allowed up to 5MB
// client-side) blows through immediately — raise it so those uploads don't 413.
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', name: 'HomeLink API' }));

app.get('/api/announcements', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM announcements WHERE active = 1 ORDER BY created_at DESC').all());
});

app.get('/api/gallery', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM gallery ORDER BY sort_order').all());
});

app.get('/api/faqs', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM faqs WHERE active = 1 ORDER BY sort_order').all());
});

app.get('/api/policies', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM policies WHERE active = 1 ORDER BY sort_order').all());
});

// A homeowner "served" is a customer with at least one order or booking that went through (not
// cancelled or refunded). Shared by the hero pill and the stats bar so the two always agree.
const SERVED_BUYERS = `
  WITH buyers AS (
    SELECT user_id, MAX(created_at) AS last_at FROM (
      SELECT user_id, created_at FROM orders WHERE status <> 'cancelled' AND payment_status <> 'refunded'
      UNION ALL
      SELECT user_id, created_at FROM bookings WHERE status <> 'cancelled' AND payment_status <> 'refunded'
    ) t
    GROUP BY user_id
  ),
  served AS (
    SELECT u.first_name, u.last_name, u.avatar, b.last_at
    FROM buyers b JOIN users u ON u.id = b.user_id
    WHERE u.role = 'customer' AND COALESCE(u.archived, 0) = 0
  )
`;

// The home hero's "N Homeowners Served" pill: the served count, plus three of them to show as
// avatars — ones with a profile photo first, then the most recent. Only a first name and last
// initial leave the server, never ids or contact details.
app.get('/api/customers/served', async (req, res) => {
  const rows = await db.prepare(`
    ${SERVED_BUYERS}
    SELECT first_name, last_name, avatar, COUNT(*) OVER () AS total
    FROM served
    ORDER BY (avatar IS NOT NULL) DESC, last_at DESC
    LIMIT 3
  `).all();
  res.json({
    count: rows[0]?.total ?? 0,
    buyers: rows.map(r => ({
      name: `${r.first_name} ${(r.last_name || '').charAt(0)}.`.replace(/ \.$/, ''),
      initials: `${r.first_name?.[0] || ''}${r.last_name?.[0] || ''}`.toUpperCase(),
      avatar: r.avatar || null,
    })),
  });
});

// The home page's stats bar, read from live data: homeowners served (same rule as the pill above),
// products a customer can actually see in the shop, active installers / technicians, and the
// average product review. rating is null until the first review comes in.
app.get('/api/stats', cachedJson(async () => {
  const row = await db.prepare(`
    ${SERVED_BUYERS}
    SELECT
      (SELECT COUNT(*) FROM served) AS homeowners,
      (SELECT COUNT(*) FROM products WHERE (archived IS NULL OR archived = 0) AND (status IS NULL OR status = 'active')) AS products,
      (SELECT COUNT(*) FROM users WHERE role = 'employee' AND position = 'installer' AND COALESCE(archived, 0) = 0) AS technicians,
      (SELECT ROUND(AVG(rating), 1) FROM reviews) AS rating,
      (SELECT COUNT(*) FROM reviews) AS reviews
  `).get();
  return { json: row };
}));

app.use('/api/geo', geoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/promos', promoRoutes);
// Products, services and categories only change through staff routes, so any staff write empties
// the public catalog cache (utils/responseCache.js) once it has finished — the next storefront
// load then reads the edit instead of a copy from up to 30 seconds earlier.
app.use('/api/admin', (req, res, next) => {
  if (req.method !== 'GET') res.on('finish', clearResponseCache);
  next();
});
app.use('/api/admin', adminRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/app-return', appReturnRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  // The database layer (db/database.js) tags "couldn't reach the database" with a readable message.
  if (err.code === 'db_unavailable') return res.status(503).json({ error: err.message, code: err.code });
  res.status(500).json({ error: 'Internal server error' });
});

// Node exits on a promise rejection nobody handled, which would take every customer's session down
// over one missed .catch() (a fire-and-forget email, a background sweep). Log it and keep serving.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

app.listen(PORT, () => console.log(`HomeLink API running on http://localhost:${PORT}`));

// Backstop for PayMongo payments nothing confirmed (no webhook, customer closed the app
// before its status poll landed): finalize them so they still become orders and bookings.
// Admin's order, booking and dashboard pages also run it on load.
setInterval(() => reconcilePendingPayments({ waitMs: 0 }), 2 * 60 * 1000).unref();
