import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { category, search } = req.query;
  let sql = "SELECT * FROM services WHERE (archived IS NULL OR archived = 0) AND (status IS NULL OR status = 'active')";
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (search) { sql += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY category, name';
  res.json(db.prepare(sql).all(...params));
});

router.get('/categories', (req, res) => {
  const cats = db.prepare('SELECT DISTINCT category FROM services ORDER BY category').all();
  res.json(cats.map(c => c.category));
});

router.get('/:slug', (req, res) => {
  const service = db.prepare("SELECT * FROM services WHERE slug = ? AND (archived IS NULL OR archived = 0) AND (status IS NULL OR status = 'active')").get(req.params.slug);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

export default router;
