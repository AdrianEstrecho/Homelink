import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from './database.js';

console.log('Seeding HomeLink database...');

// reviews.order_id has no cascade, so it must go before orders; same for subcategories,
// which self-reference their parent via parent_id and must go before the parent row.
db.exec('DELETE FROM reviews; DELETE FROM order_items; DELETE FROM orders; DELETE FROM bookings; DELETE FROM vouchers; DELETE FROM products; DELETE FROM services; DELETE FROM categories WHERE parent_id IS NOT NULL; DELETE FROM categories; DELETE FROM announcements; DELETE FROM gallery; DELETE FROM audit_logs; DELETE FROM users;');

const adminId = uuid();
const emp1 = uuid();
const emp2 = uuid();
const accountingEmp = uuid();
const hrEmp = uuid();
const custId = uuid();
const hash = await bcrypt.hash('password123', 10);
const adminHash = await bcrypt.hash('admin123', 10);

db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, staff_code, verified) VALUES (?,?,?,?,?,?,?,?,?,1)')
  .run(adminId, 'admin@homelink.com', adminHash, 'System', 'Admin', '09171234567', '123 HomeLink Ave', 'admin', 'SA001');
db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, staff_code, verified) VALUES (?,?,?,?,?,?,?,?,?,1)')
  .run(emp1, 'juan.delacruz@homelink.com', hash, 'Juan', 'Delacruz', '09181111111', 'Manila', 'employee', 'EMP001');
db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, staff_code, verified) VALUES (?,?,?,?,?,?,?,?,?,1)')
  .run(emp2, 'maria.santos@homelink.com', hash, 'Maria', 'Santos', '09182222222', 'Quezon City', 'employee', 'EMP002');
db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, position, staff_code, salary, verified) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)')
  .run(accountingEmp, 'accounting@homelink.com', hash, 'Ramon', 'Cruz', '09184444444', 'Pasig City', 'employee', 'accounting', 'AC001', 35000);
db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, position, staff_code, salary, verified) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)')
  .run(hrEmp, 'hr@homelink.com', hash, 'Liza', 'Fernandez', '09185555555', 'Mandaluyong City', 'employee', 'hr', 'HR001', 32000);
db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, verified) VALUES (?,?,?,?,?,?,?,?,1)')
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
categories.forEach(c => insertCat.run(c.id, c.name, c.slug, c.description, c.image));

const catMap = Object.fromEntries(categories.map(c => [c.slug, c.id]));

const subcategories = [
  { id: uuid(), name: 'Split Type', slug: 'ac-split-type', parentSlug: 'air-conditioners' },
  { id: uuid(), name: 'Window Type', slug: 'ac-window-type', parentSlug: 'air-conditioners' },
  { id: uuid(), name: 'Refrigerators', slug: 'appliances-refrigerators', parentSlug: 'home-appliances' },
  { id: uuid(), name: 'Washing Machines', slug: 'appliances-washing-machines', parentSlug: 'home-appliances' },
  { id: uuid(), name: 'IP Cameras', slug: 'cctv-ip-cameras', parentSlug: 'cctv-security' },
];
const insertSubcat = db.prepare('INSERT INTO categories (id, name, slug, description, image, parent_id) VALUES (?,?,?,?,?,?)');
subcategories.forEach(s => insertSubcat.run(s.id, s.name, s.slug, null, null, catMap[s.parentSlug]));
const subcatMap = Object.fromEntries(subcategories.map(s => [s.slug, s.id]));

