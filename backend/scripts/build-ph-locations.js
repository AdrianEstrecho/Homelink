// Regenerates backend/data/ph-locations.json from the PSGC (Philippine Standard Geographic
// Code) API — the official registry the PSA publishes for every province, city/municipality
// and barangay in the country. Run it with `npm run build:locations` when a new PSGC release
// comes out; the generated file is committed, so the server never calls out at runtime.
//
// The API's raw shape is much bigger than the address form needs (~11MB of barangays alone),
// so this keeps only code + name and groups children under their parent, which drops it to
// well under 1MB and lets the locations API answer one level at a time.
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const API = 'https://psgc.gitlab.io/api';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'ph-locations.json');

// The 17 cities and 1 municipality of Metro Manila sit directly under the NCR region with no
// provinceCode — PSGC has no "Metro Manila" province because legally there isn't one. Every
// Philippine address form still asks for it, so NCR stands in as a province here.
const NCR_CODE = '130000000';
const NCR_NAME = 'Metro Manila';

// The two other province-less entries are independent cities that PSGC files straight under
// a region. Mail to them has always been addressed with the province they sit in, so that's
// where the form files them: Isabela City in Basilan, Cotabato City in Cotabato.
const ORPHAN_CITY_PROVINCE = {
  '099701000': '150700000', // City of Isabela -> Basilan
  '129804000': '124700000', // City of Cotabato -> Cotabato
};

// PSGC writes chartered cities as "City of Makati"; Philippine addresses are written
// "Makati City". Manila is the exception nobody writes as "Manila City".
function cityLabel(name) {
  if (name === 'City of Manila') return 'Manila';
  const match = /^City of (.+)$/.exec(name);
  return match ? `${match[1]} City` : name;
}

async function fetchJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`PSGC ${path} responded ${res.status}`);
  return res.json();
}

const byName = (a, b) => a.name.localeCompare(b.name, 'en');

async function build() {
  console.log('Fetching PSGC provinces, cities/municipalities and barangays...');
  const [rawProvinces, rawCities, rawBarangays] = await Promise.all([
    fetchJson('/provinces/'),
    fetchJson('/cities-municipalities/'),
    fetchJson('/barangays/'),
  ]);

  const provinces = [...rawProvinces.map(p => ({ code: p.code, name: p.name })), { code: NCR_CODE, name: NCR_NAME }].sort(byName);
  const provinceCodes = new Set(provinces.map(p => p.code));

  const cities = {};
  for (const c of rawCities) {
    const provinceCode = c.provinceCode || ORPHAN_CITY_PROVINCE[c.code] || (c.regionCode === NCR_CODE ? NCR_CODE : null);
    if (!provinceCode || !provinceCodes.has(provinceCode)) {
      console.warn(`Skipping ${c.name} (${c.code}) — no province could be resolved`);
      continue;
    }
    (cities[provinceCode] ||= []).push({ code: c.code, name: cityLabel(c.name) });
  }
  for (const list of Object.values(cities)) list.sort(byName);

  // Every barangay hangs off exactly one of cityCode/municipalityCode; Manila's are the only
  // ones that also carry a subMunicipalityCode (its districts), and those still point at the
  // city, so one key per city/municipality covers all 42k of them.
  const barangays = {};
  for (const b of rawBarangays) {
    const parent = b.cityCode || b.municipalityCode;
    if (!parent) continue;
    (barangays[parent] ||= []).push(b.name);
  }
  for (const list of Object.values(barangays)) list.sort((a, b) => a.localeCompare(b, 'en'));

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    source: 'PSGC API (psgc.gitlab.io) — Philippine Statistics Authority',
    generatedAt: new Date().toISOString().slice(0, 10),
    provinces,
    cities,
    barangays,
  }));

  const cityCount = Object.values(cities).reduce((n, l) => n + l.length, 0);
  const barangayCount = Object.values(barangays).reduce((n, l) => n + l.length, 0);
  console.log(`Wrote ${OUT}`);
  console.log(`${provinces.length} provinces, ${cityCount} cities/municipalities, ${barangayCount} barangays`);
}

build().catch(err => { console.error(err); process.exit(1); });
