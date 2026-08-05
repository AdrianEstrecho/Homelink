import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate, authorize, authorizeAdminOr } from '../middleware/auth.js';
import { logActivity } from '../utils/audit.js';
import { generateStaffCode } from '../utils/staffCode.js';
import { notifyUser } from '../utils/notify.js';
import { createChangeRequest } from '../utils/changeRequests.js';

const router = Router();
router.use(authenticate);

// Shared by the admin dashboard and the Accounting payroll dashboard so both read the
// same figures instead of duplicating the revenue queries.
function getRevenueStats() {
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) as t FROM orders WHERE payment_status='paid'").get().t +
                  db.prepare("SELECT COALESCE(SUM(price),0) as t FROM bookings WHERE payment_status='paid'").get().t;
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
  return { revenue, salesByMonth };
}

router.get('/dashboard', authorize('admin'), (req, res) => {
  const { revenue, salesByMonth } = getRevenueStats();
  const stats = {
    totalCustomers: db.prepare("SELECT COUNT(*) as c FROM users WHERE role='customer'").get().c,
    totalEmployees: db.prepare("SELECT COUNT(*) as c FROM users WHERE role='employee'").get().c,
    totalProducts: db.prepare("SELECT COUNT(*) as c FROM products WHERE (archived IS NULL OR archived = 0)").get().c,
    totalOrders: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
    totalBookings: db.prepare('SELECT COUNT(*) as c FROM bookings').get().c,
    revenue,
    pendingOrders: db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='pending'").get().c,
    pendingBookings: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status='pending'").get().c,
    lowStockCount: db.prepare("SELECT COUNT(*) as c FROM products WHERE stock > 0 AND stock <= 5 AND (archived IS NULL OR archived = 0)").get().c,
    outOfStockCount: db.prepare("SELECT COUNT(*) as c FROM products WHERE stock = 0 AND (archived IS NULL OR archived = 0)").get().c,
  };
  const orderStatusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count FROM orders GROUP BY status
  `).all();
  const recentOrders = db.prepare('SELECT o.*, u.first_name, u.last_name FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 5').all();
  const recentBookings = db.prepare('SELECT b.*, s.name as service_name, u.first_name, u.last_name FROM bookings b JOIN services s ON b.service_id=s.id JOIN users u ON b.user_id=u.id ORDER BY b.created_at DESC LIMIT 5').all();
  res.json({ stats, orderStatusBreakdown, salesByMonth, recentOrders, recentBookings });
});

// Users
const EMPLOYEE_POSITIONS = ['inventory_clerk', 'booking_coordinator', 'installer', 'accounting', 'hr', 'general_staff'];

// general_staff and inventory_clerk have no User Management page of their own — this
// stays open to them only because Bookings' technician-assignment dropdown queries it
// (?role=employee&position=installer) alongside admins and booking coordinators.
router.get('/users', authorizeAdminOr('booking_coordinator', 'general_staff', 'inventory_clerk', 'hr'), (req, res) => {
  const { role, position } = req.query;
  let sql = 'SELECT id, email, first_name, last_name, phone, address, role, position, staff_code, archived, created_at FROM users WHERE 1=1';
  const params = [];
  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (position) { sql += ' AND position = ?'; params.push(position); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params).map(u => ({ ...u, archived: !!u.archived })));
});

function insertEmployeeAccount({ email, passwordHash, firstName, lastName, phone, role, position }) {
  const id = uuid();
  const finalPosition = role === 'employee' && EMPLOYEE_POSITIONS.includes(position) ? position : null;
  const staffCode = role !== 'customer' ? generateStaffCode(role, finalPosition) : null;
  db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, role, position, staff_code, verified) VALUES (?,?,?,?,?,?,?,?,?,1)')
    .run(id, email, passwordHash, firstName, lastName, phone || '', role, finalPosition, staffCode);
  return { id, staffCode };
}

// HR can onboard new employees (any position) alongside admin, but may never mint an
// admin account this way — their requested role is always forced to 'employee'. Unlike
// admin, HR's onboarding is only *proposed*: it's queued as a change request until an
// admin reviews and approves it (see the "Change requests" section further down).
router.post('/users', authorizeAdminOr('hr'), async (req, res) => {
  const { email, password, firstName, lastName, phone, role, position } = req.body;
  const finalRole = req.user.role === 'admin' ? (role || 'employee') : 'employee';
  if (finalRole === 'employee' && position && !EMPLOYEE_POSITIONS.includes(position)) {
    return res.status(400).json({ error: 'Invalid position' });
  }
  const passwordHash = await bcrypt.hash(password || 'employee123', 10);

  if (req.user.role !== 'admin') {
    const requestId = createChangeRequest('employee', 'create', null, {
      email: email.toLowerCase(), passwordHash, firstName, lastName, phone: phone || '', position: position || null,
    }, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for admin approval.' });
  }

  const { id, staffCode } = insertEmployeeAccount({ email: email.toLowerCase(), passwordHash, firstName, lastName, phone, role: finalRole, position });
  logActivity(req, 'user.create', 'user', id, { email: email.toLowerCase(), role: finalRole, position: finalRole === 'employee' ? position : null, staffCode });
  res.status(201).json({ id, staffCode });
});

// A staff code is assigned once and kept even if the position changes later.
function applyEmployeePromotion(id, position) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return { error: 'User not found', status: 404 };
  if (user.role === 'admin') return { error: 'Cannot change an administrator this way', status: 400 };
  const staffCode = user.staff_code || generateStaffCode('employee', position);
  db.prepare("UPDATE users SET role = 'employee', position = ?, staff_code = ? WHERE id = ?").run(position, staffCode, id);
  return { user, staffCode };
}

// Promote a customer to employee (with a position), or change an existing employee's
// position. Same admin-immediate / HR-proposed split as onboarding above.
router.put('/users/:id/promote', authorizeAdminOr('hr'), (req, res) => {
  const { position } = req.body;
  if (!EMPLOYEE_POSITIONS.includes(position)) return res.status(400).json({ error: 'Invalid position' });

  if (req.user.role !== 'admin') {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot change an administrator this way' });
    const requestId = createChangeRequest('employee', 'update', req.params.id, { position }, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for admin approval.' });
  }

  const result = applyEmployeePromotion(req.params.id, position);
  if (result.error) return res.status(result.status).json({ error: result.error });
  logActivity(req, 'user.promote', 'user', req.params.id, { email: result.user.email, fromRole: result.user.role, fromPosition: result.user.position, toPosition: position, staffCode: result.staffCode });
  res.json({ message: 'User promoted', position, staffCode: result.staffCode });
});

function archiveEmployee(id) {
  const user = db.prepare('SELECT email, role FROM users WHERE id = ?').get(id);
  if (!user) return { error: 'User not found', status: 404 };
  if (user.role === 'admin') return { error: 'Cannot archive an administrator', status: 400 };
  db.prepare('UPDATE users SET archived = 1 WHERE id = ?').run(id);
  return { user };
}

function restoreEmployee(id) {
  const user = db.prepare('SELECT email, role FROM users WHERE id = ?').get(id);
  if (!user) return { error: 'User not found', status: 404 };
  db.prepare('UPDATE users SET archived = 0 WHERE id = ?').run(id);
  return { user };
}

function deleteEmployeeById(id) {
  const user = db.prepare('SELECT email, role FROM users WHERE id = ?').get(id);
  const result = db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(id, 'admin');
  return result.changes > 0 ? user : null;
}

// Archiving a user revokes their ability to log in but keeps their data intact and
// reversible — unlike the permanent delete below, which is only reachable from the
// Archived Users view. Same admin-immediate / HR-proposed split as onboarding and promotion.
router.put('/users/:id/archive', authorizeAdminOr('hr'), (req, res) => {
  if (req.user.role !== 'admin') {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot archive an administrator' });
    const requestId = createChangeRequest('employee', 'archive', req.params.id, null, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for admin approval.' });
  }
  const result = archiveEmployee(req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  logActivity(req, 'user.archive', 'user', req.params.id, { email: result.user.email, role: result.user.role });
  res.json({ message: 'User archived' });
});

router.put('/users/:id/restore', authorizeAdminOr('hr'), (req, res) => {
  if (req.user.role !== 'admin') {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const requestId = createChangeRequest('employee', 'restore', req.params.id, null, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for admin approval.' });
  }
  const result = restoreEmployee(req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  logActivity(req, 'user.restore', 'user', req.params.id, { email: result.user.email, role: result.user.role });
  res.json({ message: 'User restored' });
});

// Permanent delete stays reachable only from the Archived Users view (same as before) but
// is now also open to HR — proposed as a change request rather than applied immediately,
// since it's irreversible.
router.delete('/users/:id', authorizeAdminOr('hr'), (req, res) => {
  if (req.user.role !== 'admin') {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot delete an administrator' });
    const requestId = createChangeRequest('employee', 'delete', req.params.id, null, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Deletion request submitted for admin approval.' });
  }
  const user = deleteEmployeeById(req.params.id);
  if (user) logActivity(req, 'user.delete', 'user', req.params.id, { email: user.email, role: user.role });
  res.json({ message: 'User deleted' });
});

// Products — inventory clerks add/edit/archive/delete alongside admins. General staff may
// also add/edit/delete, but those writes are only *proposed*: they're queued as a change
// request until an inventory clerk or admin reviews and approves them. Archive/restore
// stay immediate for everyone since hiding/showing an existing item is low-risk and reversible.
router.get('/products', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
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

router.get('/products/stats', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
  const totalProducts = db.prepare("SELECT COUNT(*) as c FROM products WHERE (archived IS NULL OR archived = 0)").get().c;
  const archivedCount = db.prepare("SELECT COUNT(*) as c FROM products WHERE archived = 1").get().c;
  const lowStockCount = db.prepare("SELECT COUNT(*) as c FROM products WHERE stock > 0 AND stock <= 5 AND (archived IS NULL OR archived = 0)").get().c;
  const outOfStockCount = db.prepare("SELECT COUNT(*) as c FROM products WHERE stock = 0 AND (archived IS NULL OR archived = 0)").get().c;
  const categoryBreakdown = db.prepare(`
    SELECT COALESCE(pc.name, c.name) as name, COUNT(*) as count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE (p.archived IS NULL OR p.archived = 0)
    GROUP BY COALESCE(pc.name, c.name) ORDER BY count DESC LIMIT 6
  `).all();
  const recentProducts = db.prepare(`
    SELECT id, name, stock, price, status, created_at FROM products
    WHERE (archived IS NULL OR archived = 0) ORDER BY created_at DESC LIMIT 5
  `).all();
  res.json({ totalProducts, archivedCount, lowStockCount, outOfStockCount, categoryBreakdown, recentProducts });
});

function insertProduct(payload) {
  const { name, slug, categoryId, description, specifications, price, stock, image, featured, brand, discount, status } = payload;
  const id = uuid();
  db.prepare('INSERT INTO products (id, category_id, name, slug, description, specifications, price, stock, image, featured, brand, discount, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, categoryId, name, slug, description, JSON.stringify(specifications || {}), price, stock, image, featured ? 1 : 0, brand || null, Number(discount) || 0, status === 'inactive' ? 'inactive' : 'active');
  return id;
}

// Never lets the stock number be typed directly — it can only move via an "add stock"
// delta, so the audit trail always shows the quantity that was actually added.
function applyProductUpdate(id, payload) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return null;
  const { name, categoryId, description, specifications, price, image, featured, brand, discount, status, addStock } = payload;
  const addQty = Number(addStock) || 0;
  const stock = addQty > 0 ? product.stock + addQty : product.stock;
  db.prepare('UPDATE products SET name=?, category_id=?, description=?, specifications=?, price=?, stock=?, image=?, featured=?, brand=?, discount=?, status=? WHERE id=?')
    .run(name, categoryId, description, JSON.stringify(specifications || {}), price, stock, image, featured ? 1 : 0, brand || null, Number(discount) || 0, status === 'inactive' ? 'inactive' : 'active', id);
  return { from: product.stock, to: stock, addQty };
}

function deleteProductById(id) {
  const product = db.prepare('SELECT name FROM products WHERE id = ?').get(id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return product;
}

router.post('/products', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
  if (req.user.position === 'general_staff') {
    const requestId = createChangeRequest('product', 'create', null, req.body, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for clerk approval.' });
  }
  const id = insertProduct(req.body);
  logActivity(req, 'product.create', 'product', id, { name: req.body.name });
  res.status(201).json({ id });
});

router.put('/products/:id', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
  if (req.user.position === 'general_staff') {
    const exists = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Product not found' });
    const requestId = createChangeRequest('product', 'update', req.params.id, req.body, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for clerk approval.' });
  }

  const result = applyProductUpdate(req.params.id, req.body);
  if (!result) return res.status(404).json({ error: 'Product not found' });
  logActivity(req, 'product.update', 'product', req.params.id, { name: req.body.name });
  if (result.addQty > 0) {
    const actor = db.prepare('SELECT first_name, last_name, staff_code FROM users WHERE id = ?').get(req.user.id);
    logActivity(req, 'product.restock', 'product', req.params.id, {
      name: req.body.name, quantity: result.addQty, from: result.from, to: result.to,
      clerkCode: actor.staff_code, clerkName: `${actor.first_name} ${actor.last_name}`,
    });
  }
  res.json({ message: 'Updated', stock: result.to });
});

router.put('/products/:id/archive', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
  const product = db.prepare('SELECT name FROM products WHERE id = ?').get(req.params.id);
  db.prepare("UPDATE products SET archived = 1, status = 'inactive' WHERE id = ?").run(req.params.id);
  logActivity(req, 'product.archive', 'product', req.params.id, { name: product?.name });
  res.json({ message: 'Product archived' });
});

router.put('/products/:id/restore', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
  const product = db.prepare('SELECT name FROM products WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE products SET archived = 0 WHERE id = ?').run(req.params.id);
  logActivity(req, 'product.restore', 'product', req.params.id, { name: product?.name });
  res.json({ message: 'Product restored' });
});

router.delete('/products/:id', authorizeAdminOr('general_staff'), (req, res) => {
  if (req.user.position === 'general_staff') {
    const exists = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Product not found' });
    const requestId = createChangeRequest('product', 'delete', req.params.id, null, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Deletion request submitted for clerk approval.' });
  }
  const product = deleteProductById(req.params.id);
  if (product) logActivity(req, 'product.delete', 'product', req.params.id, { name: product.name });
  res.json({ message: 'Deleted' });
});

// Categories — read is open to anyone who can view products (needed to render the product
// form); creating one (the "add subcategory" flow) stays clerk/admin-only, and
// renaming/deleting a category stays admin-only.
router.get('/categories', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

router.post('/categories', authorizeAdminOr('inventory_clerk'), (req, res) => {
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

router.put('/categories/:id', authorize('admin'), (req, res) => {
  const { name, description, image } = req.body;
  db.prepare('UPDATE categories SET name=?, description=?, image=? WHERE id=?').run(name, description, image, req.params.id);
  logActivity(req, 'category.update', 'category', req.params.id, { name });
  res.json({ message: 'Updated' });
});

router.delete('/categories/:id', authorize('admin'), (req, res) => {
  const category = db.prepare('SELECT name FROM categories WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (category) logActivity(req, 'category.delete', 'category', req.params.id, { name: category.name });
  res.json({ message: 'Deleted' });
});

// Services — same split as products: inventory clerks add/edit/archive/delete alongside
// admins; general staff propose the same actions as change requests for a clerk/admin to
// approve.
router.get('/services', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY archived ASC, name ASC').all();
  res.json(services.map(s => ({ ...s, archived: !!s.archived })));
});

function insertService(payload) {
  const { name, slug, description, category, basePrice, durationHours, image, discount, status } = payload;
  const id = uuid();
  db.prepare('INSERT INTO services (id, name, slug, description, category, base_price, duration_hours, image, discount, status) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, name, slug, description, category, basePrice, durationHours || 2, image, Number(discount) || 0, status === 'inactive' ? 'inactive' : 'active');
  return id;
}

function applyServiceUpdate(id, payload) {
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!service) return null;
  const { name, description, category, basePrice, durationHours, image, discount, status } = payload;
  db.prepare('UPDATE services SET name=?, description=?, category=?, base_price=?, duration_hours=?, image=?, discount=?, status=? WHERE id=?')
    .run(name, description, category, basePrice, durationHours, image, Number(discount) || 0, status === 'inactive' ? 'inactive' : 'active', id);
  return service;
}

function deleteServiceById(id) {
  const service = db.prepare('SELECT name FROM services WHERE id = ?').get(id);
  db.prepare('DELETE FROM services WHERE id = ?').run(id);
  return service;
}

router.post('/services', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
  if (req.user.position === 'general_staff') {
    const requestId = createChangeRequest('service', 'create', null, req.body, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for clerk approval.' });
  }
  const id = insertService(req.body);
  logActivity(req, 'service.create', 'service', id, { name: req.body.name });
  res.status(201).json({ id });
});

router.put('/services/:id', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
  if (req.user.position === 'general_staff') {
    const exists = db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Service not found' });
    const requestId = createChangeRequest('service', 'update', req.params.id, req.body, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for clerk approval.' });
  }
  const service = applyServiceUpdate(req.params.id, req.body);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  logActivity(req, 'service.update', 'service', req.params.id, { name: req.body.name });
  res.json({ message: 'Updated' });
});

router.put('/services/:id/archive', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
  const service = db.prepare('SELECT name FROM services WHERE id = ?').get(req.params.id);
  db.prepare("UPDATE services SET archived = 1, status = 'inactive' WHERE id = ?").run(req.params.id);
  logActivity(req, 'service.archive', 'service', req.params.id, { name: service?.name });
  res.json({ message: 'Service archived' });
});

router.put('/services/:id/restore', authorizeAdminOr('inventory_clerk', 'general_staff'), (req, res) => {
  const service = db.prepare('SELECT name FROM services WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE services SET archived = 0 WHERE id = ?').run(req.params.id);
  logActivity(req, 'service.restore', 'service', req.params.id, { name: service?.name });
  res.json({ message: 'Service restored' });
});

router.delete('/services/:id', authorizeAdminOr('general_staff'), (req, res) => {
  if (req.user.position === 'general_staff') {
    const exists = db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Service not found' });
    const requestId = createChangeRequest('service', 'delete', req.params.id, null, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Deletion request submitted for clerk approval.' });
  }
  const service = deleteServiceById(req.params.id);
  if (service) logActivity(req, 'service.delete', 'service', req.params.id, { name: service.name });
  res.json({ message: 'Deleted' });
});

// Orders — general staff and inventory clerks handle status updates alongside admins.
router.get('/orders', authorizeAdminOr('general_staff', 'inventory_clerk'), (req, res) => {
  const orders = db.prepare('SELECT o.*, u.first_name, u.last_name, u.email FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC').all();
  const result = orders.map(o => ({
    ...o,
    items: db.prepare('SELECT oi.*, p.name FROM order_items oi JOIN products p ON oi.product_id=p.id WHERE oi.order_id=?').all(o.id),
  }));
  res.json(result);
});

router.get('/orders/stats', authorizeAdminOr('general_staff'), (req, res) => {
  const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) as t FROM orders WHERE payment_status='paid'").get().t;
  const statusBreakdown = db.prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status').all();
  const recentOrders = db.prepare('SELECT o.*, u.first_name, u.last_name FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 5').all();
  res.json({ totalOrders, revenue, statusBreakdown, recentOrders });
});

router.put('/orders/:id/status', authorizeAdminOr('general_staff', 'inventory_clerk'), (req, res) => {
  const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
  logActivity(req, 'order.status_update', 'order', req.params.id, { from: order?.status, to: req.body.status });
  res.json({ message: 'Status updated' });
});

// Bookings — booking coordinators (and general staff, inventory clerks) assign technicians and update status alongside admins.
router.get('/bookings', authorizeAdminOr('booking_coordinator', 'general_staff', 'inventory_clerk'), (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, s.name as service_name, u.first_name, u.last_name, u.email, u.phone,
    e.first_name as emp_first, e.last_name as emp_last
    FROM bookings b JOIN services s ON b.service_id=s.id JOIN users u ON b.user_id=u.id
    LEFT JOIN users e ON b.employee_id=e.id ORDER BY b.scheduled_date DESC
  `).all();
  res.json(bookings);
});

