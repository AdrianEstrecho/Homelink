import db from '../db/database.js';

// The window the seeded Refund Policy (and the FAQ, and the homepage guarantee strip) promises
// customers: "within 7 days of the expected delivery date".
export const RETURN_WINDOW_DAYS = 7;

// Statuses that hold a claim on the units they name. 'approved' has to count: otherwise a customer
// approved for 2 of 2 could file a second request for 2 more while the first is still in transit.
// 'rejected' and 'cancelled' release the quantity again, so the customer can re-file.
export const COMMITTED_RETURN_STATUSES = ['pending', 'approved', 'received'];

// Inlined into the SQL below rather than bound as placeholders, so the list above stays the one
// source of truth without shifting every following parameter's position. Fixed literals, ours.
const COMMITTED_SQL = COMMITTED_RETURN_STATUSES.map((s) => `'${s}'`).join(', ');

// Same short-uuid convention orders use everywhere (Orders.jsx, OrderDetailsModal, every email)
// rather than a sequential counter — support.js's COALESCE(MAX(n),0)+1 races and has no unique
// index to catch a collision. This is a display label, never a key, so a clash is harmless.
export const returnRef = (id) => `RET-${String(id).slice(0, 8).toUpperCase()}`;

// One row per order line, with how many units are still returnable. Takes an executor so the same
// query serves the read-only eligibility check (on the pool) and the validation inside the POST
// transaction (on tx) — the convention applyVoucherUse already uses.
//
// The committed total is a correlated subquery, NOT a LEFT JOIN with the status test in a second
// ON clause: that form nulls out the return_requests row but leaves the return_items row joined,
// so SUM() would still count a rejected return and permanently block the customer from re-filing.
export async function getReturnableLines(executor = db, orderId) {
  const rows = await executor.prepare(`
    SELECT
      oi.id AS order_item_id,
      oi.product_id,
      oi.quantity AS ordered_qty,
      oi.price AS unit_price,
      p.name AS product_name,
      p.image AS product_image,
      COALESCE((
        SELECT SUM(ri.quantity)
        FROM return_items ri
        JOIN return_requests rr ON rr.id = ri.return_id
        WHERE ri.order_item_id = oi.id
          AND rr.status IN (${COMMITTED_SQL})
      ), 0) AS committed_qty
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
    ORDER BY oi.id
  `).all(orderId);

  return rows.map((r) => ({
    orderItemId: r.order_item_id,
    productId: r.product_id,
    name: r.product_name,
    image: r.product_image,
    orderedQty: r.ordered_qty,
    committedQty: Number(r.committed_qty),
    returnableQty: r.ordered_qty - Number(r.committed_qty),
    unitPrice: r.unit_price,
  }));
}

// Orders delivered before delivered_at existed fall back to created_at, which is always the
// earlier of the two — so the window closes early for those rather than staying open forever.
export function returnWindowAnchor(order) {
  return new Date(order.delivered_at || order.created_at);
}

export function returnWindowClosesAt(order) {
  const closes = returnWindowAnchor(order);
  closes.setDate(closes.getDate() + RETURN_WINDOW_DAYS);
  return closes;
}

// reason is one of 'not_delivered' | 'window_closed' | 'fully_returned', or null when eligible.
// Callers turn it into a message; the codes keep the wording in one place on the frontend.
export function returnEligibility(order, lines) {
  if (order.status !== 'delivered') return { eligible: false, reason: 'not_delivered', windowClosesAt: null };

  const windowClosesAt = returnWindowClosesAt(order);
  if (Date.now() > windowClosesAt.getTime()) return { eligible: false, reason: 'window_closed', windowClosesAt };

  const returnable = (lines || []).reduce((sum, l) => sum + l.returnableQty, 0);
  if (returnable <= 0) return { eligible: false, reason: 'fully_returned', windowClosesAt };

  return { eligible: true, reason: null, windowClosesAt };
}

// order_items.price is the per-unit GROSS price, and orders.discount (holiday + voucher) is only
// ever held at order level — cartPricing.js never apportions it to lines. So a plain qty * price
// over-refunds anyone who used a voucher. Each line gives back its own share of the discount.
export function prorateRefund(selected, order) {
  const subtotal = Number(order.subtotal) || 0;
  const discount = Number(order.discount) || 0;

  return selected.reduce((total, line) => {
    const lineTotal = line.quantity * line.unitPrice;
    const share = subtotal > 0 ? (lineTotal / subtotal) * discount : 0;
    return total + Math.max(0, lineTotal - share);
  }, 0);
}

// Batched counterpart to getReturnableLines for a customer's whole order list: GET /orders/my
// already runs one items query per order, and adding a second per-order round trip for a button's
// visibility would make that worse. One query covers every order the customer has.
export async function getReturnableTotals(executor = db, userId) {
  const rows = await executor.prepare(`
    SELECT oi.order_id,
           SUM(oi.quantity) - SUM(COALESCE(c.committed, 0)) AS returnable
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN LATERAL (
      SELECT SUM(ri.quantity) AS committed
      FROM return_items ri
      JOIN return_requests rr ON rr.id = ri.return_id
      WHERE ri.order_item_id = oi.id
        AND rr.status IN (${COMMITTED_SQL})
    ) c ON TRUE
    WHERE o.user_id = ?
    GROUP BY oi.order_id
  `).all(userId);

  return new Map(rows.map((r) => [r.order_id, Number(r.returnable)]));
}

// Whether this order can take a NEW return request right now. Same three tests as
// returnEligibility, minus the per-line detail, for list views that only render a button.
export function canReturnOrder(order, returnableUnits) {
  return order.status === 'delivered'
    && Date.now() <= returnWindowClosesAt(order).getTime()
    && returnableUnits > 0;
}

// How many *live* return requests each of a customer's orders carries, for the Returns tab in My
// Orders — which otherwise has only payment_status='refunded' to go on, and so stays empty until
// an entire order has come back.
//
// Only the committed statuses count, the same set that holds a claim on stock above. A rejected
// or withdrawn return leaves the customer holding the goods, so the order goes back to being an
// ordinary delivered one — it belongs under To Review again, not filed forever under Returns.
export async function getReturnCounts(executor = db, userId) {
  const rows = await executor.prepare(`
    SELECT order_id, COUNT(*) AS n FROM return_requests
    WHERE user_id = ? AND status IN (${COMMITTED_SQL})
    GROUP BY order_id
  `).all(userId);
  return new Map(rows.map((r) => [r.order_id, Number(r.n)]));
}
