import db from '../db/database.js';

// Site settings — flat key/value store for platform config (currency, shipping, payment
// options) and CMS content strings (homepage/about/contact copy). Stored rows are merged
// over these defaults so an empty table behaves exactly like the old hardcoded values.
export const SETTINGS_DEFAULTS = {
  currency_code: 'PHP',
  currency_symbol: '₱',
  tax_rate: '0',
  shipping_fee: '0',
  free_shipping_threshold: '0',
  delivery_estimate: '3-5 business days',
  payment_card_enabled: 'true',
  payment_gcash_enabled: 'true',
  payment_qrph_enabled: 'true',
  about_heading: 'Home improvement, done right',
  about_intro: 'HomeLink brings home improvement products and the professionals who install them into one place, so homeowners can shop, book, and get the job done without juggling multiple vendors.',
  contact_address: process.env.COMPANY_ADDRESS || '123 HomeLink Avenue, Metro Manila, Philippines',
  contact_phone: '(02) 8123-4567',
  contact_email: 'support@homelink.com',
  contact_lat: String(process.env.COMPANY_LAT || 14.5995),
  contact_lng: String(process.env.COMPANY_LNG || 120.9842),
};

// Last currency symbol read from the table, for email.js's money() — the templates there build
// their HTML synchronously, so they can't await a settings read of their own. Refreshed by every
// getSiteSettings() call (checkout pricing makes one per order) and warmed once at boot below.
let cachedCurrencySymbol = SETTINGS_DEFAULTS.currency_symbol;
export const currencySymbol = () => cachedCurrencySymbol;

export async function getSiteSettings() {
  const rows = await db.prepare('SELECT key, value FROM site_settings').all();
  const settings = { ...SETTINGS_DEFAULTS, ...Object.fromEntries(rows.map(r => [r.key, r.value])) };
  cachedCurrencySymbol = settings.currency_symbol || SETTINGS_DEFAULTS.currency_symbol;
  return settings;
}
getSiteSettings().catch(() => {});

// The Platform Settings the storefront needs to price and label a checkout — public, unlike the
// full admin read, which also carries CMS copy and payment toggles.
export async function getStorefrontSettings() {
  const s = await getSiteSettings();
  return {
    currencyCode: s.currency_code,
    currencySymbol: s.currency_symbol,
    taxRate: Number(s.tax_rate) || 0,
    shippingFee: Number(s.shipping_fee) || 0,
    freeShippingThreshold: Number(s.free_shipping_threshold) || 0,
    deliveryEstimate: s.delivery_estimate,
  };
}

const round2 = (n) => Math.round(n * 100) / 100;

// Shipping and tax on a product order, given what the goods cost after discounts. Tax is charged
// on those goods only, not on shipping. Shipping is waived once the goods reach the free-shipping
// threshold; a threshold of 0 means there is none and the flat fee always applies. Mirrored in
// the frontend's utils/orderCharges.js so the checkout summary matches what gets charged.
export function orderCharges(merchandise, settings) {
  const fee = Math.max(0, Number(settings.shipping_fee) || 0);
  const threshold = Math.max(0, Number(settings.free_shipping_threshold) || 0);
  const taxRate = Math.max(0, Number(settings.tax_rate) || 0);
  const shippingFee = threshold > 0 && merchandise >= threshold ? 0 : fee;
  const tax = round2(merchandise * taxRate / 100);
  return { shippingFee, tax, taxRate, total: round2(merchandise + shippingFee + tax) };
}

// The PayMongo-backed methods an admin can switch off in Platform Settings. Bank transfer and
// cash on delivery have no toggle — they're always offered, so checkout never runs out of options.
const GATEWAY_METHOD_SETTINGS = {
  card: 'payment_card_enabled',
  gcash: 'payment_gcash_enabled',
  qrph: 'payment_qrph_enabled',
};

export async function getEnabledGatewayMethods() {
  const settings = await getSiteSettings();
  return Object.keys(GATEWAY_METHOD_SETTINGS).filter(m => settings[GATEWAY_METHOD_SETTINGS[m]] === 'true');
}
