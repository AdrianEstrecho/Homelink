// Regenerates backend/data/psgc.json — the offline dataset behind address autocomplete.
//
// Two public sources are merged:
//   PSGC (psgc.gitlab.io)  — the official Philippine Standard Geographic Code: every province,
//                            city/municipality and barangay, with the parent links between them.
//   GeoNames (CC-BY 4.0)   — postal codes, which the PSGC does not carry.
//
// Run with: node scripts/build-psgc.js
// Sources download themselves into a scratch dir rather than being vendored, so this is a manual
// refresh — the PSGC changes a few times a year as barangays are created, renamed or chartered
// into cities, and the ~11 MB of raw input is not worth keeping in the tree.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { execFileSync } from 'child_process';

const SRC = resolve(process.argv[2] || '.psgc-src');
const OUT = resolve('data/psgc.json');

const PSGC_SETS = ['regions', 'provinces', 'cities-municipalities', 'barangays'];

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function ensureSources() {
  mkdirSync(SRC, { recursive: true });
  for (const set of PSGC_SETS) {
    const dest = join(SRC, `${set}.json`);
    if (existsSync(dest)) continue;
    console.log(`downloading ${set}...`);
    await download(`https://psgc.gitlab.io/api/${set}/`, dest);
  }
  if (!existsSync(join(SRC, 'PH.txt'))) {
    console.log('downloading GeoNames postal codes...');
    await download('https://download.geonames.org/export/zip/PH.zip', join(SRC, 'PH.zip'));
    // No unzip dependency for one file a year; both platforms ship something that can do it.
    execFileSync(process.platform === 'win32' ? 'powershell' : 'unzip',
      process.platform === 'win32'
        ? ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${join(SRC, 'PH.zip')}' -DestinationPath '${SRC}'`]
        : ['-o', '-q', join(SRC, 'PH.zip'), '-d', SRC],
      { stdio: 'inherit' });
  }
}

await ensureSources();

const read = (f) => JSON.parse(readFileSync(join(SRC, f), 'utf8'));

