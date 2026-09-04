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
import bookingRoutes from './routes/bookings.js';
import promoRoutes from './routes/promos.js';
import adminRoutes from './routes/admin.js';
import employeeRoutes from './routes/employee.js';
import addressRoutes from './routes/addresses.js';
import paymentMethodRoutes from './routes/paymentMethods.js';
import reviewRoutes from './routes/reviews.js';
import supportRoutes from './routes/support.js';
import notificationRoutes from './routes/notifications.js';
import messageRoutes from './routes/messages.js';
import wishlistRoutes from './routes/wishlist.js';
import cartRoutes from './routes/cart.js';
import paymentRoutes, { paymongoWebhookHandler } from './routes/payments.js';
import db from './db/database.js';

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
  'http://localhost:4200',
  'https://localhost',
  'http://localhost',
  'https://homelink-mobile-app.vercel.app',
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

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', name: 'HomeLink API' }));

app.get('/api/announcements', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM announcements WHERE active = 1 ORDER BY created_at DESC').all());
});

app.get('/api/gallery', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM gallery ORDER BY sort_order').all());
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/promos', promoRoutes);
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`HomeLink API running on http://localhost:${PORT}`));
