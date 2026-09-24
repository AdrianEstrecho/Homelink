// Address lookup for the checkout and account address forms.
//
// Province / city / barangay come from the bundled PSGC index — no network, no quota, and the
// names match the official register, so they stay usable for shipping zones later. Streets have
// no equivalent free register in the Philippines, so those come from a geocoder instead.
import { Router } from 'express';
import { psgc, search, normalize } from '../utils/psgc.js';
import { searchStreets } from '../utils/streetSearch.js';

const router = Router();

// Deliberately unauthenticated: the address form is reachable during checkout before a session
// is fully established, and this only reads a public government dataset.

const clamp = (n, max) => Math.min(Math.max(parseInt(n, 10) || 8, 1), max);

// Scoping accepts either the id from a previous suggestion or the plain name already sitting in
// the form. The name path is what makes editing a saved address work: those rows store names
// only, so there is no id to pass back until the customer picks something new.
function scopeBy(entries, { id, name, idKey, nameKey }) {
  if (id !== undefined && id !== '') {
    const n = Number(id);
    return Number.isNaN(n) ? entries : entries.filter(e => e[idKey] === n);
  }
  const wanted = normalize(name);
  if (!wanted) return entries;
  const matches = entries.filter(e => normalize(e[nameKey]) === wanted);
  // An unrecognised name means free text the register does not know. Falling back to the
  // unscoped list keeps suggestions coming instead of silently returning nothing.
  return matches.length ? matches : entries;
}

router.get('/provinces', (req, res) => {
  const { q, limit } = req.query;
  const { provinces } = psgc();
  // No query returns the whole list, so the field can offer options before anything is typed.
  res.json((q ? search(provinces, q, clamp(limit, 25)) : provinces)
    .map(p => ({ id: p.id, name: p.name })));
});

router.get('/cities', (req, res) => {
  const { q, provinceId, province, limit } = req.query;
  const cities = scopeBy(psgc().cities, { id: provinceId, name: province, idKey: 'provinceId', nameKey: 'province' });
  const max = clamp(limit, 25);
  const results = q ? search(cities, q, max) : cities.slice(0, max);
  res.json(results.map(c => ({
    id: c.id, name: c.name, province: c.province, provinceId: c.provinceId, postalCode: c.postalCode,
  })));
});

router.get('/barangays', (req, res) => {
  const { q, cityId, city, provinceId, province, limit } = req.query;
  // Narrowing to the chosen city is what makes a 42k-row list usable; without it a query like
  // "San Isidro" is a wall of identically named barangays from every corner of the country.
  let barangays = psgc().barangays;
  if ((cityId !== undefined && cityId !== '') || city) {
    barangays = scopeBy(barangays, { id: cityId, name: city, idKey: 'cityId', nameKey: 'city' });
  } else if ((provinceId !== undefined && provinceId !== '') || province) {
    barangays = scopeBy(barangays, { id: provinceId, name: province, idKey: 'provinceId', nameKey: 'province' });
  }
  const max = clamp(limit, 25);
  const results = q ? search(barangays, q, max) : barangays.slice(0, max);
  res.json(results.map(b => ({
    id: b.id, name: b.name, city: b.city, cityId: b.cityId,
    province: b.province, provinceId: b.provinceId, postalCode: b.postalCode,
  })));
});

router.get('/streets', async (req, res) => {
  const { q, city, province } = req.query;
  // Shorter than three characters matches half the country and wastes a geocoder call.
  if (!q || q.trim().length < 3) return res.json([]);
  res.json(await searchStreets(q.trim(), { city, province }));
});

export default router;