// Matching PSGC names against GeoNames ones needs both sides flattened to the same shape:
// accents dropped (Las Piñas/Las Pinas), the common civil abbreviations spelled out, and the
// "City of X" / "X City" pair collapsed, since the two registers disagree on which to use.
// CPO (central post office) goes too, so "Makati CPO" reduces to the city that it serves.
const norm = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\(.*?\)/g, ' ')
  .replace(/\bsta\.?\b/g, 'santa')
  .replace(/\bsto\.?\b/g, 'santo')
  .replace(/\bgen\.?\b/g, 'general')
  .replace(/\bpres\.?\b/g, 'president')
  .replace(/\bmt\.?\b/g, 'mount')
  .replace(/\bcity of\b/g, ' ')
  .replace(/\bcity\b/g, ' ')
  .replace(/\bmunicipality of\b/g, ' ')
  .replace(/\bprovince of\b/g, ' ')
  .replace(/\bcpo\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const regions = read('regions.json');
const provinces = read('provinces.json');
const cities = read('cities-municipalities.json');
const barangays = read('barangays.json');

// The PSGC files 19 cities under a region or district instead of a province: the 17 of Metro
// Manila, plus Isabela City and Cotabato City, which are administered apart from the province
// surrounding them. Addresses are still written with the geographic name, so that is what we show.
const NCR = '130000000';
// Listed newest-name-first: the PSGC splits and renames provinces between releases, so the first
// name the snapshot actually knows wins, and the region name is the last resort.
const ORPHAN_CITY_PROVINCE = {
  '099701000': ['Basilan'],                              // City of Isabela
  '129804000': ['Maguindanao del Norte', 'Maguindanao'], // City of Cotabato
};

const provinceNames = ['Metro Manila', ...provinces.map(p => p.name)].sort((a, b) => a.localeCompare(b));
const provinceIdx = new Map(provinceNames.map((n, i) => [n, i]));
const provinceByCode = new Map(provinces.map(p => [p.code, p.name]));

function provinceNameFor(city) {
  if (city.provinceCode) return provinceByCode.get(city.provinceCode);
  if (city.regionCode === NCR) return 'Metro Manila';
  const known = (ORPHAN_CITY_PROVINCE[city.code] || []).find(n => provinceIdx.has(n));
  return known || regions.find(r => r.code === city.regionCode)?.name;
}

// Postal codes. GeoNames names each row for the post office that serves it, so the useful key is
// the place plus the province it sits in — "San Isidro" alone is a dozen different barangays.
// A city's own code comes from its CPO row: "Makati CPO (Inc. Buendia Up To Edsa)" and
// "Manila CPO - Ermita" are the city-wide codes for Makati and Manila.
const zipRows = readFileSync(join(SRC, 'PH.txt'), 'utf8').split('\n').filter(Boolean).map(l => {
  const f = l.split('\t');
  return { zip: f[1], place: f[2], region: f[3], province: f[5] };
});

// A scope is a normalised province name. For NCR rows GeoNames puts "Metro Manila" in the region
// column and a postal district ("Southern Manila District") in the province one, so index both.
const zipByScopedPlace = new Map();  // "<scope>|<place>" -> zip, for barangay-level matches
const cityZipByScoped = new Map();   // "<scope>|<city>"  -> zip, CPO rows win over the rest
for (const r of zipRows) {
  const place = norm(r.place);
  if (!place) continue;
  const scopes = [norm(r.province), norm(r.region)].filter(Boolean);
  for (const scope of scopes) {
    const key = `${scope}|${place}`;
    if (!zipByScopedPlace.has(key)) zipByScopedPlace.set(key, r.zip);
  }
  // "Manila CPO - Ermita" serves the whole city, so credit it to "manila" as well as to Ermita.
  if (/\bCPO\b/i.test(r.place)) {
    const cityPart = norm(r.place.split(/\bCPO\b/i)[0]) || place;
    for (const scope of scopes) cityZipByScoped.set(`${scope}|${cityPart}`, r.zip);
  }
}

// GeoNames has no row for a handful of municipalities. These two are filled in by hand because
// they are ordinary Metro Manila delivery destinations; the rest keep an empty code, and the
// checkout form leaves the postal field for the customer to type.
const MANUAL_ZIP = {
  'metro manila|pateros': '1620',
  'metro manila|taguig': '1630',
};

const zipFor = (province, place) => {
  const key = `${norm(province)}|${norm(place)}`;
  return MANUAL_ZIP[key] || cityZipByScoped.get(key) || zipByScopedPlace.get(key) || '';
};

// Nine places are called "San Jose" and a search cannot tell them apart on the name alone.
// Chartered cities and provincial capitals are where the overwhelming majority of deliveries go,
// so the PSGC's own flags ride along as a rank and break that tie in the customer's favour.
//
// A deliberate score rather than a bitmask: being a chartered city counts for more than being a
// provincial capital, so San Jose City in Nueva Ecija sorts above San Jose, the capital of
// Antique, and a place that is both sorts above either.
const CITY_WEIGHT = 2;
const CAPITAL_WEIGHT = 1;

const cityRows = [];
const cityIdxByCode = new Map();
for (const c of cities) {
  const province = provinceNameFor(c);
  if (province === undefined || !provinceIdx.has(province)) {
    throw new Error(`No province mapping for ${c.name} (${c.code}, region ${c.regionCode})`);
  }
  const rank = (c.isCity ? CITY_WEIGHT : 0) + (c.isCapital ? CAPITAL_WEIGHT : 0);
  cityIdxByCode.set(c.code, cityRows.length);
  cityRows.push([c.name, provinceIdx.get(province), zipFor(province, c.name), rank]);
}

// A barangay hangs off whichever parent the PSGC filled in: municipalities use municipalityCode,
// cities use cityCode, and Manila's sub-municipality barangays carry cityCode for the city itself.
const barangayRows = [];
let orphanBarangays = 0;
for (const b of barangays) {
  const parent = b.cityCode || b.municipalityCode || b.subMunicipalityCode;
  const cIdx = cityIdxByCode.get(parent);
  if (cIdx === undefined) { orphanBarangays++; continue; }
  // Barangay codes matter most in Metro Manila, where each district has its own. Only a match
  // inside the barangay's own province counts — there are three "Bagong Nayon"s nationwide.
  // Storing '' when it equals the city's code keeps the file small; readers fall back to the city.
  const zip = zipFor(provinceNames[cityRows[cIdx][1]], b.name);
  barangayRows.push([b.name, cIdx, zip && zip !== cityRows[cIdx][2] ? zip : '']);
}

const out = { p: provinceNames, c: cityRows, b: barangayRows };
writeFileSync(OUT, JSON.stringify(out));

const withZip = (rows) => rows.filter(r => r[2]).length;
const chartered = cityRows.filter(r => r[3] >= CITY_WEIGHT).length;
console.log(`provinces ${provinceNames.length}`);
console.log(`cities    ${cityRows.length} (${withZip(cityRows)} with postal code, ${chartered} chartered cities)`);
console.log(`barangays ${barangayRows.length} (${withZip(barangayRows)} with own postal code, ${orphanBarangays} skipped)`);
console.log(`wrote     ${OUT} (${(JSON.stringify(out).length / 1e6).toFixed(2)} MB)`);
