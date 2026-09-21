import { Router } from 'express';
import db from '../db/database.js';
import { shapeService } from '../utils/catalogShape.js';

const router = Router();

const ACTIVE = "(archived IS NULL OR archived = 0) AND (status IS NULL OR status = 'active')";

// ?sort=popular ranks by how often a service has been booked (cancelled
// bookings excluded), falling back to name order among equals.
// ?limit caps the row count — service rows carry base64 images, so the
// homepage's top-4 strip shouldn't download the whole catalog.
router.get('/', async (req, res) => {
  const { category, search, sort, limit } = req.query;
  let sql = `SELECT * FROM services WHERE ${ACTIVE}`;
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (search) { sql += ' AND (name ILIKE ? OR description ILIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += sort === 'popular'
    ? " ORDER BY (SELECT COUNT(*) FROM bookings b WHERE b.service_id = services.id AND b.status <> 'cancelled') DESC, name"
    : ' ORDER BY category, name';
  const max = Number.parseInt(limit, 10);
  if (max > 0) { sql += ' LIMIT ?'; params.push(Math.min(max, 100)); }
  res.json((await db.prepare(sql).all(...params)).map(shapeService));
});

// Plain list of category names by default (the admin Services page relies on
// that shape). ?withCounts=1 returns [{ category, count }] over active services
// only, for the public category filter cards.
router.get('/categories', async (req, res) => {
  if (req.query.withCounts) {
    const rows = await db.prepare(`SELECT category, COUNT(*) AS count FROM services WHERE ${ACTIVE} GROUP BY category ORDER BY category`).all();
    return res.json(rows.map(r => ({ category: r.category, count: Number(r.count) })));
  }
  const cats = await db.prepare('SELECT DISTINCT category FROM services ORDER BY category').all();
  res.json(cats.map(c => c.category));
});

router.get('/:slug', async (req, res) => {
  const service = await db.prepare("SELECT * FROM services WHERE slug = ? AND (archived IS NULL OR archived = 0) AND (status IS NULL OR status = 'active')").get(req.params.slug);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(shapeService(service));
});

export default router;
