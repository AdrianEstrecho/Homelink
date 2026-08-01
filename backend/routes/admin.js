import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logActivity } from '../utils/audit.js';
import { generateStaffCode } from '../utils/staffCode.js';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/notifications-summary', (req, res) => {
  res.json({
    pendingOrders: db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='pending'").get().c,
    pendingBookings: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status='pending'").get().c,
    lowStockCount: db.prepare("SELECT COUNT(*) as c FROM products WHERE stock > 0 AND stock <= 5 AND (archived IS NULL OR archived = 0)").get().c,
  });
});

router.get('/dashboard', (req, res) => {
  const stats = {
    totalCustomers: db.prepare("SELECT COUNT(*) as c FROM users WHERE role='customer'").get().c,
    totalEmployees: db.prepare("SELECT COUNT(*) as c FROM users WHERE role='employee'").get().c,
    totalProducts: db.prepare("SELECT COUNT(*) as c FROM products WHERE (archived IS NULL OR archived = 0)").get().c,
    totalOrders: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
    totalBookings: db.prepare('SELECT COUNT(*) as c FROM bookings').get().c,
    revenue: db.prepare("SELECT COALESCE(SUM(total),0) as t FROM orders WHERE payment_status='paid'").get().t +
             db.prepare("SELECT COALESCE(SUM(price),0) as t FROM bookings WHERE payment_status='paid'").get().t,
    pendingOrders: db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='pending'").get().c,
    pendingBookings: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status='pending'").get().c,
    lowStockCount: db.prepare("SELECT COUNT(*) as c FROM products WHERE stock > 0 AND stock <= 5 AND (archived IS NULL OR archived = 0)").get().c,
    outOfStockCount: db.prepare("SELECT COUNT(*) as c FROM products WHERE stock = 0 AND (archived IS NULL OR archived = 0)").get().c,
  };
  const orderStatusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count FROM orders GROUP BY status
  `).all();
  const monthlyRevenue = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(total),0) as revenue
    FROM orders WHERE payment_status='paid' GROUP BY month
  `).all();
  const revenueByMonth = Object.fromEntries(monthlyRevenue.map(r => [r.month, r.revenue]));
  const year = new Date().toISOString().slice(0, 4);
  const salesByMonth = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { month, revenue: revenueByMonth[month] || 0 };
  });
  const recentOrders = db.prepare('SELECT o.*, u.first_name, u.last_name FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 5').all();
  const recentBookings = db.prepare('SELECT b.*, s.name as service_name, u.first_name, u.last_name FROM bookings b JOIN services s ON b.service_id=s.id JOIN users u ON b.user_id=u.id ORDER BY b.created_at DESC LIMIT 5').all();
  res.json({ stats, orderStatusBreakdown, salesByMonth, recentOrders, recentBookings });
});

// Users
const EMPLOYEE_POSITIONS = ['inventory_clerk', 'booking_coordinator', 'installer', 'customer_support', 'general_staff'];

router.get('/users', (req, res) => {
  const { role, position } = req.query;
  let sql = 'SELECT id, email, first_name, last_name, phone, address, role, position, staff_code, archived, created_at FROM users WHERE 1=1';
  const params = [];
  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (position) { sql += ' AND position = ?'; params.push(position); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params).map(u => ({ ...u, archived: !!u.archived })));
});

router.post('/users', async (req, res) => {
  const { email, password, firstName, lastName, phone, role, position } = req.body;
  const id = uuid();
  const hash = await bcrypt.hash(password || 'employee123', 10);
  const finalRole = role || 'employee';
  const finalPosition = finalRole === 'employee' && EMPLOYEE_POSITIONS.includes(position) ? position : null;
  const staffCode = finalRole !== 'customer' ? generateStaffCode(finalRole, finalPosition) : null;
  db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, role, position, staff_code, verified) VALUES (?,?,?,?,?,?,?,?,?,1)')
    .run(id, email.toLowerCase(), hash, firstName, lastName, phone || '', finalRole, finalPosition, staffCode);
  logActivity(req, 'user.create', 'user', id, { email: email.toLowerCase(), role: finalRole, position: finalPosition, staffCode });
  res.status(201).json({ id, staffCode });
});

