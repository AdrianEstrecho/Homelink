// products.specifications and products.highlights are JSON stored in TEXT columns. Every
// read path runs rows through shapeProduct so clients always receive real structures
// (an object of label -> value, an array of strings) and never have to know — or re-parse —
// how the columns are stored. Bad JSON degrades to the empty shape instead of throwing,
// since a single malformed row shouldn't take down a whole catalog listing.
function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function shapeProduct(product) {
  const specifications = parseJson(product.specifications, {});
  const highlights = parseJson(product.highlights, []);
  return {
    ...product,
    specifications: specifications && typeof specifications === 'object' && !Array.isArray(specifications) ? specifications : {},
    highlights: Array.isArray(highlights) ? highlights : [],
    featured: !!product.featured,
  };
}

// The write-side counterparts: whatever the admin form sends is trimmed down to the shape
// the columns are meant to hold, so blank spec rows and stray types never reach the DB.
export function normalizeSpecifications(specifications) {
  if (!specifications || typeof specifications !== 'object' || Array.isArray(specifications)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(specifications)) {
    const label = String(key).trim();
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (!label || value == null || value === '') continue;
    out[label] = value;
  }
  return out;
}

export function normalizeHighlights(highlights) {
  if (!Array.isArray(highlights)) return [];
  return highlights.map(h => String(h ?? '').trim()).filter(Boolean);
}
