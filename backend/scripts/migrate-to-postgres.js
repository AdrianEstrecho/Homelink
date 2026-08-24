// One-off: copies the local better-sqlite3 database (db/homelink.db) into the Postgres
// schema created by db/database.js on the target DATABASE_URL (run the app once against
// Supabase first so the tables exist). Not part of the app's runtime — run manually once:
//   node backend/scripts/migrate-to-postgres.js
//
// Safe to re-run: every insert is `ON CONFLICT (id) DO NOTHING`, and the whole copy runs in
// one transaction that rolls back entirely on any error or row-count mismatch.
import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

// Same fix as db/database.js: pg returns bigint (COUNT(*)) as a string by default.
pg.types.setTypeParser(20, (val) => parseInt(val, 10));

const sqlite = new Database(path.join(__dirname, '../db/homelink.db'), { readonly: true });
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const TIMESTAMPTZ_COLUMNS = new Set(['created_at', 'reviewed_at']);

// SQLite's datetime('now') produces UTC but with no timezone marker ('YYYY-MM-DD HH:MM:SS').
// Binding that bare string to a TIMESTAMPTZ column would let Postgres reinterpret it in the
// session's local timezone instead of UTC, so make it explicit first.
function toUtcTimestamp(value) {
  if (value === null || value === undefined || typeof value !== 'string') return value;
  if (value.includes('T') || value.endsWith('Z')) return value;
  return value.replace(' ', 'T') + 'Z';
}

// Mirrors the retired runtime backfills that used to live in db/database.js: the
// customer_support position was folded into general_staff, and staff codes are assigned
// sequentially per role/position prefix for any admin/employee row that predates the
// staff_code column.
const STAFF_CODE_PREFIX = { inventory_clerk: 'IC', booking_coordinator: 'BC', installer: 'IN', accounting: 'AC', hr: 'HR', general_staff: 'GS' };

const TABLE_ORDER = [
  'users', 'categories', 'products', 'services', 'orders', 'order_items',
  'pending_checkouts', 'bookings', 'pending_bookings', 'vouchers', 'announcements',
  'gallery', 'addresses', 'payment_methods', 'reviews', 'wishlists',
  'support_messages', 'support_replies', 'audit_logs', 'change_requests',
  'suppliers', 'notifications', 'staff_messages',
];

// Intersects the live SQLite columns with the live Postgres columns, rather than assuming
// they match exactly — the SQLite file can carry columns that never made it into (or were
// dropped from) the consolidated schema in db/database.js (e.g. an abandoned feature's
// leftover column). Anything only on the SQLite side is silently skipped.
async function getColumns(table) {
  const sqliteCols = sqlite.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  const { rows } = await client.query(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
    ['public', table]
  );
  const pgCols = new Set(rows.map(r => r.column_name));
  const skipped = sqliteCols.filter(c => !pgCols.has(c));
  if (skipped.length) console.log(`  (skipping columns not in Postgres schema: ${skipped.join(', ')})`);
  return sqliteCols.filter(c => pgCols.has(c));
}

async function insertRows(table, rows, columns) {
  if (rows.length === 0) return 0;
  const colList = columns.join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;
  for (const row of rows) {
    const values = columns.map(col => (TIMESTAMPTZ_COLUMNS.has(col) ? toUtcTimestamp(row[col]) : row[col]));
    await client.query(sql, values);
  }
  return rows.length;
}

async function migrateUsers() {
  const columns = await getColumns('users');
  const rows = sqlite.prepare('SELECT * FROM users ORDER BY created_at ASC').all();

  const staffCodeCounts = {};
  for (const row of rows) {
    if (row.position === 'customer_support') row.position = 'general_staff';
    if (!row.staff_code && (row.role === 'admin' || row.role === 'employee')) {
      const prefix = row.role === 'admin' ? 'SA' : (STAFF_CODE_PREFIX[row.position] || 'EMP');
      staffCodeCounts[prefix] = (staffCodeCounts[prefix] || 0) + 1;
      row.staff_code = `${prefix}${String(staffCodeCounts[prefix]).padStart(3, '0')}`;
    }
  }
  return insertRows('users', rows, columns);
}

// categories self-references via parent_id, so top-level rows must land before children.
async function migrateCategories() {
  const columns = await getColumns('categories');
  const all = sqlite.prepare('SELECT * FROM categories').all();
  const parents = all.filter(c => !c.parent_id);
  const children = all.filter(c => c.parent_id);
  await insertRows('categories', parents, columns);
  await insertRows('categories', children, columns);
  return parents.length + children.length;
}

async function migrateSupportMessages() {
  const columns = await getColumns('support_messages');
  const rows = sqlite.prepare('SELECT * FROM support_messages ORDER BY created_at ASC').all();
  let next = 1;
  for (const row of rows) {
    if (row.ticket_number === null || row.ticket_number === undefined) row.ticket_number = next;
    next = Math.max(next, row.ticket_number + 1);
  }
  return insertRows('support_messages', rows, columns);
}

async function migrateGeneric(table) {
  const columns = await getColumns(table);
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
  return insertRows(table, rows, columns);
}

async function verifyCount(table) {
  const sqliteCount = sqlite.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
  const { rows } = await client.query(`SELECT COUNT(*) as c FROM ${table}`);
  const pgCount = rows[0].c;
  if (sqliteCount !== pgCount) {
    throw new Error(`Row count mismatch for ${table}: sqlite=${sqliteCount} postgres=${pgCount}`);
  }
  console.log(`  ${table}: ${pgCount} rows OK`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to backend/.env before running this script.');
    process.exitCode = 1;
    return;
  }

  await client.connect();
  try {
    await client.query('BEGIN');

    for (const table of TABLE_ORDER) {
      console.log(`Migrating ${table}...`);
      if (table === 'users') await migrateUsers();
      else if (table === 'categories') await migrateCategories();
      else if (table === 'support_messages') await migrateSupportMessages();
      else await migrateGeneric(table);
    }

    console.log('\nVerifying row counts...');
    for (const table of TABLE_ORDER) await verifyCount(table);

    await client.query('COMMIT');
    console.log('\nMigration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nMigration failed, rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
    sqlite.close();
  }
}

main();