router.get('/bookings/stats', authorizeAdminOr('booking_coordinator'), (req, res) => {
  const totalBookings = db.prepare('SELECT COUNT(*) as c FROM bookings').get().c;
  const unassignedCount = db.prepare("SELECT COUNT(*) as c FROM bookings WHERE employee_id IS NULL AND status NOT IN ('cancelled', 'completed')").get().c;
  const todayCount = db.prepare("SELECT COUNT(*) as c FROM bookings WHERE scheduled_date = date('now')").get().c;
  const statusBreakdown = db.prepare('SELECT status, COUNT(*) as count FROM bookings GROUP BY status').all();
  const upcomingBookings = db.prepare(`
    SELECT b.*, s.name as service_name, u.first_name, u.last_name
    FROM bookings b JOIN services s ON b.service_id=s.id JOIN users u ON b.user_id=u.id
    WHERE b.status IN ('pending','confirmed') ORDER BY b.scheduled_date ASC LIMIT 5
  `).all();
  res.json({ totalBookings, unassignedCount, todayCount, statusBreakdown, upcomingBookings });
});

router.put('/bookings/:id', authorizeAdminOr('booking_coordinator', 'general_staff', 'inventory_clerk'), (req, res) => {
  const { status, employeeId } = req.body;
  const booking = db.prepare('SELECT status, employee_id FROM bookings WHERE id = ?').get(req.params.id);
  if (status) {
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);
    logActivity(req, 'booking.status_update', 'booking', req.params.id, { from: booking?.status, to: status });
  }
  if ('employeeId' in req.body) {
    if (employeeId) {
      db.prepare('UPDATE bookings SET employee_id = ?, status = ? WHERE id = ?').run(employeeId, 'confirmed', req.params.id);
      logActivity(req, 'booking.assign', 'booking', req.params.id, { fromEmployeeId: booking?.employee_id, toEmployeeId: employeeId });
      const jobDetails = db.prepare(`
        SELECT s.name as service_name, u.first_name, u.last_name, b.scheduled_date, b.scheduled_time, b.address
        FROM bookings b JOIN services s ON b.service_id = s.id JOIN users u ON b.user_id = u.id
        WHERE b.id = ?
      `).get(req.params.id);
      if (jobDetails) {
        notifyUser(employeeId, 'booking.assigned', 'New Job Assigned',
          `${jobDetails.service_name} for ${jobDetails.first_name} ${jobDetails.last_name} — ${jobDetails.scheduled_date} at ${jobDetails.scheduled_time}`,
          '/employee');
      }
    } else {
      db.prepare('UPDATE bookings SET employee_id = NULL WHERE id = ?').run(req.params.id);
      logActivity(req, 'booking.unassign', 'booking', req.params.id, { fromEmployeeId: booking?.employee_id });
    }
  }
  res.json({ message: 'Updated' });
});

