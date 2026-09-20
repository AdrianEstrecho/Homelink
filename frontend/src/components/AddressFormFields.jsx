export const emptyAddressForm = { label: '', houseNumber: '', street: '', village: '', city: '', province: '', postalCode: '' };

// The one copy of the address form, shared by checkout (AddressPicker) and the account page
// (AddressesTab) — the two had drifted apart as duplicated field-for-field markup.
//
// Every part is free text on purpose: it's the fastest thing to fill in for someone who
// already knows their own address, and it accepts the ones no register spells the same way
// (subdivisions, phases, sitios, purok numbers).
export default function AddressFormFields({ form, onChange }) {
  const set = (patch) => onChange({ ...form, ...patch });

  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-gray-700">Label</label>
        <input value={form.label} onChange={e => set({ label: e.target.value })} placeholder="Home, Office, ..." className="input-field" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">House / Unit No.</label>
          <input value={form.houseNumber} onChange={e => set({ houseNumber: e.target.value })} placeholder="123" className="input-field" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1.5 text-gray-700">Street</label>
          <input value={form.street} onChange={e => set({ street: e.target.value })} placeholder="Rizal Street" className="input-field" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">Village / Barangay</label>
          <input value={form.village} onChange={e => set({ village: e.target.value })} placeholder="Barangay San Isidro" className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">City / Municipality</label>
          <input value={form.city} onChange={e => set({ city: e.target.value })} placeholder="Makati City" className="input-field" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">Province</label>
          <input value={form.province} onChange={e => set({ province: e.target.value })} placeholder="Metro Manila" className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-700">Postal Code</label>
          <input value={form.postalCode} onChange={e => set({ postalCode: e.target.value })} placeholder="1200" className="input-field" inputMode="numeric" />
        </div>
      </div>
    </>
  );
}
