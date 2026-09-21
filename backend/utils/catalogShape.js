// products and services both keep structured catalog detail in JSON TEXT columns
// (specifications, highlights, and on services requirements too). Every read path runs rows
// through the matching shape* helper so clients always receive real structures — an object
// of label -> value, an array of strings — and never have to know, or re-parse, how the
// columns are stored. Bad JSON degrades to the empty shape instead of throwing, since one
// malformed row shouldn't take down a whole catalog listing.
function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

const asMap = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const asList = (value) => (Array.isArray(value) ? value : []);

export function shapeProduct(product) {
  return {
    ...product,
    specifications: asMap(parseJson(product.specifications, {})),
    highlights: asList(parseJson(product.highlights, [])),
    featured: !!product.featured,
  };
}

export function shapeService(service) {
  return {
    ...service,
    specifications: asMap(parseJson(service.specifications, {})),
    highlights: asList(parseJson(service.highlights, [])),
    requirements: asList(parseJson(service.requirements, [])),
  };
}

// The write-side counterparts: whatever the admin form sends is trimmed down to the shape
// the columns are meant to hold, so blank rows and stray types never reach the DB.
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

export function normalizeStringList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(item => String(item ?? '').trim()).filter(Boolean);
}