// Vouchers — inventory clerks manage these directly, same as admins; general staff's
// create/delete are only *proposed* (see "Change requests" below) until a clerk or admin
// approves; toggling active/inactive stays immediate for everyone, and there's no edit
// feature yet.
router.get('/vouchers', authorizeAdminOr('general_staff', 'inventory_clerk'), (req, res) => res.json(db.prepare('SELECT * FROM vouchers').all()));

function insertVoucher(payload) {
  const { code, discountType, discountValue, minOrder, maxUses, validFrom, validUntil } = payload;
  const id = uuid();
  const finalCode = code.toUpperCase();
  db.prepare('INSERT INTO vouchers (id, code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, finalCode, discountType, discountValue, minOrder || 0, maxUses || 100, validFrom, validUntil);
  return { id, code: finalCode };
}

function deleteVoucherById(id) {
  const voucher = db.prepare('SELECT code FROM vouchers WHERE id = ?').get(id);
  db.prepare('DELETE FROM vouchers WHERE id = ?').run(id);
  return voucher;
}

router.post('/vouchers', authorizeAdminOr('general_staff', 'inventory_clerk'), (req, res) => {
  if (req.user.position === 'general_staff') {
    const requestId = createChangeRequest('voucher', 'create', null, req.body, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for clerk approval.' });
  }
  const { id, code } = insertVoucher(req.body);
  logActivity(req, 'voucher.create', 'voucher', id, { code, discountType: req.body.discountType, discountValue: req.body.discountValue });
  res.status(201).json({ id });
});

router.put('/vouchers/:id/toggle', authorizeAdminOr('general_staff', 'inventory_clerk'), (req, res) => {
  const voucher = db.prepare('SELECT * FROM vouchers WHERE id = ?').get(req.params.id);
  if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
  const nextActive = voucher.active ? 0 : 1;
  db.prepare('UPDATE vouchers SET active = ? WHERE id = ?').run(nextActive, req.params.id);
  logActivity(req, nextActive ? 'voucher.activate' : 'voucher.deactivate', 'voucher', req.params.id, { code: voucher.code });
  res.json({ message: 'Updated', active: !!nextActive });
});

router.delete('/vouchers/:id', authorizeAdminOr('general_staff', 'inventory_clerk'), (req, res) => {
  if (req.user.position === 'general_staff') {
    const exists = db.prepare('SELECT id FROM vouchers WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Voucher not found' });
    const requestId = createChangeRequest('voucher', 'delete', req.params.id, null, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Deletion request submitted for clerk approval.' });
  }
  const voucher = deleteVoucherById(req.params.id);
  if (voucher) logActivity(req, 'voucher.delete', 'voucher', req.params.id, { code: voucher.code });
  res.json({ message: 'Deleted' });
});

// Support messages — general staff and inventory clerks handle these day-to-day alongside admins.
router.get('/support-messages', authorizeAdminOr('general_staff', 'inventory_clerk'), (req, res) => {
  const messages = db.prepare(`
    SELECT s.*, u.first_name, u.last_name, u.email
    FROM support_messages s JOIN users u ON s.user_id = u.id
    ORDER BY s.status ASC, s.created_at DESC
  `).all();
  res.json(messages);
});

router.put('/support-messages/:id/toggle', authorizeAdminOr('general_staff', 'inventory_clerk'), (req, res) => {
  const msg = db.prepare('SELECT * FROM support_messages WHERE id = ?').get(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  const nextStatus = msg.status === 'open' ? 'resolved' : 'open';
  db.prepare('UPDATE support_messages SET status = ? WHERE id = ?').run(nextStatus, req.params.id);
  logActivity(req, nextStatus === 'resolved' ? 'support.resolve' : 'support.reopen', 'support', req.params.id, { subject: msg.subject });
  res.json({ message: 'Updated', status: nextStatus });
});

// Change requests — general staff's product/service/voucher create/update/delete calls,
// HR's employee/supplier calls, and installers' booking-completion calls above are captured
// here instead of applied immediately. Each entity type has its own reviewer position (an
// admin can always review anything); entity types with no listed position — employee,
// supplier, salary, payment — are admin-only, since there's no peer role to trust with those.
// Approving performs the underlying insert/update/delete and logs it under the normal
// product.*/service.*/voucher.*/user.*/supplier.*/booking.* actions (attributed to the
// reviewer, who is the one actually authorizing it); rejecting it just marks the request
// rejected — nothing happens to the entity.
const APPROVAL_REVIEWER_POSITIONS = {
  product: ['inventory_clerk'],
  service: ['inventory_clerk'],
  voucher: ['inventory_clerk'],
  booking: ['booking_coordinator'],
};
function canReviewApproval(user, entityType) {
  if (user.role === 'admin') return true;
  return (APPROVAL_REVIEWER_POSITIONS[entityType] || []).includes(user.position);
}

router.get('/approvals', authorizeAdminOr('inventory_clerk', 'booking_coordinator'), (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  // Non-admin reviewers only ever see the entity types their own position is scoped to
  // review — an inventory clerk never sees booking requests and vice versa.
  const visibleTypes = req.user.role === 'admin'
    ? null
    : Object.keys(APPROVAL_REVIEWER_POSITIONS).filter(t => APPROVAL_REVIEWER_POSITIONS[t].includes(req.user.position));
  const rows = db.prepare(`
    SELECT cr.*, u.first_name as requester_first_name, u.last_name as requester_last_name, u.staff_code as requester_staff_code,
      u.position as requester_position, r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
    FROM change_requests cr
    JOIN users u ON cr.requested_by = u.id
    LEFT JOIN users r ON cr.reviewed_by = r.id
    WHERE cr.status = ? ${visibleTypes ? `AND cr.entity_type IN (${visibleTypes.map(() => '?').join(',')})` : ''}
    ORDER BY cr.created_at DESC
  `).all(...(visibleTypes ? [status, ...visibleTypes] : [status]));
  res.json(rows.map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : null })));
});

