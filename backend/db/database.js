import pg from 'pg';
import dotenv from 'dotenv';

// This module reads process.env.DATABASE_URL as soon as it's imported, which in an ESM
// graph can happen before server.js's own dotenv.config() call runs (imported modules are
// evaluated before the importing module's own top-level statements). Load env vars here too
// so the pool always sees DATABASE_URL regardless of import order elsewhere.
dotenv.config();

const { Pool } = pg;

// pg returns bigint (COUNT(*), SUM() over integer columns) as a string by default, to avoid
// silent precision loss past Number.MAX_SAFE_INTEGER. This app's counts/sums never get
// remotely close to that, and every dashboard stat (`c + 1`, `c === 0`, etc.) expects a plain
// number the way better-sqlite3 always returned one — so parse OID 20 (int8) as a JS number.
pg.types.setTypeParser(20, (val) => parseInt(val, 10));
// Same story for numeric/decimal (OID 1700) — e.g. ROUND(AVG(rating), 1) — which pg also
// returns as a string by default to avoid precision loss. better-sqlite3 always returned a
// plain number here (products.js/wishlist.js's avg_rating), so match that.
pg.types.setTypeParser(1700, (val) => parseFloat(val));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Wraps anything shaped like { query(text, params) } — the pool itself, or a single
// checked-out client inside a transaction — behind the same db.prepare(sql).get/all/run()
// shape the codebase already uses, so route handlers only need `await` + `async` added
// rather than being restructured around pool.query(...).rows.
function wrapExecutor(rawQuery) {
  return {
    prepare(sql) {
      const text = toPgSql(sql);
      return {
        async get(...params) {
          const { rows } = await rawQuery(text, params);
          return rows[0];
        },
        async all(...params) {
          const { rows } = await rawQuery(text, params);
          return rows;
        },
        async run(...params) {
          const result = await rawQuery(text, params);
          return { changes: result.rowCount, lastInsertRowid: undefined };
        },
      };
    },
    // Multi-statement DDL: calling query(text) with no params array uses pg's simple query
    // protocol, which (unlike the extended/parameterized protocol) allows several
    // ';'-separated statements in one call — the same role better-sqlite3's db.exec() played.
    async exec(sql) {
      await rawQuery(sql);
    },
  };
}

const db = wrapExecutor((text, params) => pool.query(text, params));