// Promote a customer to employee (with a position), or change an existing employee's position.
// Admin-only by virtue of router.use(authorize('admin')) above — no other role can reach this.
router.put('/users/:id/promote', (req, res) => {
  const { position } = req.body;
  if (!EMPLOYEE_POSITIONS.includes(position)) return res.status(400).json({ error: 'Invalid position' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Cannot change an administrator this way' });
  // A staff code is assigned once and kept even if the position changes later.
  const staffCode = user.staff_code || generateStaffCode('employee', position);
  db.prepare("UPDATE users SET role = 'employee', position = ?, staff_code = ? WHERE id = ?").run(position, staffCode, req.params.id);
  logActivity(req, 'user.promote', 'user', req.params.id, { email: user.email, fromRole: user.role, fromPosition: user.position, toPosition: position, staffCode });
  res.json({ message: 'User promoted', position, staffCode });
});

// Archiving a user revokes their ability to log in but keeps their data intact and
// reversible — unlike the permanent delete below, which is only reachable from the
// Archived Users view.
router.put('/users/:id/archive', (req, res) => {
  const user = db.prepare('SELECT email, role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Cannot archive an administrator' });
  db.prepare('UPDATE users SET archived = 1 WHERE id = ?').run(req.params.id);
  logActivity(req, 'user.archive', 'user', req.params.id, { email: user.email, role: user.role });
  res.json({ message: 'User archived' });
});

router.put('/users/:id/restore', (req, res) => {
  const user = db.prepare('SELECT email, role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET archived = 0 WHERE id = ?').run(req.params.id);
  logActivity(req, 'user.restore', 'user', req.params.id, { email: user.email, role: user.role });
  res.json({ message: 'User restored' });
});

router.delete('/users/:id', (req, res) => {
  const user = db.prepare('SELECT email, role FROM users WHERE id = ?').get(req.params.id);
  const result = db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(req.params.id, 'admin');
  if (result.changes > 0 && user) logActivity(req, 'user.delete', 'user', req.params.id, { email: user.email, role: user.role });
  res.json({ message: 'User deleted' });
});

// Products
router.get('/products', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name, c.parent_id as category_parent_id,
      COALESCE(pc.id, c.id) as main_category_id, COALESCE(pc.name, c.name) as main_category_name,
      CASE WHEN c.parent_id IS NOT NULL THEN c.name ELSE NULL END as subcategory_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    ORDER BY p.archived ASC, p.name ASC
  `).all();
  res.json(products.map(p => ({ ...p, archived: !!p.archived, featured: !!p.featured })));
});

router.post('/products', (req, res) => {
  const { name, slug, categoryId, description, specifications, price, stock, image, featured, brand, discount, status } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO products (id, category_id, name, slug, description, specifications, price, stock, image, featured, brand, discount, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, categoryId, name, slug, description, JSON.stringify(specifications || {}), price, stock, image, featured ? 1 : 0, brand || null, Number(discount) || 0, status === 'inactive' ? 'inactive' : 'active');
  logActivity(req, 'product.create', 'product', id, { name });
  res.status(201).json({ id });
});

// Editing a product never lets the stock number be typed directly — it can only move via
// an "add stock" delta that must be countersigned by an inventory clerk's staff code, so
// the audit trail always shows who physically verified a restock.
router.put('/products/:id', (req, res) => {
  const { name, categoryId, description, specifications, price, image, featured, brand, discount, status, addStock, clerkCode } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  let stock = product.stock;
  const addQty = Number(addStock) || 0;
  let clerk = null;
  if (addQty > 0) {
    if (!clerkCode) return res.status(400).json({ error: 'Enter the inventory clerk code to authorize this stock addition.' });
    clerk = db.prepare('SELECT * FROM users WHERE staff_code = ?').get(clerkCode.trim().toUpperCase());
    const isAuthorized = clerk && (clerk.role === 'admin' || (clerk.role === 'employee' && clerk.position === 'inventory_clerk'));
    if (!isAuthorized) return res.status(400).json({ error: 'Invalid clerk code. Must belong to an inventory clerk or admin.' });
    stock = product.stock + addQty;
  }

  db.prepare('UPDATE products SET name=?, category_id=?, description=?, specifications=?, price=?, stock=?, image=?, featured=?, brand=?, discount=?, status=? WHERE id=?')
    .run(name, categoryId, description, JSON.stringify(specifications || {}), price, stock, image, featured ? 1 : 0, brand || null, Number(discount) || 0, status === 'inactive' ? 'inactive' : 'active', req.params.id);
  logActivity(req, 'product.update', 'product', req.params.id, { name });
  if (addQty > 0) {
    logActivity(req, 'product.restock', 'product', req.params.id, {
      name, quantity: addQty, from: product.stock, to: stock,
      clerkCode: clerk.staff_code, clerkName: `${clerk.first_name} ${clerk.last_name}`,
    });
  }
  res.json({ message: 'Updated', stock });
});

router.put('/products/:id/archive', (req, res) => {
  const product = db.prepare('SELECT name FROM products WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE products SET archived = 1 WHERE id = ?').run(req.params.id);
  logActivity(req, 'product.archive', 'product', req.params.id, { name: product?.name });
  res.json({ message: 'Product archived' });
});

router.put('/products/:id/restore', (req, res) => {
  const product = db.prepare('SELECT name FROM products WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE products SET archived = 0 WHERE id = ?').run(req.params.id);
  logActivity(req, 'product.restore', 'product', req.params.id, { name: product?.name });
  res.json({ message: 'Product restored' });
});

router.delete('/products/:id', (req, res) => {
  const product = db.prepare('SELECT name FROM products WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (product) logActivity(req, 'product.delete', 'product', req.params.id, { name: product.name });
  res.json({ message: 'Deleted' });
});

// Categories
router.get('/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

router.post('/categories', (req, res) => {
  const { name, slug, description, image, parentId } = req.body;
  const id = uuid();
  try {
    db.prepare('INSERT INTO categories (id, name, slug, description, image, parent_id) VALUES (?,?,?,?,?,?)').run(id, name, slug, description || null, image || null, parentId || null);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: 'A category with that name already exists.' });
    throw err;
  }
  logActivity(req, 'category.create', 'category', id, { name });
  res.status(201).json({ id });
});

router.put('/categories/:id', (req, res) => {
  const { name, description, image } = req.body;
  db.prepare('UPDATE categories SET name=?, description=?, image=? WHERE id=?').run(name, description, image, req.params.id);
  logActivity(req, 'category.update', 'category', req.params.id, { name });
  res.json({ message: 'Updated' });
});

router.delete('/categories/:id', (req, res) => {
  const category = db.prepare('SELECT name FROM categories WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (category) logActivity(req, 'category.delete', 'category', req.params.id, { name: category.name });
  res.json({ message: 'Deleted' });
});

// Services
router.get('/services', (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY archived ASC, name ASC').all();
  res.json(services.map(s => ({ ...s, archived: !!s.archived })));
});

router.post('/services', (req, res) => {
  const { name, slug, description, category, basePrice, durationHours, image, discount, status } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO services (id, name, slug, description, category, base_price, duration_hours, image, discount, status) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, name, slug, description, category, basePrice, durationHours || 2, image, Number(discount) || 0, status === 'inactive' ? 'inactive' : 'active');
  logActivity(req, 'service.create', 'service', id, { name });
  res.status(201).json({ id });
});

router.put('/services/:id', (req, res) => {
  const { name, description, category, basePrice, durationHours, image, discount, status } = req.body;
  db.prepare('UPDATE services SET name=?, description=?, category=?, base_price=?, duration_hours=?, image=?, discount=?, status=? WHERE id=?')
    .run(name, description, category, basePrice, durationHours, image, Number(discount) || 0, status === 'inactive' ? 'inactive' : 'active', req.params.id);
  logActivity(req, 'service.update', 'service', req.params.id, { name });
  res.json({ message: 'Updated' });
});

router.put('/services/:id/archive', (req, res) => {
  const service = db.prepare('SELECT name FROM services WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE services SET archived = 1 WHERE id = ?').run(req.params.id);
  logActivity(req, 'service.archive', 'service', req.params.id, { name: service?.name });
  res.json({ message: 'Service archived' });
});

router.put('/services/:id/restore', (req, res) => {
  const service = db.prepare('SELECT name FROM services WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE services SET archived = 0 WHERE id = ?').run(req.params.id);
  logActivity(req, 'service.restore', 'service', req.params.id, { name: service?.name });
  res.json({ message: 'Service restored' });
});

router.delete('/services/:id', (req, res) => {
  const service = db.prepare('SELECT name FROM services WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  if (service) logActivity(req, 'service.delete', 'service', req.params.id, { name: service.name });
  res.json({ message: 'Deleted' });
});

// Orders
router.get('/orders', (req, res) => {
  const orders = db.prepare('SELECT o.*, u.first_name, u.last_name, u.email FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC').all();
  const result = orders.map(o => ({
    ...o,
    items: db.prepare('SELECT oi.*, p.name FROM order_items oi JOIN products p ON oi.product_id=p.id WHERE oi.order_id=?').all(o.id),
  }));
  res.json(result);
});

router.put('/orders/:id/status', (req, res) => {
  const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
  logActivity(req, 'order.status_update', 'order', req.params.id, { from: order?.status, to: req.body.status });
  res.json({ message: 'Status updated' });
});

// Bookings
router.get('/bookings', (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, s.name as service_name, u.first_name, u.last_name, u.email, u.phone,
    e.first_name as emp_first, e.last_name as emp_last
    FROM bookings b JOIN services s ON b.service_id=s.id JOIN users u ON b.user_id=u.id
    LEFT JOIN users e ON b.employee_id=e.id ORDER BY b.scheduled_date DESC
  `).all();
  res.json(bookings);
});

