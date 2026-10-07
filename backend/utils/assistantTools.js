import db from '../db/database.js';
import { getSiteSettings } from './siteSettings.js';
import { getHolidayDiscount, getFirstTimeServiceDiscount } from './promos.js';
import { shapeProduct, shapeService } from './catalogShape.js';

// The functions the storefront assistant (routes/assistant.js) lets Gemini call. Every result is
// sent to Gemini as tokens, so no tool ever selects an `image` column — catalog images are
// stored as base64 data URIs that run to hundreds of KB each. Results stay small and flat: just
// what a shopper's question needs, with each item's storefront `url` so replies can link to it.
// `ctx` carries who is asking: { customerId } is set only for a signed-in customer.
// Company details and categories aren't functions at all; see getStoreInfo below.

const ACTIVE_PRODUCT = "(p.archived IS NULL OR p.archived = 0) AND (p.status IS NULL OR p.status = 'active')";
const ACTIVE_SERVICE = "(s.archived IS NULL OR s.archived = 0) AND (s.status IS NULL OR s.status = 'active')";

const RATING_COLUMNS = `
  (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.product_id = p.id) AS avg_rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
`;

const PRODUCT_SORTS = {
  price_asc: 'price ASC',
  price_desc: 'price DESC',
  rating: 'avg_rating DESC NULLS LAST, review_count DESC',
  relevance: 'relevance DESC, featured DESC, price ASC',
};

const clip = (text, max) => {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

const clampLimit = (value, fallback, max) => Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), max);

const toPrice = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Gemini sometimes hands back the url it was given ("/products/foo") instead of the bare slug.
const toSlug = (value) => String(value ?? '').split('/').filter(Boolean).pop() || '';

// Everyday words customers use that the catalog spells out differently.
const KEYWORD_ALIASES = { aircon: 'air condition', aircons: 'air condition', aircondition: 'air condition' };

// Free-text search is scored rather than all-words-must-match, so filler a model passes along
// ("best", "affordable") lowers nothing — rows matching more of the words just rank higher.
function keywordScore(haystack, query, params) {
  const words = String(query ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1).slice(0, 6)
    .map(w => KEYWORD_ALIASES[w] || w);
  if (!words.length) return '1';
  params.push(...words.map(w => `%${w}%`));
  return words.map(() => `(CASE WHEN ${haystack} ILIKE ? THEN 1 ELSE 0 END)`).join(' + ');
}

const productUrl = (slug) => `/products/${slug}`;
const serviceUrl = (slug) => `/services/${slug}`;

async function searchProducts(args) {
  const params = [];
  const haystack = "concat_ws(' ', p.name, p.description, p.brand, p.model, c.name)";
  const relevance = keywordScore(haystack, args.query, params);
  let where = `WHERE ${ACTIVE_PRODUCT}`;
  if (args.category) {
    const cat = String(args.category);
    where += ` AND p.category_id IN (
      SELECT id FROM categories WHERE slug = ? OR name ILIKE ?
        OR parent_id IN (SELECT id FROM categories WHERE slug = ? OR name ILIKE ?))`;
    params.push(cat, `%${cat}%`, cat, `%${cat}%`);
  }
  const minPrice = toPrice(args.min_price);
  const maxPrice = toPrice(args.max_price);
  if (minPrice) { where += ' AND p.price >= ?'; params.push(minPrice); }
  if (maxPrice) { where += ' AND p.price <= ?'; params.push(maxPrice); }
  if (args.in_stock_only) where += ' AND p.stock > 0';

  const limit = clampLimit(args.limit, 8, 15);
  // One extra row tells us whether there is more beyond this page without a separate COUNT.
  const rows = await db.prepare(`
    SELECT * FROM (
      SELECT p.name, p.slug, p.price, p.stock, p.brand, p.description, p.featured,
        c.name AS category_name, ${RATING_COLUMNS}, (${relevance}) AS relevance
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      ${where}
    ) matches
    WHERE relevance > 0
    ORDER BY ${PRODUCT_SORTS[args.sort] || PRODUCT_SORTS.relevance}
    LIMIT ?
  `).all(...params, limit + 1);

  return {
    more_available: rows.length > limit,
    products: rows.slice(0, limit).map(p => ({
      name: p.name,
      url: productUrl(p.slug),
      category: p.category_name,
      brand: p.brand || undefined,
      price: p.price,
      in_stock: p.stock > 0,
      stock_left: p.stock > 0 && p.stock <= 5 ? p.stock : undefined,
      rating: p.avg_rating ?? undefined,
      reviews: p.review_count || undefined,
      summary: clip(p.description, 160),
    })),
  };
}

