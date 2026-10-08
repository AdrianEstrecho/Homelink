const round2 = (n) => Math.round(n * 100) / 100;

// Shipping and tax on a product order, given what the goods cost after discounts — a copy of the
// backend's orderCharges() in utils/siteSettings.js, which is what actually gets charged. Keep the
// two in step. Tax is on the goods only, not shipping; shipping is waived once the goods reach the
// free-shipping threshold, and a threshold of 0 means there is none.
export function orderCharges(merchandise, settings) {
  const fee = Math.max(0, Number(settings.shippingFee) || 0);
  const threshold = Math.max(0, Number(settings.freeShippingThreshold) || 0);
  const taxRate = Math.max(0, Number(settings.taxRate) || 0);
  const shippingFee = threshold > 0 && merchandise >= threshold ? 0 : fee;
  const tax = round2(merchandise * taxRate / 100);
  return {
    shippingFee,
    tax,
    taxRate,
    total: round2(merchandise + shippingFee + tax),
    // How much more would make shipping free — null once it already is, or when it never can be.
    toFreeShipping: fee > 0 && threshold > 0 && merchandise < threshold ? round2(threshold - merchandise) : null,
  };
}
