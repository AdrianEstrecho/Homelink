import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icon references image paths that don't survive Vite's bundling
// unless pointed at the package's own asset URLs explicitly.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

const technicianIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#f97316;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const movingIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#0d9488;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// origin/destination: {lat,lng} — HomeLink office and the shipping/service address.
// movingPoint: {lat,lng} — interpolated in-transit position for product orders.
// technicianLocation: {lat,lng} — the installer's last-reported live position.
export default function TrackingMap({ origin, destination, movingPoint, technicianLocation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (layerRef.current) layerRef.current.remove();
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    const points = [];
    if (origin) {
      L.marker([origin.lat, origin.lng]).addTo(layer).bindPopup('HomeLink Office');
      points.push([origin.lat, origin.lng]);
    }
    if (destination) {
      L.marker([destination.lat, destination.lng]).addTo(layer).bindPopup('Delivery Address');
      points.push([destination.lat, destination.lng]);
    }
    if (origin && destination) {
      L.polyline([[origin.lat, origin.lng], [destination.lat, destination.lng]], { color: '#94a3b8', dashArray: '6 6', weight: 2 }).addTo(layer);
    }
    if (movingPoint) {
      L.marker([movingPoint.lat, movingPoint.lng], { icon: movingIcon }).addTo(layer).bindPopup('Your order');
      points.push([movingPoint.lat, movingPoint.lng]);
    }
    if (technicianLocation) {
      L.marker([technicianLocation.lat, technicianLocation.lng], { icon: technicianIcon }).addTo(layer).bindPopup('Technician');
      points.push([technicianLocation.lat, technicianLocation.lng]);
    }

    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1) map.fitBounds(points, { padding: [30, 30] });
    else map.setView([14.5995, 120.9842], 11);

    setTimeout(() => map.invalidateSize(), 0);
  }, [origin, destination, movingPoint, technicianLocation]);

  return <div ref={containerRef} className="w-full h-64 rounded-xl overflow-hidden border border-gray-100" />;
}