async function getProductDetails(args) {
  const row = await db.prepare(`
    SELECT p.id, p.name, p.slug, p.price, p.stock, p.brand, p.model, p.warranty, p.description,
      p.specifications, p.highlights, c.name AS category_name, ${RATING_COLUMNS}
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ? AND ${ACTIVE_PRODUCT}
  `).get(toSlug(args.slug));
  if (!row) return { error: 'No active product with that slug. Use search_products to find it.' };

  const product = shapeProduct(row);
  const reviews = await db.prepare(`
    SELECT rating, comment FROM reviews WHERE product_id = ? AND comment IS NOT NULL AND comment <> ''
    ORDER BY created_at DESC LIMIT 3
  `).all(row.id);

  return {
    name: product.name,
    url: productUrl(product.slug),
    category: product.category_name,
    brand: product.brand || undefined,
    model: product.model || undefined,
    price: product.price,
    in_stock: product.stock > 0,
    stock: product.stock,
    warranty: product.warranty || undefined,
    description: clip(product.description, 800),
    specifications: product.specifications,
    highlights: product.highlights,
    rating: product.avg_rating ?? undefined,
    reviews: product.review_count || 0,
    recent_reviews: reviews.map(r => ({ rating: r.rating, comment: clip(r.comment, 200) })),
  };
}

async function searchServices(args) {
  const params = [];
  const relevance = keywordScore("concat_ws(' ', s.name, s.description, s.category)", args.query, params);
  let where = `WHERE ${ACTIVE_SERVICE}`;
  if (args.category) { where += ' AND s.category ILIKE ?'; params.push(`%${args.category}%`); }
  const maxPrice = toPrice(args.max_price);
  if (maxPrice) { where += ' AND s.base_price <= ?'; params.push(maxPrice); }

  const limit = clampLimit(args.limit, 8, 15);
  const rows = await db.prepare(`
    SELECT * FROM (
      SELECT s.name, s.slug, s.category, s.base_price, s.duration_hours, s.description, (${relevance}) AS relevance
      FROM services s ${where}
    ) matches
    WHERE relevance > 0
    ORDER BY relevance DESC, base_price ASC
    LIMIT ?
  `).all(...params, limit);

  return {
    services: rows.map(s => ({
      name: s.name,
      url: serviceUrl(s.slug),
      category: s.category,
      base_price: s.base_price,
      duration_hours: s.duration_hours,
      summary: clip(s.description, 160),
    })),
  };
}

async function getServiceDetails(args) {
  const row = await db.prepare(`
    SELECT s.name, s.slug, s.category, s.base_price, s.duration_hours, s.description, s.warranty,
      s.specifications, s.highlights, s.requirements
    FROM services s WHERE s.slug = ? AND ${ACTIVE_SERVICE}
  `).get(toSlug(args.slug));
  if (!row) return { error: 'No active service with that slug. Use search_services to find it.' };

  const service = shapeService(row);
  return {
    name: service.name,
    url: serviceUrl(service.slug),
    category: service.category,
    base_price: service.base_price,
    duration_hours: service.duration_hours,
    warranty: service.warranty || undefined,
    description: clip(service.description, 800),
    specifications: service.specifications,
    included: service.highlights,
    customer_should_prepare: service.requirements,
  };
}

// What nearly every conversation draws on (company details, delivery, payments, FAQs, policies
// and the category tree) goes into the system prompt instead of behind a function: a function
// would cost an extra Gemini round trip, and an extra request against a per-model daily quota,
// on every company question. It only changes when an admin edits it, so the shared part is
// rebuilt at most every few minutes.
const STORE_INFO_TTL_MS = 5 * 60 * 1000;
let storeInfoCache = null;

