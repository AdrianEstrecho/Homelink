// products.specifications arrives as a plain object of label -> value. The admin editor
// writes human labels ("Cooling Capacity"), but older rows — and anything seeded before the
// editor existed — use camelCase keys ("energyRating"), so both shapes have to render the
// same way on the storefront.
export function specLabel(key) {
  const raw = String(key ?? '').trim();
  if (!raw) return '';
  if (/[\s_-]/.test(raw)) return raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());
}

// Object key order is insertion order for string keys, so the sequence the admin arranged
// rows in is exactly the order the spec table renders.
export function specEntries(specifications) {
  if (!specifications || typeof specifications !== 'object' || Array.isArray(specifications)) return [];
  return Object.entries(specifications)
    .filter(([key, value]) => String(key).trim() && value !== '' && value != null)
    .map(([key, value]) => ({ key, label: specLabel(key), value: String(value) }));
}

export function toHighlights(highlights) {
  if (!Array.isArray(highlights)) return [];
  return highlights.map(h => String(h ?? '').trim()).filter(Boolean);
}

// Common spec labels per top-level category, offered as one-tap chips in the admin editor
// so a catalog filled in by different staff still ends up with consistent spec names.
export const SPEC_PRESETS = {
  'air conditioners': ['Brand', 'Cooling Capacity', 'Type', 'Energy Rating', 'Refrigerant', 'Room Size', 'Noise Level', 'Power Supply'],
  'solar panels': ['System Capacity', 'Panels', 'Inverter', 'Panel Efficiency', 'Roof Area Needed', 'Mounting', 'Certification'],
  'cctv & security': ['Brand', 'Cameras', 'Resolution', 'Storage', 'Night Vision', 'Weather Rating', 'Mobile App'],
  electrical: ['Brand', 'Voltage Rating', 'Amperage', 'Material', 'Standard', 'Dimensions'],
  plumbing: ['Brand', 'Material', 'Finish', 'Type', 'Sizes', 'Pressure Rating'],
  'smart home': ['Brand', 'Connectivity', 'Power', 'Voice Assistants', 'Battery', 'Dimensions'],
  'home appliances': ['Brand', 'Capacity', 'Type', 'Energy Rating', 'Power Consumption', 'Dimensions'],
  lighting: ['Brand', 'Wattage', 'Light Output', 'Color Temperature', 'Beam Angle', 'Lifespan', 'Pack Size'],
  tools: ['Brand', 'Voltage', 'Max Torque', 'Chuck Size', 'No-load Speed', 'Includes', 'Weight'],
};

const DEFAULT_PRESETS = ['Brand', 'Model', 'Material', 'Dimensions', 'Weight', 'Power Supply', 'Warranty'];

export function presetsForCategory(categoryName) {
  return SPEC_PRESETS[String(categoryName ?? '').trim().toLowerCase()] || DEFAULT_PRESETS;
}

// The service equivalent: what a booking coordinator would want on record for a visit,
// keyed by the service categories the seed ships with.
const SERVICE_SPEC_PRESETS = {
  'air conditioning': ['Service Type', 'Unit Types Covered', 'Team Size', 'Parts Included', 'Refrigerant Top-up', 'Follow-up Check'],
  'solar energy': ['Service Type', 'System Sizes Covered', 'Team Size', 'Roof Types', 'Permits Handled', 'Monitoring Setup'],
  security: ['Service Type', 'Cameras Covered', 'Cabling Included', 'Team Size', 'App Setup', 'Storage Configuration'],
  electrical: ['Service Type', 'Scope', 'Team Size', 'Materials Included', 'Testing', 'Certification'],
  plumbing: ['Service Type', 'Scope', 'Team Size', 'Materials Included', 'Leak Testing'],
  general: ['Service Type', 'Scope', 'Team Size', 'Materials Included', 'Follow-up Visit'],
};

const DEFAULT_SERVICE_PRESETS = ['Service Type', 'Scope', 'Team Size', 'Materials Included', 'Coverage Area', 'Follow-up Visit'];

export function presetsForServiceCategory(categoryName) {
  return SERVICE_SPEC_PRESETS[String(categoryName ?? '').trim().toLowerCase()] || DEFAULT_SERVICE_PRESETS;
}
