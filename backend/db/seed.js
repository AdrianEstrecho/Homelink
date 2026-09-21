import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from './database.js';

console.log('Seeding HomeLink database...');

// reviews.order_id and pending_checkouts/pending_bookings.order_id/booking_id have no cascade,
// so they must go before orders/bookings; same for subcategories, which self-reference their
// parent via parent_id and must go before the parent row. support_replies.author_id,
// change_requests.requested_by/reviewed_by, notifications.user_id, and
// staff_messages.sender_id/recipient_id all reference users with no cascade too, so they must
// go before users.
await db.exec('DELETE FROM reviews; DELETE FROM order_items; DELETE FROM pending_checkouts; DELETE FROM orders; DELETE FROM pending_bookings; DELETE FROM bookings; DELETE FROM vouchers; DELETE FROM products; DELETE FROM services; DELETE FROM categories WHERE parent_id IS NOT NULL; DELETE FROM categories; DELETE FROM announcements; DELETE FROM gallery; DELETE FROM audit_logs; DELETE FROM support_replies; DELETE FROM change_requests; DELETE FROM notifications; DELETE FROM staff_messages; DELETE FROM general_chat_messages; DELETE FROM general_chat_reads; DELETE FROM users;');

const adminId = uuid();
const emp1 = uuid();
const emp2 = uuid();
const hrEmp = uuid();
const custId = uuid();
const hash = await bcrypt.hash('password123', 10);
const adminHash = await bcrypt.hash('admin123', 10);

await db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, staff_code, verified) VALUES (?,?,?,?,?,?,?,?,?,1)')
  .run(adminId, 'admin@homelink.com', adminHash, 'System', 'Admin', '09171234567', '123 HomeLink Ave', 'admin', 'SA001');
await db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, staff_code, verified) VALUES (?,?,?,?,?,?,?,?,?,1)')
  .run(emp1, 'juan.delacruz@homelink.com', hash, 'Juan', 'Delacruz', '09181111111', 'Manila', 'employee', 'EMP001');
await db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, staff_code, verified) VALUES (?,?,?,?,?,?,?,?,?,1)')
  .run(emp2, 'maria.santos@homelink.com', hash, 'Maria', 'Santos', '09182222222', 'Quezon City', 'employee', 'EMP002');
await db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, position, staff_code, salary, verified) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)')
  .run(hrEmp, 'hr@homelink.com', hash, 'Liza', 'Fernandez', '09185555555', 'Mandaluyong City', 'employee', 'hr', 'HR001', 32000);
await db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, verified) VALUES (?,?,?,?,?,?,?,?,1)')
  .run(custId, 'customer@demo.com', hash, 'Demo', 'Customer', '09183333333', 'Makati City', 'customer');

