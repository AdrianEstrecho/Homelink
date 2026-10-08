import db from '../db/database.js';
import { getHolidayDiscount, validateVoucher, calculateDiscount } from './promos.js';
import { getSiteSettings, orderCharges } from './siteSettings.js';

// Validates stock/product availability and prices the cart, applying the active holiday
// discount and an optional voucher, then the shipping fee and tax from Platform Settings. Throws an Error with a user-facing message on failure
// (missing product, insufficient stock, invalid voucher) so callers can 400 with err.message.
export async function validateAndPriceCart(items, promoCode) {
  if (!items?.length) throw new Error('Cart is empty');

  let subtotal = 0;
  const orderItems = [];
  for (const item of items) {
    const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
    if (!product) throw new Error(`Product not found: ${item.productId}`);
    if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);
    subtotal += product.price * item.quantity;
    orderItems.push({ product, quantity: item.quantity, price: product.price });
  }

  let discount = 0;
  let appliedPromo = null;
  const holiday = getHolidayDiscount();
  if (holiday) { discount += calculateDiscount(subtotal - discount, holiday); appliedPromo = holiday.label; }
  if (promoCode) {
    const v = await validateVoucher(promoCode, subtotal);
    if (!v.valid) throw new Error(v.error);
    const vd = calculateDiscount(subtotal - discount, { type: v.voucher.discount_type, value: v.voucher.discount_value });
    discount += vd;
    appliedPromo = promoCode.toUpperCase();
  }

  const merchandise = Math.max(0, subtotal - discount);
  const { shippingFee, tax, taxRate, total } = orderCharges(merchandise, await getSiteSettings());
  return { orderItems, subtotal, discount, shippingFee, tax, taxRate, total, appliedPromo };
}
