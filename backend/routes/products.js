import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

const RATING_COLUMNS = `
  (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.product_id = p.id) as avg_rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as review_count
`;

const SORT_COLUMNS = {
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  name: 'p.name ASC',
  featured: 'p.featured DESC, p.name ASC',
};

router.get('/categories', async (req, res) => {
  const categories = await db.prepare(`
    SELECT c.*, (
      SELECT COUNT(*) FROM products p
      WHERE p.category_id IN (SELECT id FROM categories WHERE id = c.id OR parent_id = c.id)
        AND (p.archived IS NULL OR p.archived = 0) AND (p.status IS NULL OR p.status = 'active')
    ) as product_count
    FROM categories c WHERE c.parent_id IS NULL ORDER BY c.name
  `).all();
  res.json(categories);
});

router.get('/', async (req, res) => {
  const { category, search, featured, sort, limit = 50, offset = 0 } = req.query;
  let sql = `SELECT p.*, c.name as category_name, c.slug as category_slug, ${RATING_COLUMNS} FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE (p.archived IS NULL OR p.archived = 0) AND (p.status IS NULL OR p.status = 'active')`;
  const params = [];

  if (category) { sql += ' AND p.category_id IN (SELECT id FROM categories WHERE slug = ? OR parent_id = (SELECT id FROM categories WHERE slug = ?))'; params.push(category, category); }
  if (search) { sql += ' AND (p.name ILIKE ? OR p.description ILIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (featured === 'true') { sql += ' AND p.featured = 1'; }

  sql += ` ORDER BY ${SORT_COLUMNS[sort] || SORT_COLUMNS.featured} LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const products = await db.prepare(sql).all(...params);
  res.json(products.map(p => ({
    ...p,
    specifications: p.specifications ? JSON.parse(p.specifications) : {},
    featured: !!p.featured,
  })));
});

router.get('/:slug', async (req, res) => {
  const product = await db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug, ${RATING_COLUMNS}
    FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ? AND (p.archived IS NULL OR p.archived = 0) AND (p.status IS NULL OR p.status = 'active')
  `).get(req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ ...product, specifications: product.specifications ? JSON.parse(product.specifications) : {}, featured: !!product.featured });
});

export default router;
