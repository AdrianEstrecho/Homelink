import { withTransaction } from '../db/database.js';

// A PayMongo checkout (card, GCash, QR Ph) takes its units off the shelf the moment the customer
// confirms the order, not when the payment lands. Whoever confirms first gets the stock, and
// anyone after them is told how many are left before PayMongo charges them anything, instead of
// paying for units someone else already has. pending_checkouts.stock_held records the hold and
// is read under FOR UPDATE wherever it changes, so a hold is spent (fulfillOrder) or handed back
// (releaseHeldStock) exactly once.

// How long an unpaid checkout keeps its units: plenty for a GCash login or a bank app's QR scan,
// short enough that a customer who walked away doesn't empty the shelf for long. PayMongo's own
// sessions never expire, so paymentReconciliation.js ends the ones older than this.
export const HOLD_MINUTES = 15;

export function outOfStockError(product, available) {
  const left = Math.max(0, available ?? 0);
  const err = new Error(left > 0
    ? `Sorry, only ${left} of "${product.name}" ${left === 1 ? 'is' : 'are'} left. Another customer ordered the rest first. Lower the quantity to ${left} or fewer to continue.`
    : `Sorry, "${product.name}" just sold out. Another customer ordered the last ones first.`);
  err.status = 409;
  err.code = 'insufficient_stock';
  err.productId = product.id;
  err.available = left;
  return err;
}

// How the checkout routes answer an order they refuse: running out of stock as a 409 that names
// the product and how many are left, anything else as the 400 they have always sent.
export function sendCheckoutError(res, err) {
  if (err.code === 'insufficient_stock') {
    return res.status(409).json({ error: err.message, code: err.code, productId: err.productId, available: err.available });
  }
  return res.status(400).json({ error: err.message });
}

// One order can name a product on two lines, so units are summed per product. They're taken in
// id order, the order fulfillOrder and orderStock.js lock products in, so checkouts racing over
// the same products wait on each other instead of deadlocking.
function unitsByProduct(items) {
  const units = new Map();
  for (const { productId, quantity } of items) units.set(productId, (units.get(productId) || 0) + quantity);
  return [...units].sort(([a], [b]) => a.localeCompare(b));
}

// Runs inside the caller's transaction, so a checkout that can't get every line holds none of
// them. The check and the deduction are one statement, so of two customers confirming at the
// same moment only one can get the last units.
export async function holdStock(tx, items) {
  const take = tx.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
  for (const [productId, quantity] of unitsByProduct(items)) {
    const { changes } = await take.run(quantity, productId, quantity);
    if (changes) continue;
    const product = await tx.prepare('SELECT id, name, stock FROM products WHERE id = ?').get(productId);
    throw outOfStockError(product || { id: productId, name: 'an item in your order' }, product?.stock);
  }
}

async function release(tx, pendingId) {
  const row = await tx.prepare('SELECT items, stock_held FROM pending_checkouts WHERE id = ? FOR UPDATE').get(pendingId);
  if (!row?.stock_held) return false;

  const restock = tx.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  for (const [productId, quantity] of unitsByProduct(JSON.parse(row.items))) {
    await restock.run(quantity, productId);
  }
  await tx.prepare('UPDATE pending_checkouts SET stock_held = 0 WHERE id = ?').run(pendingId);
  return true;
}

// Puts a checkout's held units back on the shelf. A no-op once they're back or the order exists.
export function releaseHeldStock(pendingId, tx = null) {
  return tx ? release(tx, pendingId) : withTransaction((t) => release(t, pendingId));
}

// Ends a checkout that can no longer be paid: its units go back and it's marked failed with the
// reason, in one transaction. Only a checkout still 'pending' changes status.
export function closeCheckout(pendingId, reason) {
  return withTransaction(async (tx) => {
    await release(tx, pendingId);
    await tx.prepare("UPDATE pending_checkouts SET status = 'failed', failure_reason = ? WHERE id = ? AND status = 'pending'").run(reason, pendingId);
  });
}

const FAILURE_MESSAGES = {
  cancelled: 'Payment was cancelled, so nothing was charged.',
  replaced: 'You started a new checkout, so this one was closed. Nothing was charged.',
  expired: `This checkout timed out after ${HOLD_MINUTES} minutes without a payment, so nothing was charged and the items went back on sale. Please place your order again.`,
  gateway_error: "We couldn't start the payment, so nothing was charged. Please try again.",
  declined: 'Your card was declined, so nothing was charged. Please try another card.',
};

export function checkoutFailureMessage(reason) {
  return FAILURE_MESSAGES[reason] || 'Payment could not be completed. Please try again.';
}
