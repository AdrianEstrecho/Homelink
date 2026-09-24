import { api } from '../api/client';
import AutocompleteInput from './AutocompleteInput';

export const emptyAddressForm = { label: '', houseNumber: '', street: '', village: '', city: '', province: '', postalCode: '' };

const qs = (params) => new URLSearchParams(
  Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
).toString();

// The one copy of the address form, shared by checkout (AddressPicker) and the account page
// (AddressesTab) — the two had drifted apart as duplicated field-for-field markup.
//
// Province, city and barangay suggest from the PSGC, the official register, served offline by
// our own API. Streets come from a geocoder and are only as complete as OpenStreetMap is in that
// municipality. Both are advisory: every field is still an ordinary text input, because no
// register spells every subdivision, phase, sitio or purok the way its residents write it.
export default function AddressFormFields({ form, onChange }) {
  const set = (patch) => onChange({ ...form, ...patch });

  // Picking a barangay or a city settles which province it is in, so the parent fields follow.
  // The postal code is only written over when it is blank or was itself filled in this way —
  // a code typed by hand is more likely to be right about a specific barangay than our table is.
  const fillFrom = (patch) => {
    const next = { ...form, ...patch };
    if (patch.postalCode && form.postalCode && !form.postalCodeAuto) next.postalCode = form.postalCode;
    next.postalCodeAuto = patch.postalCode ? next.postalCode === patch.postalCode : form.postalCodeAuto;
    onChange(next);
  };

  // Errors are deliberately left to propagate: AutocompleteInput tells a failed lookup apart
  // from one that legitimately found nothing, and says something different about each. Swallowing
  // them here would report every outage as "no such address".
  const search = (path, params) => api.get(`/geo/${path}?${qs(params)}`);

  return (
    <>
      <div>
        <label htmlFor="addr-label" className="block text-sm font-medium mb-1.5 text-gray-700">Label</label>
        <input id="addr-label" value={form.label} onChange={e => set({ label: e.target.value })} placeholder="Home, Office, ..." className="input-field" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="addr-house" className="block text-sm font-medium mb-1.5 text-gray-700">House / Unit No.</label>
          <input id="addr-house" value={form.houseNumber} onChange={e => set({ houseNumber: e.target.value })} placeholder="123" className="input-field" />
        </div>
        <div className="col-span-2">
          <label htmlFor="addr-street" className="block text-sm font-medium mb-1.5 text-gray-700">Street</label>
          <AutocompleteInput
            id="addr-street"
            value={form.street}
            onChange={street => set({ street })}
            // Scoped to the city already chosen, since a street name repeats in a hundred
            // municipalities. Three characters is the geocoder's own floor for a useful query.
            minChars={3}
            // The only field that leaves the building. The public geocoder answers in about a
            // second and a half, so a longer pause before asking is free in felt speed and saves
            // a string of requests that would be thrown away mid-word anyway.
            debounceMs={400}
            fetchSuggestions={q => search('streets', { q, city: form.city, province: form.province })}
            getLabel={s => s.street}
            getDescription={s => [s.village, s.city, s.province].filter(Boolean).join(', ')}
            getKey={(s, i) => `${s.street}-${s.city}-${i}`}
            // A geocoded street knows its barangay, city and province, but names them the way
            // OpenStreetMap does ("Antipolo", not the register's "City of Antipolo"), so it only
            // fills fields still empty rather than overwriting the official names.
            onSelect={s => fillFrom({
              street: s.street,
              ...(form.village ? {} : { village: s.village || '' }),
              ...(form.city ? {} : { city: s.city || '' }),
              ...(form.province ? {} : { province: s.province || '' }),
              ...(s.postalCode ? { postalCode: s.postalCode } : {}),
            })}
            placeholder="Rizal Street"
            // Not the same situation as a name the register does not carry: the street almost
            // certainly exists, OpenStreetMap just has not mapped it yet in that municipality.
            emptyMessage="No street found here — type it in as you write it."
            // The geocoder is a free shared service that is sometimes slow enough to time out.
            // Saying "not found" then would be a claim about the address that we cannot make.
            errorMessage="Street lookup unavailable right now — type it in as you write it."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="addr-village" className="block text-sm font-medium mb-1.5 text-gray-700">Village / Barangay</label>
          <AutocompleteInput
            id="addr-village"
            value={form.village}
            onChange={village => set({ village })}
            fetchSuggestions={q => search('barangays', { q, city: form.city, province: form.province })}
            getDescription={b => `${b.city}, ${b.province}`}
            onSelect={b => fillFrom({ village: b.name, city: b.city, province: b.province, postalCode: b.postalCode })}
            placeholder="Barangay San Isidro"
            // Subdivisions, phases, sitios and purok numbers are not barangays and will never be
            // in the register, so an empty list here is expected rather than a dead end.
            emptyMessage="Not a registered barangay — type your village or subdivision."
          />
        </div>
        <div>
          <label htmlFor="addr-city" className="block text-sm font-medium mb-1.5 text-gray-700">City / Municipality</label>
          <AutocompleteInput
            id="addr-city"
            value={form.city}
            onChange={city => set({ city })}
            fetchSuggestions={q => search('cities', { q, province: form.province })}
            getDescription={c => c.province}
            onSelect={c => fillFrom({ city: c.name, province: c.province, postalCode: c.postalCode })}
            placeholder="Makati City"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="addr-province" className="block text-sm font-medium mb-1.5 text-gray-700">Province</label>
          <AutocompleteInput
            id="addr-province"
            value={form.province}
            onChange={province => set({ province })}
            fetchSuggestions={q => search('provinces', { q })}
            onSelect={p => set({ province: p.name })}
            placeholder="Metro Manila"
          />
        </div>
        <div>
          <label htmlFor="addr-postal" className="block text-sm font-medium mb-1.5 text-gray-700">Postal Code</label>
          <input
            id="addr-postal"
            value={form.postalCode}
            // Typing here marks the code as the customer's own, so a later city or barangay pick
            // leaves it alone.
            onChange={e => set({ postalCode: e.target.value, postalCodeAuto: false })}
            placeholder="1200"
            className="input-field"
            inputMode="numeric"
          />
        </div>
      </div>
    </>
  );
}
