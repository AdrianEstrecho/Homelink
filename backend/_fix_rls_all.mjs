import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const tables = [
  'categories', 'products', 'services', 'orders', 'order_items',
  'pending_checkouts', 'bookings', 'pending_bookings', 'vouchers',
  'announcements', 'gallery', 'addresses', 'payment_methods', 'reviews',
  'wishlists', 'support_messages', 'support_replies', 'audit_logs',
  'change_requests', 'suppliers', 'notifications', 'staff_messages', 'return_requests', 'return_items', 'return_photos',
];

await client.connect();
try {
  for (const t of tables) {
    await client.query(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
    console.log('enabled RLS on', t);
  }

  const { rows } = await client.query(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
    ORDER BY relname;
  `);
  console.log('\n--- final state ---');
  for (const r of rows) {
    console.log(r.relname.padEnd(22), 'rls=', r.relrowsecurity, 'force=', r.relforcerowsecurity);
  }
} finally {
  await client.end();
}
