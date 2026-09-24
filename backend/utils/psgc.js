// In-memory index over data/psgc.json, backing the address autocomplete in checkout.
//
// The file is ~1 MB and loads once on first use, then stays resident: 42k barangays as plain
// objects is a few MB of heap, which buys sub-millisecond lookups with no database round trip
// and no third-party geocoding quota for the parts of an address that never change.
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'psgc.json');

// Search has to survive how people actually type: no accent on Las Pinas, "Sta." for Santa, and
// a "Brgy." prefix that is noise here because every row in the barangay list is one.
export function normalize(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bsta\.?\b/g, 'santa')
    .replace(/\bsto\.?\b/g, 'santo')
    .replace(/\bgen\.?\b/g, 'general')
    .replace(/\bbrgy\.?\b/g, ' ')
    .replace(/\bbarangay\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

let index = null;

function build() {
  const raw = JSON.parse(readFileSync(DATA, 'utf8'));

  // `name` is what gets typed into the field; `context` is the parent names appended so a query
  // like "antipolo rizal" resolves in one go; `haystack` is both, for the loosest tier of match.
  const provinces = raw.p.map((name, id) => ({
    id, name, kind: 'province',
    nameKey: normalize(name), haystack: normalize(name),
  }));

  const cities = raw.c.map(([name, provinceIdx, postalCode], id) => {
    const province = provinces[provinceIdx];
    const nameKey = normalize(name);
    return {
      id, name, kind: 'city', postalCode,
      provinceId: province.id, province: province.name,
      nameKey, haystack: `${nameKey} ${province.nameKey}`,
    };
  });

  const barangays = raw.b.map(([name, cityIdx, postalCode], id) => {
    const city = cities[cityIdx];
    const nameKey = normalize(name);
    return {
      id, name, kind: 'barangay',
      // An empty code in the file means "same as the city" — see scripts/build-psgc.js.
      postalCode: postalCode || city.postalCode,
      cityId: city.id, city: city.name,
      provinceId: city.provinceId, province: city.province,
      nameKey, haystack: `${nameKey} ${city.haystack}`,
    };
  });

  index = { provinces, cities, barangays };
  return index;
}

export function psgc() {
  return index || build();
}

// Ranked so what you typed lands where you expect: the exact name first, then names starting
// with it, then a match on a word boundary, then the parent names. Shorter names break ties, so
// typing "cebu" surfaces Cebu before Cebuano-named neighbours.
function tierOf(entry, query, queryWords) {
  if (entry.nameKey === query) return 0;
  if (entry.nameKey.startsWith(query)) return 1;
  if (entry.nameKey.includes(` ${query}`)) return 2;
  if (entry.haystack.startsWith(query)) return 3;
  if (queryWords.length > 1 && queryWords.every(w => entry.haystack.includes(w))) return 4;
  if (entry.haystack.includes(query)) return 5;
  return -1;
}

export function search(entries, rawQuery, limit = 8) {
  const query = normalize(rawQuery);
  if (!query) return [];
  const queryWords = query.split(' ').filter(Boolean);

  // A full scan of the largest list (42k barangays) is a couple of string tests per row and
  // costs under a few ms, so it runs to completion rather than cutting off early and losing a
  // better match that happens to sit further down the list.
  const hits = [];
  for (const entry of entries) {
    const tier = tierOf(entry, query, queryWords);
    if (tier >= 0) hits.push({ entry, tier });
  }

  hits.sort((a, b) => a.tier - b.tier
    || a.entry.name.length - b.entry.name.length
    || a.entry.name.localeCompare(b.entry.name));
  return hits.slice(0, limit).map(h => h.entry);
}
