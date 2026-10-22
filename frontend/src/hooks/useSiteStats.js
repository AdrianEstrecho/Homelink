import { useEffect, useState } from 'react';
import { api } from '../api/client';

const plural = (n, one, many) => (n === 1 ? one : many);
const count = (n) => n?.toLocaleString('en-US');

// Live HomeLink numbers for the Home and About stats rows (GET /stats):
// homeowners served, products in the shop, active technicians, average rating.
export function useSiteStats() {
  const [stats, setStats] = useState({ data: null, loading: true, error: false });

  useEffect(() => {
    api.get('/stats')
      .then(data => setStats({ data, loading: false, error: false }))
      .catch(() => setStats({ data: null, loading: false, error: true }));
  }, []);

  return stats;
}

// The four tiles, labels in sentence case. Labels are usable while `s` is
// still loading; values fill in once it arrives. With no reviews yet the
// rating tile carries static `text` instead of a score to count up to.
export function statTiles(s) {
  return [
    { key: 'homeowners', value: count(s?.homeowners), label: plural(s?.homeowners, 'Homeowner served', 'Homeowners served') },
    { key: 'products', value: count(s?.products), label: plural(s?.products, 'Product available', 'Products available') },
    { key: 'technicians', value: count(s?.technicians), label: plural(s?.technicians, 'Verified technician', 'Verified technicians') },
    s && s.rating == null
      ? { key: 'rating', text: 'New', label: 'No ratings yet' }
      : { key: 'rating', value: s && `${s.rating.toFixed(1)}/5`, label: 'Average rating' },
  ];
}