// Lets any employee see the status of change requests they personally submitted — including
// the reviewer's name and rejection note — without exposing everyone else's requests to them.
router.get('/approvals/mine', (req, res) => {
  const rows = db.prepare(`
    SELECT cr.*, r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
    FROM change_requests cr
    LEFT JOIN users r ON cr.reviewed_by = r.id
    WHERE cr.requested_by = ? ORDER BY cr.created_at DESC LIMIT 20
  `).all(req.user.id);
  res.json(rows.map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : null })));
});

router.put('/approvals/:id/approve', authorizeAdminOr('inventory_clerk', 'booking_coordinator'), (req, res) => {
  const cr = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(req.params.id);
  if (!cr) return res.status(404).json({ error: 'Request not found' });
  if (cr.status !== 'pending') return res.status(400).json({ error: 'This request has already been reviewed.' });
  if (!canReviewApproval(req.user, cr.entity_type)) {
    return res.status(403).json({ error: 'You are not authorized to review this request.' });
  }
  const payload = cr.payload ? JSON.parse(cr.payload) : null;
  const reviewer = db.prepare('SELECT first_name, last_name, staff_code FROM users WHERE id = ?').get(req.user.id);

  let entityId = cr.entity_id;
  let logAction = null;
  let logDetails = null;

  if (cr.entity_type === 'product') {
    if (cr.action === 'create') {
      entityId = insertProduct(payload);
      logAction = 'product.create'; logDetails = { name: payload.name };
    } else if (cr.action === 'update') {
      const result = applyProductUpdate(cr.entity_id, payload);
      if (!result) return res.status(404).json({ error: 'The product no longer exists.' });
      logAction = 'product.update'; logDetails = { name: payload.name };
      if (result.addQty > 0) {
        logActivity(req, 'product.restock', 'product', cr.entity_id, {
          name: payload.name, quantity: result.addQty, from: result.from, to: result.to,
          clerkCode: reviewer.staff_code, clerkName: `${reviewer.first_name} ${reviewer.last_name}`,
        });
      }
    } else if (cr.action === 'delete') {
      const product = deleteProductById(cr.entity_id);
      logAction = 'product.delete'; logDetails = { name: product?.name };
    }
  } else if (cr.entity_type === 'service') {
    if (cr.action === 'create') {
      entityId = insertService(payload);
      logAction = 'service.create'; logDetails = { name: payload.name };
    } else if (cr.action === 'update') {
      const service = applyServiceUpdate(cr.entity_id, payload);
      if (!service) return res.status(404).json({ error: 'The service no longer exists.' });
      logAction = 'service.update'; logDetails = { name: payload.name };
    } else if (cr.action === 'delete') {
      const service = deleteServiceById(cr.entity_id);
      logAction = 'service.delete'; logDetails = { name: service?.name };
    }
  } else if (cr.entity_type === 'voucher') {
    if (cr.action === 'create') {
      const created = insertVoucher(payload);
      entityId = created.id;
      logAction = 'voucher.create'; logDetails = { code: created.code, discountType: payload.discountType, discountValue: payload.discountValue };
    } else if (cr.action === 'delete') {
      const voucher = deleteVoucherById(cr.entity_id);
      logAction = 'voucher.delete'; logDetails = { code: voucher?.code };
    }
  } else if (cr.entity_type === 'employee') {
    if (cr.action === 'create') {
      try {
        const { id, staffCode } = insertEmployeeAccount({ ...payload, role: 'employee' });
        entityId = id;
        logAction = 'user.create'; logDetails = { email: payload.email, role: 'employee', position: payload.position, staffCode };
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: 'A user with that email already exists.' });
        throw err;
      }
    } else if (cr.action === 'update') {
      const result = applyEmployeePromotion(cr.entity_id, payload.position);
      if (result.error) return res.status(result.status).json({ error: result.error });
      logAction = 'user.promote'; logDetails = { email: result.user.email, fromPosition: result.user.position, toPosition: payload.position, staffCode: result.staffCode };
    } else if (cr.action === 'archive') {
      const result = archiveEmployee(cr.entity_id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      logAction = 'user.archive'; logDetails = { email: result.user.email, role: result.user.role };
    } else if (cr.action === 'restore') {
      const result = restoreEmployee(cr.entity_id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      logAction = 'user.restore'; logDetails = { email: result.user.email, role: result.user.role };
    } else if (cr.action === 'delete') {
      const user = deleteEmployeeById(cr.entity_id);
      if (user) { logAction = 'user.delete'; logDetails = { email: user.email, role: user.role }; }
    }
  } else if (cr.entity_type === 'supplier') {
    if (cr.action === 'create') {
      entityId = insertSupplier(payload);
      logAction = 'supplier.create'; logDetails = { name: payload.name };
    } else if (cr.action === 'update') {
      const supplier = applySupplierUpdate(cr.entity_id, payload);
      if (!supplier) return res.status(404).json({ error: 'The supplier no longer exists.' });
      logAction = 'supplier.update'; logDetails = { name: payload.name };
    } else if (cr.action === 'delete') {
      const supplier = deleteSupplierById(cr.entity_id);
      logAction = 'supplier.delete'; logDetails = { name: supplier?.name };
    }
  } else if (cr.entity_type === 'salary') {
    const changes = Array.isArray(payload.changes) ? payload.changes : [];
    const applied = [];
    for (const c of changes) {
      const employee = db.prepare("SELECT email, salary FROM users WHERE id = ? AND role='employee'").get(c.id);
      if (!employee) continue;
      const salary = Math.max(0, Number(c.salary) || 0);
      db.prepare('UPDATE users SET salary = ? WHERE id = ?').run(salary, c.id);
      applied.push({ id: c.id, email: employee.email, from: employee.salary, to: salary });
    }
    if (applied.length === 0) return res.status(404).json({ error: 'None of these employees exist anymore.' });
    // Each employee's change is its own audit-log entry, so this bypasses the single
    // logAction/logDetails path used below and logs directly instead.
    applied.forEach(a => logActivity(req, 'salary.update', 'user', a.id, { email: a.email, from: a.from, to: a.to, authorizedBy: reviewer.staff_code, requestedBy: cr.requested_by }));
  } else if (cr.entity_type === 'payment') {
    // The bank account was already saved onto the recipient's record when the payment was
    // submitted — approving just authorizes the payout itself, logged against that recipient.
    logAction = 'payment.pay'; logDetails = payload;
  } else if (cr.entity_type === 'booking') {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(cr.entity_id);
    if (!booking) return res.status(404).json({ error: 'The booking no longer exists.' });
    db.prepare('UPDATE bookings SET status = ?, completion_notes = ? WHERE id = ?').run(payload.status, payload.completionNotes || '', cr.entity_id);
    const jobDetails = db.prepare(`
      SELECT s.name as service_name, u.first_name, u.last_name
      FROM bookings b JOIN services s ON b.service_id = s.id JOIN users u ON b.user_id = u.id
      WHERE b.id = ?
    `).get(cr.entity_id);
    const installer = db.prepare('SELECT id, first_name, last_name FROM users WHERE id = ?').get(cr.requested_by);
    const serviceName = jobDetails?.service_name || 'Service';
    const customerName = jobDetails ? `${jobDetails.first_name} ${jobDetails.last_name}` : 'a customer';
    const installerName = installer ? `${installer.first_name} ${installer.last_name}` : 'The installer';
    logAction = 'booking.completed';
    logDetails = { serviceName, customerName, installerName, completionNotes: payload.completionNotes || undefined };
    if (installer) {
      notifyUser(installer.id, 'booking.completed', 'Completion Verified', `${reviewer.first_name} ${reviewer.last_name} verified your completion of ${serviceName} for ${customerName}.`, '/employee');
    }
  }

  db.prepare("UPDATE change_requests SET status='approved', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?").run(req.user.id, cr.id);
  if (logAction) logActivity(req, logAction, cr.entity_type, entityId, { ...logDetails, authorizedBy: reviewer.staff_code, requestedBy: cr.requested_by });
  res.json({ message: 'Approved' });
});

