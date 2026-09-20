import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Select from './Select';

export const emptyAddressForm = { label: '', houseNumber: '', street: '', village: '', city: '', province: '', postalCode: '' };

const toOptions = (names) => names.map(n => ({ value: n, label: n }));

// The saved address only ever holds names, so an address typed in before these dropdowns
// existed (or one whose PSGC spelling has since changed) would otherwise vanish from its own
// edit form. Keeping the stored value as an extra option means editing one field never
// silently rewrites another.
function withStoredValue(options, stored) {
  if (!stored || options.some(o => o.value === stored)) return options;
  return [{ value: stored, label: stored }, ...options];
}

// Province -> City/Municipality -> Barangay, all from the PSA's PSGC register (served by
// /api/locations, see backend/routes/locations.js). Each level is fetched only once its
// parent is picked, so the form never downloads all 42,000 barangays.
//
// Street is deliberately still free text: the Philippines has no national street register to
// build a dropdown from. What it does get is suggestions — the streets HomeLink already has
// addresses on in the chosen barangay — so repeat neighbourhoods autocomplete.
export default function AddressFormFields({ form, onChange }) {
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [streetHints, setStreetHints] = useState([]);

  const [provinceCode, setProvinceCode] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  const set = (patch) => onChange({ ...form, ...patch });

  useEffect(() => {
    api.get('/locations/provinces').then(d => setProvinces(d.provinces || [])).catch(() => setProvinces([]));
  }, []);

  // Re-attaches an already-saved address to the register: the province name it was stored
  // with picks the code back up, which in turn reloads its cities and barangays for editing.
  useEffect(() => {
    if (!provinces.length || provinceCode) return;
    const match = provinces.find(p => p.name.toLowerCase() === form.province?.trim().toLowerCase());
    if (match) setProvinceCode(match.code);
  }, [provinces, provinceCode, form.province]);

  useEffect(() => {
    if (!provinceCode) { setCities([]); return; }
    setLoadingCities(true);
    api.get(`/locations/cities?province=${provinceCode}`)
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [provinceCode]);

  useEffect(() => {
    if (!cities.length || cityCode) return;
    const match = cities.find(c => c.name.toLowerCase() === form.city?.trim().toLowerCase());
    if (match) setCityCode(match.code);
  }, [cities, cityCode, form.city]);

  useEffect(() => {
    if (!cityCode) { setBarangays([]); return; }
    setLoadingBarangays(true);
    api.get(`/locations/barangays?city=${cityCode}`)
      .then(setBarangays)
      .catch(() => setBarangays([]))
      .finally(() => setLoadingBarangays(false));
  }, [cityCode]);

  // Street suggestions are keyed on the names as stored, so they work just as well for an
  // address that predates the dropdowns. A failure here is silent — an empty suggestion list
  // still leaves a perfectly usable text field.
  useEffect(() => {
    if (!form.city) { setStreetHints([]); return; }
    const params = new URLSearchParams({ city: form.city, ...(form.village ? { barangay: form.village } : {}) });
    api.get(`/locations/streets?${params}`).then(setStreetHints).catch(() => setStreetHints([]));
  }, [form.city, form.village]);

  // Picking a parent clears everything under it — a barangay from the previous city would
  // otherwise stay behind and be saved against an address it doesn't belong to. Re-picking
  // the value that's already selected is a no-op, so reopening the dropdown on an address
  // whose stored name isn't in the register (see withStoredValue) doesn't wipe what's below.
  const pickProvince = (code) => {
    const picked = provinces.find(p => p.code === code);
    const name = picked ? picked.name : code;
    if (name === form.province) return;
    setProvinceCode(picked ? picked.code : '');
    setCityCode('');
    set({ province: name, city: '', village: '' });
  };

  const pickCity = (code) => {
    const picked = cities.find(c => c.code === code);
    const name = picked ? picked.name : code;
    if (name === form.city) return;
    setCityCode(picked ? picked.code : '');
    set({ city: name, village: '' });
  };

  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-gray-700">Label</label>
        <input value={form.label} onChange={e => set({ label: e.target.value })} placeholder="Home, Office, ..." className="input-field" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">Province</label>
          <Select
            searchable
            value={provinceCode || form.province}
            onChange={pickProvince}
            options={withStoredValue(provinces.map(p => ({ value: p.code, label: p.name })), provinceCode ? '' : form.province)}
            placeholder={provinces.length ? 'Select province' : 'Loading provinces...'}
            searchPlaceholder="Search provinces"
            emptyLabel="No province matches that"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">City / Municipality</label>
          <Select
            searchable
            disabled={!provinceCode && !form.city}
            value={cityCode || form.city}
            onChange={pickCity}
            options={withStoredValue(cities.map(c => ({ value: c.code, label: c.name })), cityCode ? '' : form.city)}
            placeholder={!provinceCode ? 'Pick a province first' : loadingCities ? 'Loading cities...' : 'Select city / municipality'}
            searchPlaceholder="Search cities"
            emptyLabel="No city matches that"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">Village / Barangay</label>
          <Select
            searchable
            disabled={!cityCode && !form.village}
            value={form.village}
            onChange={village => set({ village })}
            options={withStoredValue(toOptions(barangays), form.village)}
            placeholder={!cityCode ? 'Pick a city first' : loadingBarangays ? 'Loading barangays...' : 'Select barangay'}
            searchPlaceholder="Search barangays"
            emptyLabel="No barangay matches that"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">Street</label>
          <input
            value={form.street}
            onChange={e => set({ street: e.target.value })}
            placeholder="Rizal Street"
            className="input-field"
            list="homelink-street-hints"
            autoComplete="off"
          />
          <datalist id="homelink-street-hints">
            {streetHints.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">House / Unit No.</label>
          <input value={form.houseNumber} onChange={e => set({ houseNumber: e.target.value })} placeholder="123" className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">Postal Code</label>
          <input value={form.postalCode} onChange={e => set({ postalCode: e.target.value })} placeholder="1200" className="input-field" inputMode="numeric" />
        </div>
      </div>
    </>
  );
}
