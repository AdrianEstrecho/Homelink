// Free geocoding via OpenStreetMap's Nominatim — no API key or billing needed. Their usage
// policy wants a descriptive User-Agent and caps at ~1 request/sec, which this app never gets
// close to since callers cache the result on the order/booking row instead of re-geocoding.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'HomeLink-academic-project/1.0' } });
    if (!res.ok) return null;
    const results = await res.json();
    if (!results.length) return null;
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}