router.put('/approvals/:id/reject', authorizeAdminOr('inventory_clerk', 'booking_coordinator'), (req, res) => {
  const cr = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(req.params.id);
  if (!cr) return res.status(404).json({ error: 'Request not found' });
  if (cr.status !== 'pending') return res.status(400).json({ error: 'This request has already been reviewed.' });
  if (!canReviewApproval(req.user, cr.entity_type)) {
    return res.status(403).json({ error: 'You are not authorized to review this request.' });
  }
  db.prepare("UPDATE change_requests SET status='rejected', reviewed_by=?, reviewed_at=datetime('now'), review_note=? WHERE id=?")
    .run(req.user.id, (req.body.note || '').trim() || null, cr.id);
  res.json({ message: 'Rejected' });
});

// Announcements
router.get('/announcements', authorize('admin'), (req, res) => res.json(db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all()));

router.post('/announcements', authorize('admin'), (req, res) => {
  const { title, content, type } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO announcements (id, title, content, type) VALUES (?,?,?,?)').run(id, title, content, type || 'info');
  logActivity(req, 'announcement.create', 'announcement', id, { title });
  res.status(201).json({ id });
});

router.delete('/announcements/:id', authorize('admin'), (req, res) => {
  const announcement = db.prepare('SELECT title FROM announcements WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  if (announcement) logActivity(req, 'announcement.delete', 'announcement', req.params.id, { title: announcement.title });
  res.json({ message: 'Deleted' });
});

// Audit trail
router.get('/audit-logs', authorize('admin'), (req, res) => {
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
  if (action) {
    const actions = action.split(',').map(a => a.trim()).filter(Boolean);
    sql += ` AND a.action IN (${actions.map(() => '?').join(',')})`;
    params.push(...actions);
  }
  sql += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(cappedLimit);
  const logs = db.prepare(sql).all(...params);
  res.json(logs.map(l => ({ ...l, details: l.details ? JSON.parse(l.details) : null })));
});

function insertSupplier(payload) {
  const { name, contactName, email, phone, address, category, notes } = payload;
  const id = uuid();
  db.prepare('INSERT INTO suppliers (id, name, contact_name, email, phone, address, category, notes) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, name, contactName || null, email || null, phone || null, address || null, category || null, notes || null);
  return id;
}

function applySupplierUpdate(id, payload) {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  if (!supplier) return null;
  const { name, contactName, email, phone, address, category, notes } = payload;
  db.prepare('UPDATE suppliers SET name=?, contact_name=?, email=?, phone=?, address=?, category=?, notes=? WHERE id=?')
    .run(name, contactName || null, email || null, phone || null, address || null, category || null, notes || null, id);
  return supplier;
}

function deleteSupplierById(id) {
  const supplier = db.prepare('SELECT name FROM suppliers WHERE id = ?').get(id);
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
  return supplier;
}

// Suppliers — HR manages the vendor list, but (like general_staff's product/service/voucher
// writes) HR's create/update/delete are only *proposed*: they're queued as a change request
// until admin approves them. Toggling active/inactive stays immediate for HR, same as the
// equivalent voucher/product toggles, since it's low-risk and reversible.
// Accounting gets read access too (not the write routes below) so it can pay suppliers
// from the Payroll page without touching the HR-owned vendor-management writes.
router.get('/suppliers', authorizeAdminOr('hr', 'accounting'), (req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY status ASC, name ASC').all());
});

router.post('/suppliers', authorizeAdminOr('hr'), (req, res) => {
  if (req.user.role !== 'admin') {
    const requestId = createChangeRequest('supplier', 'create', null, req.body, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for admin approval.' });
  }
  const id = insertSupplier(req.body);
  logActivity(req, 'supplier.create', 'supplier', id, { name: req.body.name });
  res.status(201).json({ id });
});

router.put('/suppliers/:id', authorizeAdminOr('hr'), (req, res) => {
  if (req.user.role !== 'admin') {
    const exists = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Supplier not found' });
    const requestId = createChangeRequest('supplier', 'update', req.params.id, req.body, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for admin approval.' });
  }
  const supplier = applySupplierUpdate(req.params.id, req.body);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  logActivity(req, 'supplier.update', 'supplier', req.params.id, { name: req.body.name });
  res.json({ message: 'Updated' });
});

router.put('/suppliers/:id/toggle', authorizeAdminOr('hr'), (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  const nextStatus = supplier.status === 'active' ? 'inactive' : 'active';
  db.prepare('UPDATE suppliers SET status = ? WHERE id = ?').run(nextStatus, req.params.id);
  logActivity(req, nextStatus === 'active' ? 'supplier.activate' : 'supplier.deactivate', 'supplier', req.params.id, { name: supplier.name });
  res.json({ message: 'Updated', status: nextStatus });
});

router.delete('/suppliers/:id', authorizeAdminOr('hr'), (req, res) => {
  if (req.user.role !== 'admin') {
    const exists = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Supplier not found' });
    const requestId = createChangeRequest('supplier', 'delete', req.params.id, null, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Deletion request submitted for admin approval.' });
  }
  const supplier = deleteSupplierById(req.params.id);
  if (supplier) logActivity(req, 'supplier.delete', 'supplier', req.params.id, { name: supplier.name });
  res.json({ message: 'Deleted' });
});

// HR dashboard — employee headcount, the onboarding pool (customers), and vendor stats.
router.get('/hr/stats', authorizeAdminOr('hr'), (req, res) => {
  const totalEmployees = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='employee'").get().c;
  const totalCustomers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='customer'").get().c;
  const positionBreakdown = db.prepare(`
    SELECT COALESCE(position, 'unassigned') as position, COUNT(*) as count
    FROM users WHERE role='employee' GROUP BY position
  `).all();
  const supplierStats = {
    total: db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c,
    active: db.prepare("SELECT COUNT(*) as c FROM suppliers WHERE status='active'").get().c,
  };
  const recentHires = db.prepare(`
    SELECT id, first_name, last_name, email, position, staff_code, created_at
    FROM users WHERE role='employee' ORDER BY created_at DESC LIMIT 5
  `).all();
  res.json({ totalEmployees, totalCustomers, positionBreakdown, supplierStats, recentHires });
});

// Payroll — Accounting sets base salaries and sees revenue vs. payroll cost. Salary is a
// simple fixed monthly figure per employee rather than computed from bookings, so the
// numbers here stay stable regardless of job volume.
router.get('/payroll', authorizeAdminOr('accounting'), (req, res) => {
  const employees = db.prepare(`
    SELECT id, first_name, last_name, email, position, staff_code, salary, bank_name, bank_account_number, bank_account_name
    FROM users WHERE role='employee' ORDER BY position ASC, first_name ASC
  `).all();
  res.json(employees);
});

// Salaries are saved as one batch rather than row-by-row — Accounting edits several
// employees' figures on the page and submits them together. Same admin-immediate /
// proposed-for-approval split as HR's employee and supplier writes above: for Accounting
// it's only *proposed* as a single change request covering every changed employee, until
// an admin reviews and approves it.
router.put('/payroll/salaries', authorizeAdminOr('accounting'), (req, res) => {
  const submitted = Array.isArray(req.body.changes) ? req.body.changes : [];
  if (submitted.length === 0) return res.status(400).json({ error: 'No changes submitted.' });

  const employees = db.prepare("SELECT id, email, first_name, last_name, salary FROM users WHERE role='employee'").all();
  const byId = Object.fromEntries(employees.map(e => [e.id, e]));

  const resolved = submitted
    .map(c => ({ salary: Math.max(0, Number(c.salary) || 0), employee: byId[c.id] }))
    .filter(c => c.employee && Number(c.employee.salary || 0) !== c.salary);

  if (resolved.length === 0) return res.status(400).json({ error: 'No changes to submit.' });

  if (req.user.role !== 'admin') {
    const requestId = createChangeRequest('salary', 'update', null, {
      changes: resolved.map(c => ({ id: c.employee.id, salary: c.salary, fromSalary: c.employee.salary, employeeName: `${c.employee.first_name} ${c.employee.last_name}` })),
    }, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for admin approval.' });
  }

  const update = db.prepare('UPDATE users SET salary = ? WHERE id = ?');
  db.transaction((items) => { items.forEach(c => update.run(c.salary, c.employee.id)); })(resolved);
  resolved.forEach(c => logActivity(req, 'salary.update', 'user', c.employee.id, { email: c.employee.email, from: c.employee.salary, to: c.salary }));
  res.json({ message: 'Updated', count: resolved.length });
});

// Paying an employee or supplier — captures/updates their bank account on file (saved
// immediately, it's just contact-style data) and, for Accounting, proposes the actual
// payout as a change request an admin must approve before it's considered sent. Admin's
// own payouts go through immediately, same admin-immediate / proposed split as everywhere
// else in this file.
router.post('/payroll/pay', authorizeAdminOr('accounting'), (req, res) => {
  const { recipientType, recipientId, amount, bankName, accountNumber, accountName } = req.body;
  if (!['employee', 'supplier'].includes(recipientType)) return res.status(400).json({ error: 'Invalid recipient type' });
  const payAmount = Math.max(0, Number(amount) || 0);
  if (payAmount <= 0) return res.status(400).json({ error: 'Enter an amount to pay.' });
  if (!bankName || !accountNumber || !accountName) return res.status(400).json({ error: 'Bank account details are required.' });

  const table = recipientType === 'employee' ? 'users' : 'suppliers';
  const where = recipientType === 'employee' ? "id = ? AND role='employee'" : 'id = ?';
  const recipient = db.prepare(`SELECT * FROM ${table} WHERE ${where}`).get(recipientId);
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
  const recipientName = recipientType === 'employee' ? `${recipient.first_name} ${recipient.last_name}` : recipient.name;

  db.prepare(`UPDATE ${table} SET bank_name = ?, bank_account_number = ?, bank_account_name = ? WHERE id = ?`)
    .run(bankName, accountNumber, accountName, recipientId);

  const payload = { recipientType, recipientName, amount: payAmount, bankName, accountNumber, accountName };

  if (req.user.role !== 'admin') {
    const requestId = createChangeRequest('payment', 'create', recipientId, payload, req.user.id);
    return res.status(202).json({ pending: true, requestId, message: 'Submitted for admin approval.' });
  }

  logActivity(req, 'payment.pay', recipientType, recipientId, payload);
  res.json({ message: 'Payment recorded' });
});

router.get('/payroll/stats', authorizeAdminOr('accounting'), (req, res) => {
  const { revenue, salesByMonth } = getRevenueStats();
  const employeeCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='employee'").get().c;
  const totalPayroll = db.prepare("SELECT COALESCE(SUM(salary),0) as t FROM users WHERE role='employee'").get().t;
  res.json({ revenue, salesByMonth, totalPayroll, employeeCount, netRevenue: revenue - totalPayroll });
});

// Where the revenue Payroll is funded by actually comes from — Accounting's own
// breakdown of paid orders/bookings by individual product and service, since the
// dashboard total alone doesn't say which items are actually driving it.
router.get('/payroll/revenue-sources', authorizeAdminOr('accounting'), (req, res) => {
  const productRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as t FROM orders WHERE payment_status='paid'").get().t;
  const serviceRevenue = db.prepare("SELECT COALESCE(SUM(price),0) as t FROM bookings WHERE payment_status='paid'").get().t;

  const topProducts = db.prepare(`
    SELECT p.id, p.name, c.name as category_name, SUM(oi.quantity * oi.price) as revenue, SUM(oi.quantity) as units
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE o.payment_status = 'paid'
    GROUP BY p.id ORDER BY revenue DESC LIMIT 10
  `).all();

  const topServices = db.prepare(`
    SELECT s.id, s.name, s.category, SUM(b.price) as revenue, COUNT(*) as bookings
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.payment_status = 'paid'
    GROUP BY s.id ORDER BY revenue DESC LIMIT 10
  `).all();

  res.json({ productRevenue, serviceRevenue, topProducts, topServices });
});

// Reports
router.get('/reports/sales', authorize('admin'), (req, res) => {
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
