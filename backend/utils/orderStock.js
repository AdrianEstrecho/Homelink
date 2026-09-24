import { withTransaction } from '../db/database.js';

// Checkout deducts stock the moment an order is created (see orderFulfillment.js), so the
// units of a cancelled order are reserved for a sale that will never happen — these two
// helpers move them back and forth. Both are idempotent through orders.stock_restored, which
// is read under FOR UPDATE: two cancellations racing (customer clicking cancel while staff
// cancels the same order) serialise on that row, and the second one sees the work is done.
//
// Products are touched in the same id order fulfillOrder uses, so an order being cancelled and
// another being placed over the same products always take the row locks the same way round.
function sortedItems(items) {
  return [...items].sort((a, b) => a.product_id.localeCompare(b.product_id));
}

// How many units of each line are still out with the customer: what they ordered, minus anything
// an approved return has already brought back. A received return has ALREADY put its units on the
// shelf, so cancelling the order afterwards must not credit them a second time. Lines that are
// fully returned net to zero and drop out entirely.
const OUTSTANDING_ITEMS_SQL = `
  SELECT oi.product_id, p.name,
         oi.quantity - COALESCE(r.returned, 0) AS quantity
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  LEFT JOIN LATERAL (
    SELECT SUM(ri.quantity) AS returned
    FROM return_items ri
    JOIN return_requests rr ON rr.id = ri.return_id
    WHERE ri.order_item_id = oi.id AND rr.status = 'received'
  ) r ON TRUE
  WHERE oi.order_id = ?
`;

async function outstandingItems(tx, orderId) {
  const rows = await tx.prepare(OUTSTANDING_ITEMS_SQL).all(orderId);
  return rows.filter((i) => i.quantity > 0);
}

async function release(tx, orderId) {
  const order = await tx.prepare('SELECT stock_restored FROM orders WHERE id = ? FOR UPDATE').get(orderId);
  if (!order || order.stock_restored) return { restored: false, units: 0 };

  const items = await outstandingItems(tx, orderId);
  const restock = tx.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  for (const item of sortedItems(items)) {
    await restock.run(item.quantity, item.product_id);
  }
  await tx.prepare('UPDATE orders SET stock_restored = 1 WHERE id = ?').run(orderId);

  return { restored: true, units: items.reduce((sum, i) => sum + i.quantity, 0) };
}

async function reclaim(tx, orderId) {
  const order = await tx.prepare('SELECT stock_restored FROM orders WHERE id = ? FOR UPDATE').get(orderId);
  if (!order || !order.stock_restored) return { reclaimed: false, units: 0 };

  const items = await outstandingItems(tx, orderId);

  // Same check-and-deduct-in-one-statement as checkout, so reinstating an order can't push a
  // product negative. If the returned units have since been sold to someone else, the status
  // change is refused rather than quietly overselling — staff restock first, then retry.
  const deduct = tx.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
  for (const item of sortedItems(items)) {
    const { changes } = await deduct.run(item.quantity, item.product_id, item.quantity);
    if (changes) continue;
    const err = new Error(`Not enough stock to reinstate this order: "${item.name}" needs ${item.quantity} in stock. Restock it first, then change the status again.`);
    err.status = 409;
    throw err;
  }
  await tx.prepare('UPDATE orders SET stock_restored = 0 WHERE id = ?').run(orderId);

  return { reclaimed: true, units: items.reduce((sum, i) => sum + i.quantity, 0) };
}

// Both take an optional tx so the caller can put the stock movement in the same transaction as
// the status change it belongs to — either both land or neither does.
export function releaseOrderStock(orderId, tx = null) {
  return tx ? release(tx, orderId) : withTransaction((t) => release(t, orderId));
}

export function reclaimOrderStock(orderId, tx = null) {
  return tx ? reclaim(tx, orderId) : withTransaction((t) => reclaim(t, orderId));
}