async function buildStoreInfo() {
  const settings = await getSiteSettings();
  const faqs = await db.prepare('SELECT question, answer FROM faqs WHERE active = 1 ORDER BY sort_order').all();
  const policies = await db.prepare('SELECT title, content FROM policies WHERE active = 1 ORDER BY sort_order').all();
  const categories = await db.prepare(`
    SELECT c.id, c.name, c.slug, c.parent_id, (
      SELECT COUNT(*) FROM products p
      WHERE p.category_id IN (SELECT id FROM categories WHERE id = c.id OR parent_id = c.id) AND ${ACTIVE_PRODUCT}
    ) AS product_count
    FROM categories c ORDER BY c.name
  `).all();
  const services = await db.prepare(`
    SELECT s.category, COUNT(*) AS count FROM services s WHERE ${ACTIVE_SERVICE} GROUP BY s.category ORDER BY s.category
  `).all();
  const gatewayMethods = [
    settings.payment_card_enabled === 'true' && 'Credit/Debit Card',
    settings.payment_gcash_enabled === 'true' && 'GCash',
    settings.payment_qrph_enabled === 'true' && 'QR Ph',
  ].filter(Boolean);

  return {
    about: { heading: settings.about_heading, intro: settings.about_intro },
    offers: 'Home improvement products plus professional installation, maintenance and repair services by verified technicians, with order and technician tracking.',
    contact: {
      address: settings.contact_address,
      phone: settings.contact_phone,
      email: settings.contact_email,
      map: `https://www.google.com/maps?q=${settings.contact_lat},${settings.contact_lng}`,
    },
    shopping: {
      currency: settings.currency_code,
      delivery_estimate: settings.delivery_estimate,
      shipping_fee: Number(settings.shipping_fee) || 0,
      free_shipping_threshold: Number(settings.free_shipping_threshold) || 0,
      payment_methods_orders: [...gatewayMethods, 'Bank Transfer', 'Cash on Delivery'],
      payment_methods_service_bookings: [...gatewayMethods, 'Bank Transfer'],
    },
    product_categories: categories.filter(c => !c.parent_id).map(c => ({
      name: c.name,
      slug: c.slug,
      products: c.product_count,
      // Subcategories have been created more than once under the same name; one entry is enough.
      subcategories: [...new Set(categories.filter(sub => sub.parent_id === c.id).map(sub => sub.name))],
    })),
    service_categories: services.map(s => ({ name: s.category, services: s.count })),
    faqs: faqs.map(f => ({ question: f.question, answer: clip(f.answer, 600) })),
    policies: policies.map(p => ({ title: p.title, content: clip(p.content, 1200) })),
    pages: {
      products: '/products', services: '/services', team: '/team', faq: '/faq', policies: '/policies',
      location_and_contact: '/location', account_and_support_tickets: '/account', orders: '/orders', bookings: '/bookings',
    },
  };
}

// Store details for the system prompt. Today's holiday discount and a signed-in customer's own
// promotions are worked out fresh on every call; only the shared part above is cached.
export async function getStoreInfo(customerId) {
  if (!storeInfoCache || Date.now() - storeInfoCache.at > STORE_INFO_TTL_MS) {
    storeInfoCache = { at: Date.now(), info: await buildStoreInfo() };
  }
  const holiday = getHolidayDiscount();
  const promotions = {
    holiday_discount_today: holiday ? holiday.label : 'none today',
    first_time_service_discount: '15% off automatically on a customer\'s first service booking',
  };
  // Voucher codes are only listed to signed-in customers, same as GET /promos/active.
  if (customerId) {
    promotions.first_time_discount_applies_to_this_customer = !!(await getFirstTimeServiceDiscount(customerId));
    const now = new Date().toISOString();
    promotions.voucher_codes = (await db.prepare(`
      SELECT code, discount_type, discount_value, min_order FROM vouchers
      WHERE active = 1 AND used_count < max_uses
        AND (valid_from IS NULL OR valid_from <= ?) AND (valid_until IS NULL OR valid_until > ?)
      ORDER BY discount_value DESC LIMIT 5
    `).all(now, now)).map(v => ({
      code: v.code,
      discount: v.discount_type === 'percent' ? `${v.discount_value}% off` : `₱${v.discount_value} off`,
      minimum_order: v.min_order,
    }));
  }
  return { ...storeInfoCache.info, promotions };
}

async function getMyActivity(args, ctx) {
  const orders = await db.prepare(`
    SELECT o.id, o.status, o.payment_status, o.payment_method, o.total, o.created_at,
      (SELECT string_agg(p.name || ' x' || oi.quantity, ', ') FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) AS items
    FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 5
  `).all(ctx.customerId);
  const bookings = await db.prepare(`
    SELECT b.id, b.status, b.payment_status, b.scheduled_date, b.scheduled_time, b.price, b.employee_id, s.name AS service_name
    FROM bookings b LEFT JOIN services s ON s.id = b.service_id
    WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT 5
  `).all(ctx.customerId);

  // Same short reference the Orders and Bookings pages show the customer.
  const ref = (id) => id.slice(0, 8).toUpperCase();
  return {
    recent_orders: orders.map(o => ({
      reference: ref(o.id),
      status: o.status,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      total: o.total,
      placed_on: new Date(o.created_at).toISOString().slice(0, 10),
      items: clip(o.items, 300),
    })),
    recent_bookings: bookings.map(b => ({
      reference: ref(b.id),
      service: b.service_name,
      status: b.status,
      payment_status: b.payment_status,
      scheduled: `${b.scheduled_date} ${b.scheduled_time}`,
      technician_assigned: !!b.employee_id,
      price: b.price,
    })),
    manage_at: { orders: '/orders', bookings: '/bookings' },
  };
}