const categories = [
  { id: uuid(), name: 'Air Conditioners', slug: 'air-conditioners', description: 'Split type, window type, and inverter AC units', image: 'https://images.unsplash.com/photo-1718203862467-c33159fdc504?w=400' },
  { id: uuid(), name: 'Solar Panels', slug: 'solar-panels', description: 'Solar panel systems and accessories', image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400' },
  { id: uuid(), name: 'CCTV & Security', slug: 'cctv-security', description: 'Security cameras and surveillance systems', image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=400' },
  { id: uuid(), name: 'Electrical', slug: 'electrical', description: 'Electrical materials and accessories', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400' },
  { id: uuid(), name: 'Plumbing', slug: 'plumbing', description: 'Plumbing supplies and fixtures', image: 'https://images.unsplash.com/photo-1521207418485-99c705420785?w=400' },
  { id: uuid(), name: 'Smart Home', slug: 'smart-home', description: 'Smart home devices and automation', image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=400' },
  { id: uuid(), name: 'Home Appliances', slug: 'home-appliances', description: 'Essential home appliances', image: 'https://images.unsplash.com/photo-1722649939430-9f615b049e7c?w=400' },
  { id: uuid(), name: 'Lighting', slug: 'lighting', description: 'LED lights and fixtures', image: 'https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=400' },
  { id: uuid(), name: 'Tools', slug: 'tools', description: 'Home improvement tools', image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400' },
];

const insertCat = db.prepare('INSERT INTO categories (id, name, slug, description, image) VALUES (?,?,?,?,?)');
for (const c of categories) await insertCat.run(c.id, c.name, c.slug, c.description, c.image);

const catMap = Object.fromEntries(categories.map(c => [c.slug, c.id]));

const subcategories = [
  { id: uuid(), name: 'Split Type', slug: 'ac-split-type', parentSlug: 'air-conditioners' },
  { id: uuid(), name: 'Window Type', slug: 'ac-window-type', parentSlug: 'air-conditioners' },
  { id: uuid(), name: 'Refrigerators', slug: 'appliances-refrigerators', parentSlug: 'home-appliances' },
  { id: uuid(), name: 'Washing Machines', slug: 'appliances-washing-machines', parentSlug: 'home-appliances' },
  { id: uuid(), name: 'IP Cameras', slug: 'cctv-ip-cameras', parentSlug: 'cctv-security' },
];
const insertSubcat = db.prepare('INSERT INTO categories (id, name, slug, description, image, parent_id) VALUES (?,?,?,?,?,?)');
for (const s of subcategories) await insertSubcat.run(s.id, s.name, s.slug, null, null, catMap[s.parentSlug]);
const subcatMap = Object.fromEntries(subcategories.map(s => [s.slug, s.id]));

const products = [
  {
    name: 'Daikin Inverter Split AC 1.5HP', slug: 'daikin-inverter-1-5hp', cat: 'ac-split-type', price: 32999, stock: 25, featured: 1,
    image: 'https://images.unsplash.com/photo-1718203862467-c33159fdc504?w=600',
    model: 'FTKC35TVM', warranty: '5 years on compressor, 1 year on parts and labor',
    desc: 'A 1.5HP wall-mounted inverter split system built for Philippine homes, sized for bedrooms and small living areas of roughly 16-20 square meters. The inverter compressor ramps up and down instead of cycling on and off, so the room holds its set temperature with noticeably less noise and a lower monthly bill.',
    highlights: ['Inverter compressor cuts power draw up to 40% vs. non-inverter units', 'Whisper-quiet 19dB night mode', 'Washable antibacterial filter', 'R32 refrigerant for lower environmental impact'],
    specs: { Brand: 'Daikin', 'Cooling Capacity': '1.5 HP (12,000 BTU/hr)', Type: 'Split Wall-Mounted Inverter', 'Energy Rating': '5 Star', Refrigerant: 'R32', 'Noise Level': '19-42 dB', 'Room Size': '16-20 sqm', 'Power Supply': '230V / 60Hz', Dimensions: '798 x 265 x 195 mm (indoor)' },
  },
  {
    name: 'Carrier Window Type AC 2.0HP', slug: 'carrier-window-2hp', cat: 'ac-window-type', price: 24999, stock: 18, featured: 1,
    image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600',
    model: 'WCARJ024EE', warranty: '5 years on compressor, 1 year on parts and labor',
    desc: 'A 2.0HP window-type unit that drops into a standard wall or window opening without the outdoor condenser a split system needs. Straightforward to install and service, it suits rooms of 20-26 square meters where a simple, dependable cooler beats extra features.',
    highlights: ['Fits standard window and wall openings', 'Remote control with 24-hour timer', 'Washable filter with easy front access', 'Auto-restart after power interruption'],
    specs: { Brand: 'Carrier', 'Cooling Capacity': '2.0 HP (18,000 BTU/hr)', Type: 'Window Type', 'Energy Rating': '3 Star', Refrigerant: 'R410A', 'Room Size': '20-26 sqm', 'Power Supply': '230V / 60Hz', Controls: 'Remote + panel' },
  },
  {
    name: '5kW Solar Panel System Kit', slug: '5kw-solar-kit', cat: 'solar-panels', price: 185000, stock: 8, featured: 1,
    image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600',
    model: 'HL-SOLAR-5K', warranty: '25 years on panels, 10 years on inverter',
    desc: 'A complete grid-tied solar package for a typical family home: twelve 420W monocrystalline panels, a 5kW hybrid inverter, mounting rails and all DC/AC protection gear. Sized to offset most of the daytime consumption of a household running an aircon, refrigerator and the usual appliances.',
    highlights: ['Everything needed for a grid-tied install in one kit', 'Typically offsets 60-80% of a monthly bill', 'Hybrid inverter is battery-ready for later expansion', 'Net metering documentation assistance included'],
    specs: { 'System Capacity': '5 kW', Panels: '12 x 420W Monocrystalline', Inverter: '5kW Hybrid (included)', 'Panel Efficiency': '21.3%', Mounting: 'Aluminum rail kit for metal or tile roof', 'Roof Area Needed': '~28 sqm', 'Battery Ready': 'Yes', Certification: 'IEC 61215 / IEC 61730' },
  },
  {
    name: '3kW Solar Panel Starter Kit', slug: '3kw-solar-starter', cat: 'solar-panels', price: 98000, stock: 12, featured: 0,
    image: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=600',
    model: 'HL-SOLAR-3K', warranty: '25 years on panels, 10 years on inverter',
    desc: 'An entry-level grid-tied array for smaller households or anyone testing the water before committing to a full rooftop system. Eight 375W panels and a 3kW inverter cover daytime lighting, fans, a refrigerator and light aircon use.',
    highlights: ['Lower entry cost for first-time solar owners', 'Expandable: add panels later on the same rails', 'Monitoring app shows live and historical output', 'Fits compact roofs from around 18 sqm'],
    specs: { 'System Capacity': '3 kW', Panels: '8 x 375W Monocrystalline', Inverter: '3kW Grid-Tied (included)', 'Panel Efficiency': '20.1%', 'Roof Area Needed': '~18 sqm', Monitoring: 'WiFi app', Expandable: 'Yes, up to 5kW' },
  },
  {
    name: 'Hikvision 4-Camera CCTV Kit', slug: 'hikvision-4cam-kit', cat: 'cctv-ip-cameras', price: 15999, stock: 30, featured: 1,
    image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600',
    model: 'DS-7104NI-K1/4P', warranty: '2 years on cameras and NVR',
    desc: 'A four-camera surveillance bundle for a standard house or small shop, covering the gate, driveway and two approaches. Recording runs to a 1TB NVR with roughly two weeks of continuous footage, and the mobile app streams every camera live from anywhere.',
    highlights: ['Full 1080p recording on all four channels', '30-meter infrared night vision', 'Motion alerts pushed to your phone', 'Weatherproof IP67 housings for outdoor use'],
    specs: { Brand: 'Hikvision', Cameras: '4 x 2MP Bullet', Resolution: '1080p Full HD', Storage: '1TB NVR (included)', 'Night Vision': 'Up to 30m IR', 'Weather Rating': 'IP67', 'Mobile App': 'Hik-Connect (iOS / Android)', 'Cabling Included': '4 x 18m network cable' },
  },
  {
    name: 'Dahua 8-Camera IP System', slug: 'dahua-8cam-ip', cat: 'cctv-security', price: 38500, stock: 10, featured: 0,
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600',
    model: 'NVR4108HS-8P-4KS2', warranty: '2 years on cameras and NVR',
    desc: 'An eight-channel 4MP IP system for larger homes, warehouses and commercial spaces that need more than a starter kit can cover. Power-over-Ethernet means each camera needs only one cable for both data and power, which keeps a bigger install tidy.',
    highlights: ['4MP detail keeps plates and faces readable', 'Single-cable PoE runs up to 100m per camera', '2TB storage for roughly 30 days of footage', 'Smart motion detection filters out rain and foliage'],
    specs: { Brand: 'Dahua', Cameras: '8 x 4MP Turret', Resolution: '4MP (2560 x 1440)', Type: 'IP PoE', Storage: '2TB NVR (included)', 'Night Vision': 'Up to 50m IR', 'Weather Rating': 'IP67', 'Max Cable Run': '100m per camera' },
  },
  {
    name: 'Schneider Circuit Breaker Panel', slug: 'schneider-breaker-panel', cat: 'electrical', price: 4500, stock: 40, featured: 0,
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600',
    model: 'EZ9-12WAY', warranty: '2 years manufacturer warranty',
    desc: 'A 12-slot load center for a new build or a panel upgrade on an older house that has outgrown its original board. The enclosure is powder-coated steel with a hinged cover and a clearly labelled busbar, so an electrician can lay out circuits cleanly.',
    highlights: ['12 usable slots for branch circuits', '100A main busbar rating', 'Flush or surface mounting', 'Pre-printed circuit labels included'],
    specs: { Brand: 'Schneider Electric', Slots: '12 way', Amperage: '100A', 'Voltage Rating': '230V single phase', Enclosure: 'Powder-coated steel', Mounting: 'Flush or surface', Standard: 'IEC 61439-3' },
  },
  {
    name: 'Copper Wire 2.0mm (100m roll)', slug: 'copper-wire-2mm', cat: 'electrical', price: 3200, stock: 50, featured: 0,
    image: 'https://images.unsplash.com/photo-1610028290816-5d937a395a49?w=600',
    model: 'THHN-2.0-100', warranty: 'Manufacturer defect replacement within 30 days',
    desc: 'A 100-meter roll of 2.0mm pure-copper THHN building wire, the workhorse gauge for convenience outlets and lighting circuits in Philippine residential wiring. Nylon-jacketed insulation resists heat, oil and moisture during conduit pulls.',
    highlights: ['99.9% pure annealed copper conductor', 'Rated 75C wet and 90C dry', 'PVC and nylon jacket pulls easily through conduit', 'PNS-certified for residential use'],
    specs: { Gauge: '2.0 sq mm (14 AWG)', Length: '100 m', Material: 'Annealed Copper', Insulation: 'PVC / Nylon (THHN)', 'Temperature Rating': '75C wet / 90C dry', 'Voltage Rating': '600V', Certification: 'PNS / UL listed' },
  },
  {
    name: 'Kohler Kitchen Faucet Set', slug: 'kohler-faucet-set', cat: 'plumbing', price: 8500, stock: 22, featured: 0,
    image: 'https://images.unsplash.com/photo-1521207418485-99c705420785?w=600',
    model: 'K-596-CP', warranty: 'Lifetime warranty on finish and function',
    desc: 'A single-handle pull-down kitchen faucet in polished chrome, with a magnetic docking spray head that snaps back into place instead of drooping over time. A ceramic disc cartridge keeps the handle smooth and drip-free through years of daily use.',
    highlights: ['Pull-down spray head with magnetic docking', 'Ceramic disc cartridge for drip-free operation', 'Three-function spray: stream, sweep, pause', 'Supply lines and mounting hardware included'],
    specs: { Brand: 'Kohler', Finish: 'Polished Chrome', Type: 'Single-handle Pull-down', 'Spout Reach': '229 mm', 'Spout Height': '390 mm', 'Hole Requirement': '1 or 3 hole', Cartridge: 'Ceramic disc', 'Flow Rate': '5.7 L/min' },
  },
  {
    name: 'PVC Pipe Set (Assorted)', slug: 'pvc-pipe-set', cat: 'plumbing', price: 1800, stock: 60, featured: 0,
    image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600',
    model: 'HL-PVC-ASSORT-20', warranty: 'Manufacturer defect replacement within 30 days',
    desc: 'A 20-piece assortment of PVC pipe and fittings from half-inch to two-inch, covering the sizes a typical repair or small renovation runs through. Includes elbows, tees, couplings and reducers so a job does not stall over one missing fitting.',
    highlights: ['20 pieces spanning half-inch to two-inch', 'Elbows, tees, couplings and reducers included', 'Solvent-weld joints need no special tools', 'Rated for cold water supply and drainage'],
    specs: { Sizes: 'Half-inch to two-inch', Pieces: '20', Material: 'uPVC', 'Joint Type': 'Solvent weld', 'Pressure Rating': 'Series 1000 (cold water)', Standard: 'PNS 65', Includes: 'Elbows, tees, couplings, reducers' },
  },
  {
    name: 'Google Nest Thermostat', slug: 'google-nest-thermostat', cat: 'smart-home', price: 12500, stock: 15, featured: 1,
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600',
    model: 'GA01334-US', warranty: '2 years manufacturer warranty',
    desc: 'A learning thermostat that builds a schedule from how you actually adjust the temperature, then holds it automatically. It works with the Google Home app for remote control, and the monthly energy report shows exactly where the savings came from.',
    highlights: ['Learns your schedule in about a week', 'Remote control from the Google Home app', 'Monthly energy report with savings breakdown', 'Works with Google Assistant and Alexa'],
    specs: { Brand: 'Google', Connectivity: 'WiFi 802.11 b/g/n (2.4GHz)', Display: '1.54-inch color LCD', Power: '24V HVAC or USB-C', 'Voice Assistants': 'Google Assistant, Alexa', Sensors: 'Temperature, humidity, occupancy', Dimensions: '108 x 108 x 32 mm' },
  },
  {
    name: 'Smart Door Lock with Fingerprint', slug: 'smart-door-lock', cat: 'smart-home', price: 9800, stock: 20, featured: 0,
    image: 'https://images.unsplash.com/photo-1662106088835-2ac8adea34dd?w=600',
    model: 'HL-LOCK-F200', warranty: '1 year manufacturer warranty',
    desc: 'A keyless deadbolt that opens by fingerprint, PIN, app or a mechanical key as backup. It stores up to 100 fingerprints, and temporary PIN codes let you give a house helper or visiting relative access without handing over a key.',
    highlights: ['Four ways in: fingerprint, PIN, app, physical key', 'Stores up to 100 fingerprints', 'Temporary codes for guests and helpers', 'Low-battery warning about 30 days ahead'],
    specs: { Unlock: 'Fingerprint, PIN, App, Key', 'Fingerprint Capacity': '100', Battery: '4 x AA (approx. 8 months)', Connectivity: 'Bluetooth + WiFi bridge', 'Emergency Power': 'USB-C external', 'Door Thickness': '35-55 mm', 'Recognition Speed': '0.5 seconds' },
  },
  {
    name: 'Samsung Refrigerator 2-Door', slug: 'samsung-fridge-2door', cat: 'appliances-refrigerators', price: 28999, stock: 10, featured: 1,
    image: 'https://images.unsplash.com/photo-1722649939430-9f615b049e7c?w=600',
    model: 'RT38K5030S8', warranty: '10 years on inverter compressor, 1 year on parts',
    desc: 'A 380-litre top-mount no-frost refrigerator sized for a family of four to five. The digital inverter compressor adjusts speed with the cooling load rather than switching on and off, which keeps temperatures steadier and running costs down.',
    highlights: ['380L capacity suits a family of 4-5', 'Digital inverter compressor with 10-year warranty', 'No-frost cooling needs no manual defrosting', 'Tempered glass shelves rated for 150kg'],
    specs: { Brand: 'Samsung', Capacity: '380 L', Type: 'Two-door No Frost', Compressor: 'Digital Inverter', 'Energy Rating': '5 Star', Refrigerant: 'R600a', Shelves: 'Tempered glass (150kg rated)', Dimensions: '1786 x 675 x 668 mm' },
  },
  {
    name: 'LG Front Load Washing Machine', slug: 'lg-front-load-washer', cat: 'appliances-washing-machines', price: 32999, stock: 8, featured: 0,
    image: 'https://images.unsplash.com/photo-1752805869096-9b149e6effa1?w=600',
    model: 'FV1408S4W', warranty: '10 years on motor, 1 year on parts and labor',
    desc: 'An 8kg front-load washer with an Inverter Direct Drive motor that turns the drum without a belt, meaning fewer moving parts, less vibration and far less noise. Fourteen wash programmes cover everything from a quick 30-minute cycle to heavy bedding.',
    highlights: ['Inverter Direct Drive motor with 10-year warranty', '6 Motion drum action protects fabrics', 'Steam wash removes allergens', '14 programmes including a 30-minute quick cycle'],
    specs: { Brand: 'LG', Capacity: '8 kg', Type: 'Front Load Inverter Direct Drive', 'Spin Speed': '1400 rpm', Programs: '14', 'Energy Rating': '5 Star', 'Steam Wash': 'Yes', Dimensions: '600 x 565 x 850 mm' },
  },
  {
    name: 'Philips LED Downlight (6-pack)', slug: 'philips-led-downlight-6', cat: 'lighting', price: 2400, stock: 45, featured: 0,
    image: 'https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=600',
    model: 'DN027B-9W', warranty: '2 years manufacturer warranty',
    desc: 'A six-pack of 9W recessed LED downlights in warm white, sized for the standard 90mm ceiling cutout used in most Philippine homes. Each draws a fraction of the power of the halogen it replaces while putting out 800 lumens.',
    highlights: ['9W draw replaces a 60W halogen', '800 lumens of warm white 3000K light', '25,000-hour rated life', 'Fits the standard 90mm ceiling cutout'],
    specs: { Brand: 'Philips', Wattage: '9 W', 'Light Output': '800 lumens', 'Color Temperature': '3000K Warm White', 'Cutout Size': '90 mm', 'Beam Angle': '100 degrees', Lifespan: '25,000 hours', 'Pack Size': '6 pieces' },
  },
  {
    name: 'Bosch Power Drill Kit', slug: 'bosch-drill-kit', cat: 'tools', price: 6500, stock: 25, featured: 0,
    image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600',
    model: 'GSB 18V-50', warranty: '2 years on tool, 1 year on batteries',
    desc: 'An 18V cordless hammer drill driver that ships with two batteries, so one charges while the other works. Hammer mode handles concrete and masonry, and the 20-position clutch keeps it from stripping screws in softer material.',
    highlights: ['Two 2.0Ah batteries mean no downtime', 'Hammer mode for concrete and masonry', '20-position clutch plus drill and hammer settings', 'Carry case and charger included'],
    specs: { Brand: 'Bosch', Voltage: '18 V', 'Max Torque': '50 Nm', 'Chuck Size': '13 mm keyless', 'Clutch Settings': '20 + drill + hammer', 'No-load Speed': '0-1,700 rpm', Includes: '2 x 2.0Ah batteries, charger, case', Weight: '1.1 kg' },
  },
];

const allCatMap = { ...catMap, ...subcatMap };
const insertProd = db.prepare(`INSERT INTO products
  (id, category_id, name, slug, description, specifications, highlights, price, stock, image, featured, brand, model, warranty, status)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
for (const p of products) {
  await insertProd.run(uuid(), allCatMap[p.cat], p.name, p.slug, p.desc, JSON.stringify(p.specs), JSON.stringify(p.highlights),
    p.price, p.stock, p.image, p.featured, p.specs.Brand || null, p.model, p.warranty, 'active');
}

const services = [
  { name: 'Air Conditioner Installation', slug: 'ac-installation', category: 'Air Conditioning', price: 3500, desc: 'Professional split or window AC installation with leak testing.' },
  { name: 'Air Conditioner Cleaning', slug: 'ac-cleaning', category: 'Air Conditioning', price: 1500, desc: 'Deep cleaning of filters, coils, and drainage system.' },
  { name: 'Air Conditioner Repair', slug: 'ac-repair', category: 'Air Conditioning', price: 2000, desc: 'Diagnosis and repair of AC units including refrigerant refill.' },
  { name: 'Solar Panel Installation', slug: 'solar-installation', category: 'Solar Energy', price: 15000, desc: 'Complete solar panel system installation with grid connection.' },
  { name: 'Solar Panel Maintenance', slug: 'solar-maintenance', category: 'Solar Energy', price: 5000, desc: 'Panel cleaning, inverter check, and performance optimization.' },
  { name: 'CCTV Installation', slug: 'cctv-installation', category: 'Security', price: 4500, desc: 'Camera mounting, cabling, and NVR/DVR setup.' },
  { name: 'CCTV Repair', slug: 'cctv-repair', category: 'Security', price: 1800, desc: 'Camera and recording system troubleshooting and repair.' },
  { name: 'Electrical Installation', slug: 'electrical-installation', category: 'Electrical', price: 3000, desc: 'Wiring, outlets, switches, and breaker panel installation.' },
  { name: 'Electrical Troubleshooting', slug: 'electrical-troubleshooting', category: 'Electrical', price: 1500, desc: 'Diagnosis and repair of electrical issues and outages.' },
  { name: 'Plumbing Installation', slug: 'plumbing-installation', category: 'Plumbing', price: 2500, desc: 'Pipe fitting, fixture installation, and water line setup.' },
  { name: 'Plumbing Repair', slug: 'plumbing-repair', category: 'Plumbing', price: 1200, desc: 'Leak repair, clog removal, and pipe replacement.' },
  { name: 'General Home Maintenance', slug: 'general-maintenance', category: 'General', price: 2000, desc: 'Routine home inspection and minor repairs.' },
  { name: 'House Repair Services', slug: 'house-repair', category: 'General', price: 3500, desc: 'Structural and cosmetic home repair services.' },
  { name: 'Preventive Maintenance', slug: 'preventive-maintenance', category: 'General', price: 2500, desc: 'Scheduled preventive maintenance for home systems.' },
];

const insertSvc = db.prepare('INSERT INTO services (id, name, slug, description, category, base_price, duration_hours, image) VALUES (?,?,?,?,?,?,?,?)');
for (const s of services) await insertSvc.run(uuid(), s.name, s.slug, s.desc, s.category, s.price, 2 + Math.random() * 3, 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600');

await db.prepare('INSERT INTO vouchers (id, code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until) VALUES (?,?,?,?,?,?,?,?)')
  .run(uuid(), 'HOMELINK10', 'percent', 10, 5000, 100, '2025-01-01', '2027-12-31');
await db.prepare('INSERT INTO vouchers (id, code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until) VALUES (?,?,?,?,?,?,?,?)')
  .run(uuid(), 'SAVE500', 'fixed', 500, 3000, 50, '2025-01-01', '2027-12-31');
await db.prepare('INSERT INTO vouchers (id, code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until) VALUES (?,?,?,?,?,?,?,?)')
  .run(uuid(), 'NEWHOME20', 'percent', 20, 10000, 30, '2025-01-01', '2027-12-31');

await db.prepare('INSERT INTO announcements (id, title, content, type) VALUES (?,?,?,?)')
  .run(uuid(), 'Summer AC Sale!', 'Get up to 20% off on all air conditioners this summer. Free installation on select models.', 'promo');
await db.prepare('INSERT INTO announcements (id, title, content, type) VALUES (?,?,?,?)')
  .run(uuid(), 'New Solar Panel Kits Available', 'Go green with our new 3kW and 5kW solar panel starter kits. Book installation today!', 'info');

const galleryItems = [
  { title: 'AC Installation Project', category: 'Air Conditioning', image: 'https://images.unsplash.com/photo-1718203862467-c33159fdc504?w=800' },
  { title: 'Solar Panel Setup', category: 'Solar Energy', image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800' },
  { title: 'CCTV Security System', category: 'Security', image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800' },
  { title: 'Smart Home Setup', category: 'Smart Home', image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800' },
  { title: 'Electrical Panel Upgrade', category: 'Electrical', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800' },
  { title: 'Plumbing Renovation', category: 'Plumbing', image: 'https://images.unsplash.com/photo-1521207418485-99c705420785?w=800' },
];
const insertGal = db.prepare('INSERT INTO gallery (id, title, image, category, sort_order) VALUES (?,?,?,?,?)');
for (let i = 0; i < galleryItems.length; i++) {
  const g = galleryItems[i];
  await insertGal.run(uuid(), g.title, g.image, g.category, i);
}

const reviewers = [
  { name: ['Anna', 'Reyes'], email: 'anna.reyes@example.com', phone: '09171112222', address: 'Pasig City' },
  { name: ['Mark', 'Villanueva'], email: 'mark.villanueva@example.com', phone: '09172223333', address: 'Taguig City' },
  { name: ['Grace', 'Tan'], email: 'grace.tan@example.com', phone: '09173334444', address: 'Quezon City' },
  { name: ['Carlo', 'Mendoza'], email: 'carlo.mendoza@example.com', phone: '09174445555', address: 'Manila' },
];
const reviewerIds = [];
for (const r of reviewers) {
  const id = uuid();
  await db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, verified) VALUES (?,?,?,?,?,?,?,?,1)')
    .run(id, r.email, hash, r.name[0], r.name[1], r.phone, r.address, 'customer');
  reviewerIds.push(id);
}

const productBySlug = Object.fromEntries(
  (await db.prepare('SELECT id, slug FROM products').all()).map(p => [p.slug, p.id])
);
const reviews = [
  { user: reviewerIds[0], slug: 'daikin-inverter-1-5hp', rating: 5, comment: 'Cools the room fast and barely makes a sound. Installation crew was on time and cleaned up after themselves.' },
  { user: reviewerIds[1], slug: '5kw-solar-kit', rating: 5, comment: 'Our electric bill dropped by half in the first month. The technicians explained the whole setup clearly.' },
  { user: reviewerIds[2], slug: 'hikvision-4cam-kit', rating: 4, comment: 'Good picture quality day and night. Mobile app took a bit of setup but works great now.' },
  { user: reviewerIds[3], slug: 'google-nest-thermostat', rating: 5, comment: 'Easy to install and the energy savings report is a nice touch. Support was responsive when I had questions.' },
  { user: custId, slug: 'smart-door-lock', rating: 4, comment: 'Fingerprint sensor is fast and reliable. Would like a bit more battery life but overall very happy.' },
  { user: reviewerIds[0], slug: 'samsung-fridge-2door', rating: 5, comment: 'Spacious and quiet. Delivery and installation were scheduled within two days of ordering.' },
];
const insertReview = db.prepare('INSERT INTO reviews (id, user_id, product_id, rating, comment) VALUES (?,?,?,?,?)');
for (const r of reviews) await insertReview.run(uuid(), r.user, productBySlug[r.slug], r.rating, r.comment);

console.log('Seed complete!');
console.log('Admin: admin@homelink.com / admin123');
console.log('Employee: juan.delacruz@homelink.com / password123');
console.log('HR: hr@homelink.com / password123');
console.log('Customer: customer@demo.com / password123');