// Runs fn against a single checked-out client wrapped in BEGIN/COMMIT/ROLLBACK. Postgres
// requires every statement in a transaction to share one connection, not the shared pool, so
// fn receives its own {prepare} bound to that client rather than the module-level `db`.
export async function withTransaction(fn) {
  const client = await pool.connect();
  const tx = wrapExecutor((text, params) => client.query(text, params));
  try {
    await client.query('BEGIN');
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    role TEXT DEFAULT 'customer' CHECK(role IN ('customer','employee','admin')),
    verified INTEGER DEFAULT 0,
    notify_orders INTEGER DEFAULT 1,
    notify_bookings INTEGER DEFAULT 1,
    notify_promotions INTEGER DEFAULT 1,
    position TEXT,
    google_id TEXT,
    apple_id TEXT,
    reset_token TEXT,
    reset_token_expires TEXT,
    staff_code TEXT,
    terms_accepted_at TEXT,
    archived INTEGER DEFAULT 0,
    salary DOUBLE PRECISION DEFAULT 0,
    bank_name TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT,
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_code TEXT,
    two_factor_code_expires TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_staff_code ON users(staff_code) WHERE staff_code IS NOT NULL;
  -- CREATE TABLE IF NOT EXISTS skips column additions on a table that already exists in a
  -- deployed database, so columns added after the table's first deploy need an explicit,
  -- idempotent ALTER alongside it.
  ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled INTEGER DEFAULT 0;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_code TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_code_expires TEXT;

  -- Widen payment_method to allow 'qrph' (QR Ph, via PayMongo's hosted Checkout Session) on
  -- databases created before it was added to the CHECK above.
  ALTER TABLE pending_checkouts DROP CONSTRAINT IF EXISTS pending_checkouts_payment_method_check;
  ALTER TABLE pending_checkouts ADD CONSTRAINT pending_checkouts_payment_method_check CHECK (payment_method IN ('card','gcash','qrph'));
  ALTER TABLE pending_bookings DROP CONSTRAINT IF EXISTS pending_bookings_payment_method_check;
  ALTER TABLE pending_bookings ADD CONSTRAINT pending_bookings_payment_method_check CHECK (payment_method IN ('card','gcash','qrph'));

  -- Checkout Sessions v2 migration: the session id is known immediately (used to poll status),
  -- the payment intent id only once the customer actually pays.
  ALTER TABLE pending_checkouts ADD COLUMN IF NOT EXISTS paymongo_checkout_session_id TEXT;
  ALTER TABLE pending_bookings ADD COLUMN IF NOT EXISTS paymongo_checkout_session_id TEXT;

  -- Holds a signup email-verification code between "Confirm Email" and account creation.
  -- Keyed by email rather than user_id since no user row exists yet at this point.
  CREATE TABLE IF NOT EXISTS signup_verifications (
    email TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image TEXT,
    parent_id TEXT REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    specifications TEXT,
    price DOUBLE PRECISION NOT NULL,
    stock INTEGER DEFAULT 0,
    image TEXT,
    featured INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    brand TEXT,
    discount DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    base_price DOUBLE PRECISION NOT NULL,
    duration_hours DOUBLE PRECISION DEFAULT 2,
    image TEXT,
    archived INTEGER DEFAULT 0,
    discount DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','shipped','delivered','cancelled')),
    subtotal DOUBLE PRECISION NOT NULL,
    discount DOUBLE PRECISION DEFAULT 0,
    total DOUBLE PRECISION NOT NULL,
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','refunded')),
    payment_method TEXT,
    shipping_address TEXT,
    promo_code TEXT,
    cancel_reason TEXT,
    paymongo_payment_intent_id TEXT,
    paymongo_payment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DOUBLE PRECISION NOT NULL
  );

  -- Holds a validated cart snapshot between "redirect out to PayMongo's hosted Checkout
  -- Session" and "webhook/poll confirms payment", since the real order can't be created —
  -- and stock can't be deducted — until the charge is actually confirmed. checkout_session_id
  -- is known immediately (used to poll); payment_intent_id only exists once the customer
  -- actually pays (Checkout Sessions v2 defers creating it until then).
  CREATE TABLE IF NOT EXISTS pending_checkouts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    items TEXT NOT NULL,
    subtotal DOUBLE PRECISION NOT NULL,
    discount DOUBLE PRECISION DEFAULT 0,
    total DOUBLE PRECISION NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('card','gcash','qrph')),
    shipping_address TEXT,
    promo_code TEXT,
    applied_promo TEXT,
    paymongo_checkout_session_id TEXT,
    paymongo_payment_intent_id TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','succeeded','failed')),
    order_id TEXT REFERENCES orders(id),
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_pending_checkouts_session ON pending_checkouts(paymongo_checkout_session_id);

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    service_id TEXT REFERENCES services(id),
    employee_id TEXT REFERENCES users(id),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','in_progress','completed','cancelled')),
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    address TEXT NOT NULL,
    notes TEXT,
    price DOUBLE PRECISION NOT NULL,
    discount DOUBLE PRECISION DEFAULT 0,
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','refunded')),
    completion_notes TEXT,
    cancel_reason TEXT,
    payment_method TEXT,
    paymongo_payment_intent_id TEXT,
    paymongo_payment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Same purpose as pending_checkouts, but for service bookings: holds a validated booking
  -- request between "redirect out to PayMongo's hosted Checkout Session" and "webhook/poll
  -- confirms payment" — the real booking row can't be created until the charge is confirmed.
  CREATE TABLE IF NOT EXISTS pending_bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    service_id TEXT REFERENCES services(id),
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    address TEXT NOT NULL,
    notes TEXT,
    price DOUBLE PRECISION NOT NULL,
    discount DOUBLE PRECISION DEFAULT 0,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('card','gcash','qrph')),
    paymongo_checkout_session_id TEXT,
    paymongo_payment_intent_id TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','succeeded','failed')),
    booking_id TEXT REFERENCES bookings(id),
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_pending_bookings_session ON pending_bookings(paymongo_checkout_session_id);

  CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT CHECK(discount_type IN ('percent','fixed')),
    discount_value DOUBLE PRECISION NOT NULL,
    min_order DOUBLE PRECISION DEFAULT 0,
    max_uses INTEGER DEFAULT 100,
    used_count INTEGER DEFAULT 0,
    valid_from TEXT,
    valid_until TEXT,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT DEFAULT 'info',
    active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS gallery (
    id TEXT PRIMARY KEY,
    title TEXT,
    image TEXT NOT NULL,
    category TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    house_number TEXT,
    street TEXT NOT NULL,
    village TEXT,
    city TEXT NOT NULL,
    province TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    last4 TEXT NOT NULL,
    exp_month INTEGER NOT NULL,
    exp_year INTEGER NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    order_id TEXT REFERENCES orders(id),
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS wishlists (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlists_user_product ON wishlists(user_id, product_id);

  -- A signed-in customer's shopping cart, kept server-side so it follows the account across
  -- devices/browsers instead of living only in one browser's localStorage.
  CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_user_product ON cart_items(user_id, product_id);

  CREATE TABLE IF NOT EXISTS support_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'support' CHECK(type IN ('support','complaint')),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK(status IN ('open','resolved')),
    ticket_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Staff (general staff / inventory clerk) replies to a customer's ticket — kept as its
  -- own table rather than a column so a ticket can carry a full back-and-forth thread.
  -- Resolving a ticket doesn't write here at all; that goes through change_requests
  -- (entity_type='support') the same way an installer's job completion does, since it
  -- needs HR/admin sign-off before support_messages.status actually flips to 'resolved'.
  CREATE TABLE IF NOT EXISTS support_replies (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_support_replies_message ON support_replies(message_id);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

  -- Proposed create/update/delete writes from positions whose changes need a reviewer to
  -- sign off before they take effect: general_staff's product/service/voucher writes go to
  -- an inventory clerk or admin, and HR's employee/supplier writes go to admin only. payload
  -- holds the submitted fields as JSON; entity_id is null for 'create' requests since the
  -- entity doesn't exist yet.
  CREATE TABLE IF NOT EXISTS change_requests (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('product','service','voucher','employee','supplier','salary','payment','booking','support')),
    entity_id TEXT,
    action TEXT NOT NULL CHECK(action IN ('create','update','delete','archive','restore')),
    payload TEXT,
    requested_by TEXT NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    reviewed_by TEXT REFERENCES users(id),
    review_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    category TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
    notes TEXT,
    bank_name TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Personal, per-recipient notifications (job assignments, new messages) — distinct from
  -- audit_logs, which records who-did-what for the admin activity feed/trail rather than
  -- who should be told about it.
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

  -- Direct staff-to-staff messages (e.g. a booking coordinator reaching a technician about
  -- a job) — a simple two-party thread keyed by (sender_id, recipient_id) pairs, not a
  -- general group-chat model.
  CREATE TABLE IF NOT EXISTS staff_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id),
    recipient_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_staff_messages_parties ON staff_messages(sender_id, recipient_id);
`);

export default db;
