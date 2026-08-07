import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const RATING_COLUMNS = `
  (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.product_id = p.id) as avg_rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as review_count
`;

router.get('/my', authenticate, (req, res) => {
  const items = db.prepare(`
    SELECT w.created_at as wishlisted_at, p.*, c.name as category_name, c.slug as category_slug, ${RATING_COLUMNS}
    FROM wishlists w
    JOIN products p ON w.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE w.user_id = ? AND (p.archived IS NULL OR p.archived = 0) AND (p.status IS NULL OR p.status = 'active')
    ORDER BY w.created_at DESC
  `).all(req.user.id);
  res.json(items.map(p => ({
    ...p,
    specifications: p.specifications ? JSON.parse(p.specifications) : {},
    featured: !!p.featured,
  })));
});

router.post('/', authenticate, (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'Product is required' });

  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const existing = db.prepare('SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?').get(req.user.id, productId);
  if (existing) return res.status(200).json({ message: 'Already in wishlist' });

  db.prepare('INSERT INTO wishlists (id, user_id, product_id) VALUES (?,?,?)').run(uuid(), req.user.id, productId);
  res.status(201).json({ message: 'Added to wishlist' });
});

router.delete('/:productId', authenticate, (req, res) => {
  const existing = db.prepare('SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?').get(req.user.id, req.params.productId);
  if (!existing) return res.status(404).json({ error: 'Item not found in wishlist' });
  db.prepare('DELETE FROM wishlists WHERE id = ?').run(existing.id);
  res.json({ message: 'Removed from wishlist' });
});

export default router;
