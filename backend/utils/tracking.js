import db from '../db/database.js';
import { geocodeAddress } from './geocode.js';

export const ORDER_STEPS = ['pending', 'processing', 'shipped', 'delivered'];
export const BOOKING_STEPS = ['pending', 'confirmed', 'in_progress', 'completed'];

// Same env vars (and defaults) as GET /api/promos/location — the office is the shipping/
// dispatch origin shown on the tracking map.
export const ORIGIN = {
  lat: Number(process.env.COMPANY_LAT) || 14.5995,
  lng: Number(process.env.COMPANY_LNG) || 120.9842,
};

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// No real courier to pull an ETA from — this scales a rough shipping estimate off distance
// from the office instead of quoting every customer the same flat number.
export function estimateShippingDays(distanceKm) {
  return Math.min(7, Math.max(1, Math.ceil(distanceKm / 150)));
}

async function getCachedDestination(table, row, addressField) {
  if (row.dest_lat != null && row.dest_lng != null) return { lat: row.dest_lat, lng: row.dest_lng };
  const geocoded = await geocodeAddress(row[addressField]);
  if (!geocoded) return null;
  await db.prepare(`UPDATE ${table} SET dest_lat = ?, dest_lng = ? WHERE id = ?`).run(geocoded.lat, geocoded.lng, row.id);
  return geocoded;
}

export const getOrderDestination = (order) => getCachedDestination('orders', order, 'shipping_address');
export const getBookingDestination = (booking) => getCachedDestination('bookings', booking, 'address');

export async function getOrderTimeline(order) {
  const rows = await db.prepare(`
    SELECT details, created_at FROM audit_logs
    WHERE entity_type = 'order' AND entity_id = ? AND action = 'order.status_update'
    ORDER BY created_at ASC
  `).all(order.id);

  const timeline = [{ status: 'pending', at: order.created_at, note: 'Order placed' }];
  for (const row of rows) {
    const details = row.details ? JSON.parse(row.details) : {};
    if (!details.to) continue;
    timeline.push({ status: details.to, at: row.created_at, note: `Order marked ${details.to}` });
  }
  return timeline;
}

export async function getBookingTimeline(booking) {
  const rows = await db.prepare(`
    SELECT action, details, created_at FROM audit_logs
    WHERE entity_type = 'booking' AND entity_id = ?
      AND action IN ('booking.status_update', 'booking.assign', 'booking.completed')
    ORDER BY created_at ASC
  `).all(booking.id);

  const timeline = [{ status: 'pending', at: booking.created_at, note: 'Booking requested' }];
  for (const row of rows) {
    const details = row.details ? JSON.parse(row.details) : {};
    if (row.action === 'booking.status_update' && details.to) {
      timeline.push({ status: details.to, at: row.created_at, note: `Booking marked ${details.to.replace('_', ' ')}` });
    } else if (row.action === 'booking.assign' && details.toEmployeeId) {
      timeline.push({ status: 'confirmed', at: row.created_at, note: 'Technician assigned' });
    } else if (row.action === 'booking.completed') {
      timeline.push({ status: 'completed', at: row.created_at, note: 'Job completed' });
    }
  }
  return timeline;
}
