// Address lookup for the checkout and account address forms.
//
// Province / city / barangay come from the bundled PSGC index — no network, no quota, and the
// names match the official register, so they stay usable for shipping zones later. Streets have
// no equivalent free register in the Philippines, so those come from a geocoder instead.
import { Router } from 'express';
import { psgc, search, normalize, exactKey, byName } from '../utils/psgc.js';
import { searchStreets } from '../utils/streetSearch.js';

const router = Router();

// Deliberately unauthenticated: the address form is reachable during checkout before a session
// is fully established, and this only reads a public government dataset.

const clamp = (n, max) => Math.min(Math.max(parseInt(n, 10) || 8, 1), max);

// An unsearched dropdown is a browse, not a search. Once the field is narrowed to one province
// or one city the whole list is the useful answer — Cebu has 53 municipalities and Quezon City
// 142 barangays, and truncating either to a suggestion-sized handful just hides most of it.
// Alphabetical, because the PSGC's own ordering means nothing to a customer.
//
// Note the default: a browse with no explicit limit wants the whole scoped list, not `clamp`'s
// suggestion-sized eight. Unscoped it stays small, since the head of 42k barangays helps nobody.
const BROWSE_LIMIT = 200;
const browse = (entries, scoped, limit) => {
  const max = scoped ? BROWSE_LIMIT : 25;
  const n = limit === undefined || limit === '' ? max : clamp(limit, max);
  return byName(entries).slice(0, n);
};

// Scoping accepts either the id from a previous suggestion or the plain name already sitting in
// the form. The name path is what makes editing a saved address work: those rows store names
// only, so there is no id to pass back until the customer picks something new.
function scopeBy(entries, { id, name, idKey, nameKey }) {
  if (id !== undefined && id !== '') {
    const n = Number(id);
    return Number.isNaN(n) ? entries : entries.filter(e => e[idKey] === n);
  }
  if (!exactKey(name)) return entries;

  // The register's own spelling, which is what a chosen suggestion sends back.
  const exact = exactKey(name);
  const strict = entries.filter(e => exactKey(e[nameKey]) === exact);
  if (strict.length) return strict;

  // Nothing matched exactly, so fall back to the way people write it — "Antipolo City" for the
  // register's "City of Antipolo". Only when it lands on a single parent: "Quezon" loosely
  // matches Quezon City and four municipalities, and guessing between them would silently scope
  // the search to the wrong one.
  const loose = normalize(name);
  const relaxed = loose ? entries.filter(e => normalize(e[nameKey]) === loose) : [];
  if (relaxed.length && new Set(relaxed.map(e => e[idKey])).size === 1) return relaxed;

  // Otherwise it is free text the register does not know, or too ambiguous to narrow by.
  // Falling back to the unscoped list keeps suggestions coming instead of returning nothing.
  return entries;
}

router.get('/provinces', (req, res) => {
  const { q, limit } = req.query;
  const { provinces } = psgc();
  // No query returns all 82, so the field can offer the whole list before anything is typed.
  res.json((q ? search(provinces, q, clamp(limit, 25)) : byName(provinces))
    .map(p => ({ id: p.id, name: p.name })));
});

router.get('/cities', (req, res) => {
  const { q, provinceId, province, limit } = req.query;
  const scoped = (provinceId !== undefined && provinceId !== '') || !!province;
  const cities = scopeBy(psgc().cities, { id: provinceId, name: province, idKey: 'provinceId', nameKey: 'province' });
  const results = q ? search(cities, q, clamp(limit, 25)) : browse(cities, scoped, limit);
  res.json(results.map(c => ({
    id: c.id, name: c.name, province: c.province, provinceId: c.provinceId, postalCode: c.postalCode,
  })));
});

router.get('/barangays', (req, res) => {
  const { q, cityId, city, provinceId, province, limit } = req.query;
  // Narrowing to the chosen city is what makes a 42k-row list usable; without it a query like
  // "San Isidro" is a wall of identically named barangays from every corner of the country.
  let barangays = psgc().barangays;
  const hasCity = (cityId !== undefined && cityId !== '') || !!city;
  const hasProvince = (provinceId !== undefined && provinceId !== '') || !!province;
  if (hasCity) {
    barangays = scopeBy(barangays, { id: cityId, name: city, idKey: 'cityId', nameKey: 'city' });
  } else if (hasProvince) {
    barangays = scopeBy(barangays, { id: provinceId, name: province, idKey: 'provinceId', nameKey: 'province' });
  }
  // Only a city narrows enough to be worth browsing whole — a province still runs to thousands.
  const results = q ? search(barangays, q, clamp(limit, 25)) : browse(barangays, hasCity, limit);
  res.json(results.map(b => ({
    id: b.id, name: b.name, city: b.city, cityId: b.cityId,
    province: b.province, provinceId: b.provinceId, postalCode: b.postalCode,
  })));
});

router.get('/streets', async (req, res) => {
  const { q, city, province } = req.query;
  // Shorter than three characters matches half the country and wastes a geocoder call.
  if (!q || q.trim().length < 3) return res.json([]);
  const streets = await searchStreets(q.trim(), { city, province });
  // The geocoder is a free shared service with no SLA and latency that ranges from under a
  // second to over four. When it does not answer, say so rather than returning an empty list
  // the form would report as "no such street".
  if (streets === null) return res.status(503).json({ error: 'Street lookup is unavailable' });
  res.json(streets);
});

export default router;
