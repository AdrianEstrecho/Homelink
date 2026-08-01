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

// A staff code must be unique once assigned — enforced at the DB level so a
// bug (e.g. two overlapping backfill runs during a --watch restart) fails
// loudly instead of silently handing two people the same code.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_staff_code ON users(staff_code) WHERE staff_code IS NOT NULL');

// Backfill staff codes for admin/employee rows that predate the staff_code column.
const STAFF_CODE_PREFIX = { inventory_clerk: 'IC', booking_coordinator: 'BC', installer: 'IN', customer_support: 'CS', general_staff: 'GS' };
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