router.put('/bookings/:id', (req, res) => {
  const { status, employeeId } = req.body;
  const booking = db.prepare('SELECT status, employee_id FROM bookings WHERE id = ?').get(req.params.id);
  if (status) {
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);
    logActivity(req, 'booking.status_update', 'booking', req.params.id, { from: booking?.status, to: status });
  }
  if (employeeId) {
    db.prepare('UPDATE bookings SET employee_id = ?, status = ? WHERE id = ?').run(employeeId, 'confirmed', req.params.id);
    logActivity(req, 'booking.assign', 'booking', req.params.id, { fromEmployeeId: booking?.employee_id, toEmployeeId: employeeId });
  }
  res.json({ message: 'Updated' });
});

// Vouchers
router.get('/vouchers', (req, res) => res.json(db.prepare('SELECT * FROM vouchers').all()));

router.post('/vouchers', (req, res) => {
  const { code, discountType, discountValue, minOrder, maxUses, validFrom, validUntil } = req.body;
  const id = uuid();
  const finalCode = code.toUpperCase();
  db.prepare('INSERT INTO vouchers (id, code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, finalCode, discountType, discountValue, minOrder || 0, maxUses || 100, validFrom, validUntil);
  logActivity(req, 'voucher.create', 'voucher', id, { code: finalCode, discountType, discountValue });
  res.status(201).json({ id });
});

router.put('/vouchers/:id/toggle', (req, res) => {
  const voucher = db.prepare('SELECT * FROM vouchers WHERE id = ?').get(req.params.id);
  if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
  const nextActive = voucher.active ? 0 : 1;
  db.prepare('UPDATE vouchers SET active = ? WHERE id = ?').run(nextActive, req.params.id);
  logActivity(req, nextActive ? 'voucher.activate' : 'voucher.deactivate', 'voucher', req.params.id, { code: voucher.code });
  res.json({ message: 'Updated', active: !!nextActive });
});

router.delete('/vouchers/:id', (req, res) => {
  const voucher = db.prepare('SELECT code FROM vouchers WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM vouchers WHERE id = ?').run(req.params.id);
  if (voucher) logActivity(req, 'voucher.delete', 'voucher', req.params.id, { code: voucher.code });
  res.json({ message: 'Deleted' });
});

// Announcements
router.get('/announcements', (req, res) => res.json(db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all()));

router.post('/announcements', (req, res) => {
  const { title, content, type } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO announcements (id, title, content, type) VALUES (?,?,?,?)').run(id, title, content, type || 'info');
  logActivity(req, 'announcement.create', 'announcement', id, { title });
  res.status(201).json({ id });
});

router.delete('/announcements/:id', (req, res) => {
  const announcement = db.prepare('SELECT title FROM announcements WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  if (announcement) logActivity(req, 'announcement.delete', 'announcement', req.params.id, { title: announcement.title });
  res.json({ message: 'Deleted' });
});

// Audit trail
router.get('/audit-logs', (req, res) => {
  const { userId, role, action, limit } = req.query;
  const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 500);
  let sql = `
    SELECT a.*, u.first_name, u.last_name, u.email, u.role as user_role, u.staff_code
    FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (userId) { sql += ' AND a.user_id = ?'; params.push(userId); }
  if (role) { sql += ' AND u.role = ?'; params.push(role); }
  if (action) { sql += ' AND a.action = ?'; params.push(action); }
  sql += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(cappedLimit);
  const logs = db.prepare(sql).all(...params);
  res.json(logs.map(l => ({ ...l, details: l.details ? JSON.parse(l.details) : null })));
});

// Reports
router.get('/reports/sales', (req, res) => {
  const byMonth = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as orders, SUM(total) as revenue
    FROM orders WHERE payment_status='paid' GROUP BY month ORDER BY month DESC LIMIT 12
  `).all();
  const byCategory = db.prepare(`
    SELECT c.name, SUM(oi.quantity * oi.price) as revenue, SUM(oi.quantity) as units
    FROM order_items oi JOIN products p ON oi.product_id=p.id JOIN categories c ON p.category_id=c.id
    GROUP BY c.name ORDER BY revenue DESC
  `).all();
  res.json({ byMonth, byCategory });
});

export default router;
