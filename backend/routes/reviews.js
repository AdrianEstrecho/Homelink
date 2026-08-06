import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/featured', (req, res) => {
  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at,
           u.first_name, u.last_name,
           p.name as product_name
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    JOIN products p ON r.product_id = p.id
    WHERE r.rating >= 4 AND TRIM(COALESCE(r.comment, '')) != ''
    ORDER BY r.rating DESC, r.created_at DESC
    LIMIT 6
  `).all();
  res.json(reviews);
});

router.get('/product/:productId', (req, res) => {
  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name
    FROM reviews r JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
  `).all(req.params.productId);
  const count = reviews.length;
  const average = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  res.json({ reviews, average, count });
});

router.get('/my', authenticate, (req, res) => {
  const reviews = db.prepare(`
    SELECT r.*, p.name as product_name, p.image as product_image, p.slug as product_slug
    FROM reviews r JOIN products p ON r.product_id = p.id
    WHERE r.user_id = ? ORDER BY r.created_at DESC
  `).all(req.user.id);
  res.json(reviews);
});

router.get('/reviewable', authenticate, (req, res) => {
  const products = db.prepare(`
    SELECT DISTINCT p.id, p.name, p.image, p.slug, oi.order_id
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = ?
      AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.user_id = o.user_id AND r.product_id = p.id)
    ORDER BY o.created_at DESC
  `).all(req.user.id);
  res.json(products);
});

router.post('/', authenticate, (req, res) => {
  const { productId, orderId, rating, comment } = req.body;
  const ratingNum = Number(rating);
  if (!productId || !ratingNum) return res.status(400).json({ error: 'Product and rating are required' });
  if (ratingNum < 1 || ratingNum > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });

  const purchased = db.prepare(`
    SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id = o.id
    WHERE o.user_id = ? AND oi.product_id = ?
  `).get(req.user.id, productId);
  if (!purchased) return res.status(403).json({ error: 'You can only review products you have purchased' });

  const already = db.prepare('SELECT 1 FROM reviews WHERE user_id = ? AND product_id = ?').get(req.user.id, productId);
  if (already) return res.status(400).json({ error: 'You already reviewed this product' });

  const id = uuid();
  db.prepare('INSERT INTO reviews (id, user_id, product_id, order_id, rating, comment) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.id, productId, orderId || null, ratingNum, (comment || '').trim());
  res.status(201).json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(id));
});

router.delete('/:id', authenticate, (req, res) => {
  const existing = db.prepare('SELECT * FROM reviews WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Review not found' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ message: 'Review deleted' });
});

export default router;
