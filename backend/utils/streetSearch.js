// Street suggestions via Photon, an OpenStreetMap geocoder built for type-ahead — unlike
// Nominatim, whose usage policy rules out autocomplete traffic. No API key and no billing.
//
// Coverage is whatever OSM has: dense in Metro Manila and the major cities, thin in rural
// municipalities. That is why the street field stays free text — this only offers suggestions,
// it never constrains what someone can enter. Province, city and barangay do not come from here;
// they come from the bundled PSGC index, which is complete and authoritative.
import { normalize } from './psgc.js';

const PHOTON_URL = process.env.PHOTON_URL || 'https://photon.komoot.io/api/';
// Roughly the Philippine archipelago — keeps a query like "Rizal Street" from returning Spain.
const PH_BBOX = '116.87,4.59,126.60,21.12';
const TIMEOUT_MS = 3500;

// A public shared instance is a courtesy, and checkout re-queries the same few cities constantly,
// so repeated lookups are served from memory. Small and short-lived: addresses are typed in
// bursts, and OSM data does not change within a session.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { cache.delete(key); return null; }
  // Refresh insertion order so the hottest queries survive eviction.
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

export async function searchStreets(query, { city, province } = {}) {
  // The city and province already chosen in the form are the strongest hint available for
  // disambiguating a street name that repeats in a hundred municipalities.
  const scoped = [query, city, province].filter(Boolean).join(' ');
  const key = normalize(scoped);
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = `${PHOTON_URL}?q=${encodeURIComponent(scoped)}&limit=15&lang=en&bbox=${PH_BBOX}`;
  let features;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HomeLink-academic-project/1.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    features = (await res.json())?.features || [];
  } catch {
    // A geocoder that is slow, down or rate-limiting must not block checkout: the field is free
    // text, so an empty suggestion list just means the customer types the street themselves.
    return [];
  }

  const results = [];
  const seen = new Set();
  for (const f of features) {
    const p = f.properties || {};
    if (p.countrycode !== 'PH') continue;
    // A street feature is named for the street; anything else (a shop, a church) still carries
    // the street it sits on, which is the part we actually want in the field.
    const street = p.osm_key === 'highway' ? p.name : p.street;
    if (!street) continue;
    // OSM splits one road into many segments, so the same street comes back repeatedly.
    const dedupe = `${normalize(street)}|${normalize(p.city || p.county || '')}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    results.push({
      street,
      village: p.locality || p.district || '',
      city: p.city || p.county || '',
      province: p.state || '',
      postalCode: p.postcode || '',
      lat: f.geometry?.coordinates?.[1],
      lng: f.geometry?.coordinates?.[0],
      // The form uses this to tell a real street apart from a street inferred from a landmark.
      exactStreet: p.osm_key === 'highway',
    });
    if (results.length >= 8) break;
  }

  // Actual streets ahead of streets inferred from a nearby landmark.
  results.sort((a, b) => Number(b.exactStreet) - Number(a.exactStreet));
  cacheSet(key, results);
  return results;
}