const products = [
  { name: 'Daikin Inverter Split AC 1.5HP', slug: 'daikin-inverter-1-5hp', cat: 'ac-split-type', price: 32999, stock: 25, featured: 1, image: 'https://images.unsplash.com/photo-1718203862467-c33159fdc504?w=600', specs: { brand: 'Daikin', capacity: '1.5 HP', type: 'Split Inverter', energyRating: '5 Star' } },
  { name: 'Carrier Window Type AC 2.0HP', slug: 'carrier-window-2hp', cat: 'ac-window-type', price: 24999, stock: 18, featured: 1, image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600', specs: { brand: 'Carrier', capacity: '2.0 HP', type: 'Window' } },
  { name: '5kW Solar Panel System Kit', slug: '5kw-solar-kit', cat: 'solar-panels', price: 185000, stock: 8, featured: 1, image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600', specs: { capacity: '5kW', panels: '12 x 420W', inverter: 'Included' } },
  { name: '3kW Solar Panel Starter Kit', slug: '3kw-solar-starter', cat: 'solar-panels', price: 98000, stock: 12, featured: 0, image: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=600', specs: { capacity: '3kW', panels: '8 x 375W' } },
  { name: 'Hikvision 4-Camera CCTV Kit', slug: 'hikvision-4cam-kit', cat: 'cctv-ip-cameras', price: 15999, stock: 30, featured: 1, image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600', specs: { cameras: 4, resolution: '1080p', storage: '1TB NVR' } },
  { name: 'Dahua 8-Camera IP System', slug: 'dahua-8cam-ip', cat: 'cctv-security', price: 38500, stock: 10, featured: 0, image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600', specs: { cameras: 8, resolution: '4MP', type: 'IP PoE' } },
  { name: 'Schneider Circuit Breaker Panel', slug: 'schneider-breaker-panel', cat: 'electrical', price: 4500, stock: 40, featured: 0, image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600', specs: { brand: 'Schneider', slots: 12, amperage: '100A' } },
  { name: 'Copper Wire 2.0mm (100m roll)', slug: 'copper-wire-2mm', cat: 'electrical', price: 3200, stock: 50, featured: 0, image: 'https://images.unsplash.com/photo-1610028290816-5d937a395a49?w=600', specs: { gauge: '2.0mm', length: '100m', material: 'Copper' } },
  { name: 'Kohler Kitchen Faucet Set', slug: 'kohler-faucet-set', cat: 'plumbing', price: 8500, stock: 22, featured: 0, image: 'https://images.unsplash.com/photo-1521207418485-99c705420785?w=600', specs: { brand: 'Kohler', finish: 'Chrome', type: 'Pull-down' } },
  { name: 'PVC Pipe Set (Assorted)', slug: 'pvc-pipe-set', cat: 'plumbing', price: 1800, stock: 60, featured: 0, image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600', specs: { sizes: '1/2" to 2"', pieces: 20 } },
  { name: 'Google Nest Thermostat', slug: 'google-nest-thermostat', cat: 'smart-home', price: 12500, stock: 15, featured: 1, image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600', specs: { brand: 'Google', connectivity: 'WiFi', display: 'Color LCD' } },
  { name: 'Smart Door Lock with Fingerprint', slug: 'smart-door-lock', cat: 'smart-home', price: 9800, stock: 20, featured: 0, image: 'https://images.unsplash.com/photo-1662106088835-2ac8adea34dd?w=600', specs: { unlock: 'Fingerprint, PIN, App', battery: '8 months' } },
  { name: 'Samsung Refrigerator 2-Door', slug: 'samsung-fridge-2door', cat: 'appliances-refrigerators', price: 28999, stock: 10, featured: 1, image: 'https://images.unsplash.com/photo-1722649939430-9f615b049e7c?w=600', specs: { brand: 'Samsung', capacity: '380L', type: 'No Frost' } },
  { name: 'LG Front Load Washing Machine', slug: 'lg-front-load-washer', cat: 'appliances-washing-machines', price: 32999, stock: 8, featured: 0, image: 'https://images.unsplash.com/photo-1752805869096-9b149e6effa1?w=600', specs: { brand: 'LG', capacity: '8kg', type: 'Inverter Direct Drive' } },
  { name: 'Philips LED Downlight (6-pack)', slug: 'philips-led-downlight-6', cat: 'lighting', price: 2400, stock: 45, featured: 0, image: 'https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=600', specs: { brand: 'Philips', wattage: '9W', color: 'Warm White' } },
  { name: 'Bosch Power Drill Kit', slug: 'bosch-drill-kit', cat: 'tools', price: 6500, stock: 25, featured: 0, image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600', specs: { brand: 'Bosch', voltage: '18V', includes: '2 Batteries, Charger' } },
];

const allCatMap = { ...catMap, ...subcatMap };
const insertProd = db.prepare('INSERT INTO products (id, category_id, name, slug, description, specifications, price, stock, image, featured, brand, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
products.forEach(p => {
  insertProd.run(uuid(), allCatMap[p.cat], p.name, p.slug, `Premium ${p.name} for your home improvement needs. Professional installation available.`, JSON.stringify(p.specs), p.price, p.stock, p.image, p.featured, p.specs.brand || null, 'active');
});

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
services.forEach(s => insertSvc.run(uuid(), s.name, s.slug, s.desc, s.category, s.price, 2 + Math.random() * 3, 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600'));

db.prepare('INSERT INTO vouchers (id, code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until) VALUES (?,?,?,?,?,?,?,?)')
  .run(uuid(), 'HOMELINK10', 'percent', 10, 5000, 100, '2025-01-01', '2027-12-31');
db.prepare('INSERT INTO vouchers (id, code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until) VALUES (?,?,?,?,?,?,?,?)')
  .run(uuid(), 'SAVE500', 'fixed', 500, 3000, 50, '2025-01-01', '2027-12-31');
db.prepare('INSERT INTO vouchers (id, code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until) VALUES (?,?,?,?,?,?,?,?)')
  .run(uuid(), 'NEWHOME20', 'percent', 20, 10000, 30, '2025-01-01', '2027-12-31');

db.prepare('INSERT INTO announcements (id, title, content, type) VALUES (?,?,?,?)')
  .run(uuid(), 'Summer AC Sale!', 'Get up to 20% off on all air conditioners this summer. Free installation on select models.', 'promo');
db.prepare('INSERT INTO announcements (id, title, content, type) VALUES (?,?,?,?)')
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
galleryItems.forEach((g, i) => insertGal.run(uuid(), g.title, g.image, g.category, i));

const reviewers = [
  { name: ['Anna', 'Reyes'], email: 'anna.reyes@example.com', phone: '09171112222', address: 'Pasig City' },
  { name: ['Mark', 'Villanueva'], email: 'mark.villanueva@example.com', phone: '09172223333', address: 'Taguig City' },
  { name: ['Grace', 'Tan'], email: 'grace.tan@example.com', phone: '09173334444', address: 'Quezon City' },
  { name: ['Carlo', 'Mendoza'], email: 'carlo.mendoza@example.com', phone: '09174445555', address: 'Manila' },
];
const reviewerIds = reviewers.map(r => {
  const id = uuid();
  db.prepare('INSERT INTO users (id, email, password, first_name, last_name, phone, address, role, verified) VALUES (?,?,?,?,?,?,?,?,1)')
    .run(id, r.email, hash, r.name[0], r.name[1], r.phone, r.address, 'customer');
  return id;
});

const productBySlug = Object.fromEntries(
  db.prepare('SELECT id, slug FROM products').all().map(p => [p.slug, p.id])
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
reviews.forEach(r => insertReview.run(uuid(), r.user, productBySlug[r.slug], r.rating, r.comment));

console.log('Seed complete!');
console.log('Admin: admin@homelink.com / admin123');
console.log('Employee: juan.delacruz@homelink.com / password123');
console.log('Accounting: accounting@homelink.com / password123');
console.log('HR: hr@homelink.com / password123');
console.log('Customer: customer@demo.com / password123');