const TOOLS = {
  search_products: {
    run: searchProducts,
    declaration: {
      name: 'search_products',
      description: 'Search HomeLink\'s product catalog. Use for any product recommendation, budget question or price lookup. Returns each product\'s name, url, category, price in PHP, stock and rating.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Product keywords, e.g. "inverter aircon", "cctv camera", "solar panel". Leave out words like "best" or "cheap".' },
          category: { type: 'string', description: 'A product category or subcategory name or slug from the store information, e.g. "Air Conditioners" or "cctv-security". Includes its subcategories.' },
          min_price: { type: 'number', description: 'Minimum unit price in PHP.' },
          max_price: { type: 'number', description: 'Maximum unit price in PHP — use the customer\'s budget here.' },
          in_stock_only: { type: 'boolean', description: 'Only return products currently in stock.' },
          sort: { type: 'string', enum: ['relevance', 'price_asc', 'price_desc', 'rating'], description: 'Defaults to relevance.' },
          limit: { type: 'integer', description: 'Max results, 1-15. Defaults to 8.' },
        },
      },
    },
  },
  get_product_details: {
    run: getProductDetails,
    declaration: {
      name: 'get_product_details',
      description: 'Full details of one product: specifications, highlights, warranty, stock and recent customer reviews.',
      parameters: {
        type: 'object',
        properties: { slug: { type: 'string', description: 'The product slug — the last part of its url.' } },
        required: ['slug'],
      },
    },
  },
  search_services: {
    run: searchServices,
    declaration: {
      name: 'search_services',
      description: 'Search HomeLink\'s bookable installation, cleaning, maintenance and repair services. Use when a product needs installing, or the customer asks about a service.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Service keywords, e.g. "aircon installation", "cctv", "solar cleaning".' },
          category: { type: 'string', description: 'A service category name from the store information, e.g. "Air Conditioning".' },
          max_price: { type: 'number', description: 'Maximum base price in PHP.' },
          limit: { type: 'integer', description: 'Max results, 1-15. Defaults to 8.' },
        },
      },
    },
  },
  get_service_details: {
    run: getServiceDetails,
    declaration: {
      name: 'get_service_details',
      description: 'Full details of one service: what is included, what the customer should prepare, duration and warranty.',
      parameters: {
        type: 'object',
        properties: { slug: { type: 'string', description: 'The service slug — the last part of its url.' } },
        required: ['slug'],
      },
    },
  },
  get_my_activity: {
    run: getMyActivity,
    customerOnly: true,
    declaration: {
      name: 'get_my_activity',
      description: 'The signed-in customer\'s 5 most recent orders and service bookings with their status, payment status and schedule.',
      parameters: { type: 'object', properties: {} },
    },
  },
};

// Resolves the storefront links in a reply ("/products/<slug>", "/services/<slug>") to the active
// catalog items they point at, keyed by url — the one place an image is read, for reply cards.
export async function findLinkedItems(urls) {
  const slugsOf = (prefix) => urls.filter(u => u.startsWith(prefix)).map(u => u.slice(prefix.length));
  const productSlugs = slugsOf('/products/');
  const serviceSlugs = slugsOf('/services/');
  const products = productSlugs.length ? await db.prepare(`
    SELECT p.name, p.slug, p.price, p.image, c.name AS category
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ANY(?) AND ${ACTIVE_PRODUCT}
  `).all(productSlugs) : [];
  const services = serviceSlugs.length ? await db.prepare(`
    SELECT s.name, s.slug, s.base_price AS price, s.image, s.category
    FROM services s WHERE s.slug = ANY(?) AND ${ACTIVE_SERVICE}
  `).all(serviceSlugs) : [];
  return new Map([
    ...products.map(p => [productUrl(p.slug), { type: 'product', ...p, url: productUrl(p.slug) }]),
    ...services.map(s => [serviceUrl(s.slug), { type: 'service', ...s, url: serviceUrl(s.slug) }]),
  ]);
}

const available = (tool, ctx) => !tool.customerOnly || !!ctx.customerId;

export function toolDeclarations(ctx) {
  return Object.values(TOOLS).filter(tool => available(tool, ctx)).map(tool => tool.declaration);
}

// Never throws: a failed lookup goes back to Gemini as an error result it can explain or work
// around, instead of failing the customer's whole message.
export async function runTool(name, args, ctx) {
  const tool = TOOLS[name];
  if (!tool || !available(tool, ctx)) return { error: `Unknown function: ${name}` };
  try {
    return await tool.run(args || {}, ctx);
  } catch (err) {
    console.error(`Assistant tool ${name} failed:`, err);
    return { error: 'That lookup failed. Try different filters or answer without it.' };
  }
}
