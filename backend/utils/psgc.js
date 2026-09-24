// In-memory index over data/psgc.json, backing the address autocomplete in checkout.
//
// The file is ~1 MB and loads once on first use, then stays resident: 42k barangays as plain
// objects is a few MB of heap, which buys sub-millisecond lookups with no database round trip
// and no third-party geocoding quota for the parts of an address that never change.
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'psgc.json');

// Shorthand people type instead of the registered name. Kept deliberately short — every entry is
// a guess about intent, and a wrong guess buries the thing that was actually wanted.
const ALIASES = {
  qc: 'quezon city',
  cdo: 'cagayan de oro',
  gensan: 'general santos',
  dasma: 'dasmarinas',
  // Bonifacio Global City is a district rather than a city, but nobody writes the city it is in.
  bgc: 'taguig',
};

// Search has to survive how people actually type: no accent on Las Pinas, "Sta." for Santa, and
// a "Brgy." prefix that is noise here because every row in the barangay list is one.
//
// "City" goes too, so the register's "City of Antipolo", the "Antipolo City" people write, and a
// bare "Antipolo" all reduce to one key and rank equally. That also collapses a city into its
// like-named province — "Quezon City" and Quezon province both become "quezon" — which is what
// the chartered-city rank below is there to settle.
// Spelling only: accents, punctuation and the civil abbreviations. Two names reduce to the same
// key here when they are the same name written differently, which makes this the one to compare
// by when scoping a search to a parent \u2014 "Quezon City" and the municipalities called "Quezon"
// stay distinct, as they must, or a barangay search in the capital would sweep in four provinces.
export function exactKey(s) {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bsta\.?\b/g, 'santa')
    .replace(/\bsto\.?\b/g, 'santo')
    .replace(/\bgen\.?\b/g, 'general')
    .replace(/\bbrgy\.?\b/g, ' ')
    .replace(/\bbarangay\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// The looser key, for matching what someone typed against the register.
export function normalize(s) {
  const base = exactKey(s);
  return (ALIASES[base] || base)
    .replace(/\bcity of\b/g, ' ')
    .replace(/\bmunicipality of\b/g, ' ')
    .replace(/\bcity\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let index = null;

function build() {
  const raw = JSON.parse(readFileSync(DATA, 'utf8'));

  // `name` is what gets typed into the field; `haystack` appends the parent names so a query
  // like "antipolo rizal" resolves in one go. `rank` orders equally good name matches.
  const provinces = raw.p.map((name, id) => ({
    id, name, kind: 'province', rank: 0,
    nameKey: normalize(name), haystack: normalize(name),
  }));

  const cities = raw.c.map(([name, provinceIdx, postalCode, rank = 0], id) => {
    const province = provinces[provinceIdx];
    const nameKey = normalize(name);
    return {
      id, name, kind: 'city', postalCode, rank,
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
      // A barangay inherits its city's standing: one in Makati is a likelier delivery address
      // than a same-named one in a municipality of four thousand people.
      rank: city.rank,
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

// True when a single insertion, deletion, substitution or transposition turns `a` into `b`.
// Bounded at one edit on purpose: it recovers a slipped finger without turning a short query
// into a match for half the country.
export function withinOneEdit(a, b) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;

  // Skip the common prefix, then the common suffix; whatever is left is the single differing run.
  let start = 0;
  while (start < la && start < lb && a[start] === b[start]) start++;
  if (start === la && start === lb) return false;   // identical, so the exact tiers already had it
  let ea = la - 1, eb = lb - 1;
  while (ea >= start && eb >= start && a[ea] === b[eb]) { ea--; eb--; }

  // Nothing left on either side: one character was inserted or deleted at the join.
  if (ea < start && eb < start) return true;
  if (la === lb) {
    // One character differs (substitution), or two adjacent ones are swapped.
    if (ea === start && eb === start) return true;
    if (ea === start + 1 && eb === start + 1) return a[start] === b[start + 1] && a[start + 1] === b[start];
    return false;
  }
  // Different lengths: the longer string may keep exactly one unmatched character.
  return la > lb ? ea === start && eb < start : eb === start && ea < start;
}

// Ranked so what you typed lands where you expect: the exact name first, then names starting
// with it, then a match on a word boundary, then the parent names, and a single typo last.
function tierOf(entry, query, queryWords) {
  if (entry.nameKey === query) return 0;
  if (entry.nameKey.startsWith(query)) return 1;
  if (entry.nameKey.includes(` ${query}`)) return 2;
  if (entry.haystack.startsWith(query)) return 3;
  if (queryWords.length > 1 && queryWords.every(w => entry.haystack.includes(w))) return 4;
  if (entry.haystack.includes(query)) return 5;
  return -1;
}

const FUZZY_TIER = 6;
const MIN_FUZZY_CHARS = 4;

export function search(entries, rawQuery, limit = 8) {
  const query = normalize(rawQuery);
  if (!query) return [];
  const queryWords = query.split(' ').filter(Boolean);

  // A postal code is the one part of an address people reliably remember as digits, and typing
  // it is the fastest route to a city. Whole 4-digit codes only; shorter runs are house numbers.
  if (/^\d{4}$/.test(query)) {
    const byCode = entries.filter(e => e.postalCode === query);
    if (byCode.length) return sortHits(byCode.map(entry => ({ entry, tier: 0, prefix: 0 })), limit);
  }

  // A full scan of the largest list (42k barangays) is a couple of string tests per row and
  // costs a few ms, so it runs to completion rather than cutting off early and losing a better
  // match that happens to sit further down the list.
  const hits = [];
  for (const entry of entries) {
    const tier = tierOf(entry, query, queryWords);
    if (tier >= 0) hits.push({ entry, tier, prefix: commonPrefix(query, entry.nameKey) });
  }

  // The typo pass only runs when the plain one came up short, keeping its cost off the common
  // case where someone is typing a name that actually exists.
  if (hits.length < limit && query.length >= MIN_FUZZY_CHARS) {
    const seen = new Set(hits.map(h => h.entry));
    for (const entry of entries) {
      if (seen.has(entry)) continue;
      // Matched against the name alone: a typo inside a parent name is not worth guessing at.
      if (withinOneEdit(query, entry.nameKey)) {
        hits.push({ entry, tier: FUZZY_TIER, prefix: commonPrefix(query, entry.nameKey) });
      }
    }
  }

  return sortHits(hits, limit);
}

function commonPrefix(a, b) {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

function sortHits(hits, limit) {
  hits.sort((a, b) => a.tier - b.tier
    // How much of what was typed actually lines up. Decides a typo between two candidates that
    // are each one edit away: "makti" shares "mak" with Makati but only "ma" with Mati.
    || b.prefix - a.prefix
    // Chartered cities and provincial capitals first: of the nine places called "San Jose", the
    // city in Nueva Ecija is a likelier delivery address than any of the municipalities.
    || b.entry.rank - a.entry.rank
    || a.entry.name.length - b.entry.name.length
    || a.entry.name.localeCompare(b.entry.name));
  return hits.slice(0, limit).map(h => h.entry);
}

// Used for the unsearched dropdown, where the PSGC's own ordering means nothing to a customer.
export function byName(entries) {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name));
}

