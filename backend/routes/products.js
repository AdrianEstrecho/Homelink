import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories WHERE parent_id IS NULL ORDER BY name').all();
  res.json(categories);
});

router.get('/', (req, res) => {
  const { category, search, featured, limit = 50, offset = 0 } = req.query;
  let sql = `SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE (p.archived IS NULL OR p.archived = 0) AND (p.status IS NULL OR p.status = 'active')`;
  const params = [];

  if (category) { sql += ' AND p.category_id IN (SELECT id FROM categories WHERE slug = ? OR parent_id = (SELECT id FROM categories WHERE slug = ?))'; params.push(category, category); }
  if (search) { sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (featured === 'true') { sql += ' AND p.featured = 1'; }

  sql += ' ORDER BY p.featured DESC, p.name LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const products = db.prepare(sql).all(...params);
  res.json(products.map(p => ({
    ...p,
    specifications: p.specifications ? JSON.parse(p.specifications) : {},
    featured: !!p.featured,
  })));
});

router.get('/:slug', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ? AND (p.archived IS NULL OR p.archived = 0) AND (p.status IS NULL OR p.status = 'active')
  `).get(req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ ...product, specifications: product.specifications ? JSON.parse(product.specifications) : {}, featured: !!product.featured });
});

export default router;
