import { Router } from 'express';
import db from '../db/database.js';
import { shapeProduct } from '../utils/catalogShape.js';

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
  const { category, search, featured, sort, meta } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  // The filters are shared by the page query and by the count behind it, so the WHERE
  // clause is built once and spliced into both statements.
  let where = `WHERE (p.archived IS NULL OR p.archived = 0) AND (p.status IS NULL OR p.status = 'active')`;
  const params = [];

  if (category) { where += ' AND p.category_id IN (SELECT id FROM categories WHERE slug = ? OR parent_id = (SELECT id FROM categories WHERE slug = ?))'; params.push(category, category); }
  if (search) { where += ' AND (p.name ILIKE ? OR p.description ILIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (featured === 'true') { where += ' AND p.featured = 1'; }

  const products = await db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug, ${RATING_COLUMNS}
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    ${where} ORDER BY ${SORT_COLUMNS[sort] || SORT_COLUMNS.featured} LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  const shaped = products.map(shapeProduct);

  // Callers that just render a fixed slice (the homepage strip, related products) keep the
  // plain array they already expect; ?meta=1 opts into the envelope a pager needs, since the
  // page count can't be derived from a truncated array.
  if (meta !== '1' && meta !== 'true') return res.json(shaped);

  const row = await db.prepare(`SELECT COUNT(*) as total FROM products p ${where}`).get(...params);
  res.json({ products: shaped, total: Number(row.total), limit, offset });
});

router.get('/:slug', async (req, res) => {
  const product = await db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug, ${RATING_COLUMNS}
    FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ? AND (p.archived IS NULL OR p.archived = 0) AND (p.status IS NULL OR p.status = 'active')
  `).get(req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(shapeProduct(product));
});

export default router;
