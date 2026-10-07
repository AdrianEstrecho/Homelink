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

export async function getSiteSettings() {
  const rows = await db.prepare('SELECT key, value FROM site_settings').all();
  return { ...SETTINGS_DEFAULTS, ...Object.fromEntries(rows.map(r => [r.key, r.value])) };
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
