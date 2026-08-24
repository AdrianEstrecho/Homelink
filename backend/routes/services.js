import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', async (req, res) => {
  const { category, search } = req.query;
  let sql = "SELECT * FROM services WHERE (archived IS NULL OR archived = 0) AND (status IS NULL OR status = 'active')";
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (search) { sql += ' AND (name ILIKE ? OR description ILIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY category, name';
  res.json(await db.prepare(sql).all(...params));
});

router.get('/categories', async (req, res) => {
  const cats = await db.prepare('SELECT DISTINCT category FROM services ORDER BY category').all();
  res.json(cats.map(c => c.category));
});

router.get('/:slug', async (req, res) => {
  const service = await db.prepare("SELECT * FROM services WHERE slug = ? AND (archived IS NULL OR archived = 0) AND (status IS NULL OR status = 'active')").get(req.params.slug);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

export default router;
