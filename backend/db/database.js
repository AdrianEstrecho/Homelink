import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'homelink.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// addresses moved from a single free-text blob to structured fields — drop the old shape so it's recreated below
const legacyAddressCols = db.prepare("PRAGMA table_info(addresses)").all();
if (legacyAddressCols.some(c => c.name === 'full_address')) {
  db.exec('DROP TABLE addresses');
}

db.exec(`
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
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    specifications TEXT,
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    image TEXT,
    featured INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    base_price REAL NOT NULL,
    duration_hours REAL DEFAULT 2,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','shipped','delivered','cancelled')),
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0,
    total REAL NOT NULL,
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','refunded')),
    payment_method TEXT,
    shipping_address TEXT,
    promo_code TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price REAL NOT NULL
  );

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
    price REAL NOT NULL,
    discount REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','refunded')),
    completion_notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT CHECK(discount_type IN ('percent','fixed')),
    discount_value REAL NOT NULL,
    min_order REAL DEFAULT 0,
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
    created_at TEXT DEFAULT (datetime('now'))
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
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    last4 TEXT NOT NULL,
    exp_month INTEGER NOT NULL,
    exp_year INTEGER NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    order_id TEXT REFERENCES orders(id),
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wishlists (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlists_user_product ON wishlists(user_id, product_id);

  CREATE TABLE IF NOT EXISTS support_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'support' CHECK(type IN ('support','complaint')),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK(status IN ('open','resolved')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
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
    entity_type TEXT NOT NULL CHECK(entity_type IN ('product','service','voucher','employee','supplier','salary','payment','booking')),
    entity_id TEXT,
    action TEXT NOT NULL CHECK(action IN ('create','update','delete','archive','restore')),
    payload TEXT,
    requested_by TEXT NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    reviewed_by TEXT REFERENCES users(id),
    review_note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT
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
    created_at TEXT DEFAULT (datetime('now'))
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
    created_at TEXT DEFAULT (datetime('now'))
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
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_staff_messages_parties ON staff_messages(sender_id, recipient_id);
`);

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('users', 'notify_orders', 'INTEGER DEFAULT 1');
ensureColumn('users', 'notify_bookings', 'INTEGER DEFAULT 1');
ensureColumn('users', 'notify_promotions', 'INTEGER DEFAULT 1');
ensureColumn('products', 'archived', 'INTEGER DEFAULT 0');
ensureColumn('services', 'archived', 'INTEGER DEFAULT 0');
ensureColumn('users', 'position', 'TEXT');
ensureColumn('users', 'google_id', 'TEXT');
ensureColumn('users', 'apple_id', 'TEXT');
ensureColumn('users', 'reset_token', 'TEXT');
ensureColumn('users', 'reset_token_expires', 'TEXT');
ensureColumn('users', 'staff_code', 'TEXT');
ensureColumn('users', 'terms_accepted_at', 'TEXT');
ensureColumn('users', 'archived', 'INTEGER DEFAULT 0');
ensureColumn('services', 'discount', 'REAL DEFAULT 0');
ensureColumn('services', 'status', "TEXT DEFAULT 'active'");
ensureColumn('categories', 'parent_id', 'TEXT REFERENCES categories(id)');
ensureColumn('products', 'brand', 'TEXT');
ensureColumn('products', 'discount', 'REAL DEFAULT 0');
ensureColumn('products', 'status', "TEXT DEFAULT 'active'");
ensureColumn('users', 'salary', 'REAL DEFAULT 0');
ensureColumn('users', 'bank_name', 'TEXT');
ensureColumn('users', 'bank_account_number', 'TEXT');
ensureColumn('users', 'bank_account_name', 'TEXT');
ensureColumn('suppliers', 'bank_name', 'TEXT');
ensureColumn('suppliers', 'bank_account_number', 'TEXT');
ensureColumn('suppliers', 'bank_account_name', 'TEXT');
ensureColumn('orders', 'cancel_reason', 'TEXT');
ensureColumn('bookings', 'cancel_reason', 'TEXT');

// The customer_support position was retired in favor of Accounting/HR — any existing
// employee still holding it moves to general_staff (which already shares support-message
// access) rather than being left pointing at a position that no longer exists.
db.exec("UPDATE users SET position = 'general_staff' WHERE position = 'customer_support'");

// SQLite can't ALTER a CHECK constraint in place, so a database created before
// 'employee'/'supplier'/'salary'/'payment'/'booking' entity types (and HR's 'archive'/'restore'
// actions on them) were added to change_requests needs the table rebuilt to widen it. Guarded by
// inspecting the stored schema so this only runs once per missing entity type.
const changeRequestsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='change_requests'").get()?.sql || '';
if (changeRequestsSql && !changeRequestsSql.includes("'booking'")) {
  db.exec(`
    ALTER TABLE change_requests RENAME TO change_requests_old;
    CREATE TABLE change_requests (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('product','service','voucher','employee','supplier','salary','payment','booking')),
      entity_id TEXT,
      action TEXT NOT NULL CHECK(action IN ('create','update','delete','archive','restore')),
      payload TEXT,
      requested_by TEXT NOT NULL REFERENCES users(id),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      reviewed_by TEXT REFERENCES users(id),
      review_note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT
    );
    INSERT INTO change_requests SELECT * FROM change_requests_old;
    DROP TABLE change_requests_old;
    CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
  `);
}

// A staff code must be unique once assigned — enforced at the DB level so a
// bug (e.g. two overlapping backfill runs during a --watch restart) fails
// loudly instead of silently handing two people the same code.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_staff_code ON users(staff_code) WHERE staff_code IS NOT NULL');

// Backfill staff codes for admin/employee rows that predate the staff_code column.
const STAFF_CODE_PREFIX = { inventory_clerk: 'IC', booking_coordinator: 'BC', installer: 'IN', accounting: 'AC', hr: 'HR', general_staff: 'GS' };
const backfillStaffCodes = db.transaction(() => {
  const uncoded = db.prepare("SELECT id, role, position FROM users WHERE role IN ('admin','employee') AND staff_code IS NULL ORDER BY created_at ASC").all();
  for (const u of uncoded) {
    const prefix = u.role === 'admin' ? 'SA' : (STAFF_CODE_PREFIX[u.position] || 'EMP');
    const { c } = db.prepare('SELECT COUNT(*) as c FROM users WHERE staff_code LIKE ?').get(`${prefix}%`);
    db.prepare('UPDATE users SET staff_code = ? WHERE id = ?').run(`${prefix}${String(c + 1).padStart(3, '0')}`, u.id);
  }
});
backfillStaffCodes();

export default db;
