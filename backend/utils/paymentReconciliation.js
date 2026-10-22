import db from '../db/database.js';
import { retrieveCheckoutSession, retrievePaymentIntent } from './paymongo.js';
import { finalizePendingCheckout } from '../routes/payments.js';
import { finalizePendingBooking } from '../routes/bookings.js';

// A PayMongo payment only becomes a real order or booking once something confirms it: the
// webhook, or the customer's own app polling /payments/status or /bookings/status. If the
// webhook isn't reaching us and the customer closes the app before that poll lands, the money
// is taken but nothing shows up in admin. This sweeps recent pending checkouts and finalizes
// the paid ones itself, using the same finalize functions (and the same one-order guarantee)
// as those two paths.

const LOOKBACK = '2 days';
const BATCH = 25;
const MIN_GAP_MS = 30 * 1000;

let lastRunAt = 0;
let running = null;

// A paid checkout session also learns its payment intent id here, which the order keeps.
async function isPaid(pending) {
  if (pending.paymongo_checkout_session_id) {
    const session = await retrieveCheckoutSession(pending.paymongo_checkout_session_id);
    if (session.paid && session.paymentIntentId) pending.paymongo_payment_intent_id = session.paymentIntentId;
    return session.paid;
  }
  // An inline card payment (/payments/card-payment) has only a payment intent.
  const intent = await retrievePaymentIntent(pending.paymongo_payment_intent_id);
  return intent.status === 'succeeded';
}

// Abandoned checkouts stay 'pending' for the whole lookback, so a busy hour can leave more of them
// than one batch holds. Picking the ones checked longest ago (never-checked first), and stamping
// each pick, walks the sweep through all of them in turn; picking the newest every time would
// leave an older paid checkout stuck behind a wall of newer abandoned ones and never finalized.
async function sweep(table, finalize) {
  const rows = await db.prepare(`
    SELECT * FROM ${table}
    WHERE status = 'pending' AND created_at > now() - interval '${LOOKBACK}'
      AND (paymongo_checkout_session_id IS NOT NULL OR paymongo_payment_intent_id IS NOT NULL)
    ORDER BY reconciled_at ASC NULLS FIRST, created_at DESC LIMIT ${BATCH}
  `).all();
  if (!rows.length) return 0;
  await db.prepare(`UPDATE ${table} SET reconciled_at = now() WHERE id = ANY(?)`).run(rows.map((r) => r.id));

  let finalized = 0;
  for (const pending of rows) {
    try {
      const before = pending.paymongo_payment_intent_id;
      if (!(await isPaid(pending))) continue;
      if (pending.paymongo_payment_intent_id !== before) {
        await db.prepare(`UPDATE ${table} SET paymongo_payment_intent_id = ? WHERE id = ?`).run(pending.paymongo_payment_intent_id, pending.id);
      }
      await finalize(pending, null);
      finalized++;
    } catch (err) {
      console.error(`[payment reconcile] ${table} ${pending.id}:`, err.message);
    }
  }
  return finalized;
}

async function run() {
  const orders = await sweep('pending_checkouts', finalizePendingCheckout);
  const bookings = await sweep('pending_bookings', finalizePendingBooking);
  if (orders || bookings) console.log(`[payment reconcile] finalized ${orders} order(s), ${bookings} booking(s)`);
}

/**
 * Runs a sweep unless one ran in the last 30 seconds. Admin pages await it (capped by
 * `waitMs`) so a payment made a moment ago is already there when the list loads; past the
 * cap the sweep carries on in the background and the next load picks it up.
 */
export async function reconcilePendingPayments({ waitMs = 4000 } = {}) {
  if (!process.env.PAYMONGO_SECRET_KEY) return;
  if (!running && Date.now() - lastRunAt >= MIN_GAP_MS) {
    lastRunAt = Date.now();
    running = run()
      .catch((err) => console.error('[payment reconcile]', err.message))
      .finally(() => { running = null; });
  }
  if (running && waitMs > 0) {
    await Promise.race([running, new Promise((resolve) => setTimeout(resolve, waitMs))]);
  }
}
