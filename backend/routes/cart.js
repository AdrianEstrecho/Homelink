import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

async function getCart(userId) {
  const rows = await db.prepare(`
    SELECT ci.quantity, ci.selected, p.id as product_id, p.name, p.price, p.image, p.slug, p.stock
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.user_id = ? AND (p.archived IS NULL OR p.archived = 0) AND (p.status IS NULL OR p.status = 'active')
    ORDER BY ci.created_at DESC
  `).all(userId);
  return rows.map(r => ({
    productId: r.product_id,
    name: r.name,
    price: r.price,
    image: r.image,
    slug: r.slug,
    stock: r.stock,
    quantity: r.quantity,
    selected: r.selected !== 0,
  }));
}

router.get('/my', authenticate, async (req, res) => {
  res.json(await getCart(req.user.id));
});

router.post('/', authenticate, async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) return res.status(400).json({ error: 'Product is required' });
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  const product = await db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const existing = await db.prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, productId);
  if (existing) {
    // Adding it again means the customer wants it, so it's ticked for checkout even if it wasn't.
    await db.prepare('UPDATE cart_items SET quantity = ?, selected = 1 WHERE id = ?').run(existing.quantity + qty, existing.id);
  } else {
    await db.prepare('INSERT INTO cart_items (id, user_id, product_id, quantity) VALUES (?,?,?,?)').run(uuid(), req.user.id, productId, qty);
  }

  res.status(201).json(await getCart(req.user.id));
});

// Ticks or unticks items for checkout. Registered ahead of PUT /:productId so "selection"
// isn't taken for a product id.
router.put('/selection', authenticate, async (req, res) => {
  const { productIds, selected } = req.body;
  if (!Array.isArray(productIds) || typeof selected !== 'boolean') {
    return res.status(400).json({ error: 'productIds and selected are required' });
  }
  if (productIds.length) {
    await db.prepare('UPDATE cart_items SET selected = ? WHERE user_id = ? AND product_id = ANY(?)')
      .run(selected ? 1 : 0, req.user.id, productIds);
  }
  res.json(await getCart(req.user.id));
});

router.put('/:productId', authenticate, async (req, res) => {
  const qty = parseInt(req.body.quantity, 10);
  if (!Number.isFinite(qty)) return res.status(400).json({ error: 'Quantity is required' });

  if (qty <= 0) {
    await db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  } else {
    const existing = await db.prepare('SELECT id FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, req.params.productId);
    if (!existing) return res.status(404).json({ error: 'Item not found in cart' });
    await db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(qty, existing.id);
  }

  res.json(await getCart(req.user.id));
});

router.delete('/:productId', authenticate, async (req, res) => {
  await db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  res.json(await getCart(req.user.id));
});

// With productIds, removes just those (what an order took out of the cart); without, empties it.
router.delete('/', authenticate, async (req, res) => {
  const productIds = req.body?.productIds;
  if (Array.isArray(productIds)) {
    await db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ANY(?)').run(req.user.id, productIds);
    return res.json(await getCart(req.user.id));
  }
  await db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
  res.json([]);
});

export default router;
