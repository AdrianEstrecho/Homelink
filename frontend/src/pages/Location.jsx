import { useEffect, useState } from 'react';
import { MapPin, Navigation, Phone, Mail, Clock } from 'lucide-react';
import { api } from '../api/client';

export default function Location() {
  const [loc, setLoc] = useState(null);

  useEffect(() => { api.get('/promos/location').then(setLoc).catch(() => {}); }, []);

  if (!loc) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-brand-navy mb-2">Find Us</h1>
      <p className="text-gray-600 mb-8">Visit our showroom or get directions to our office</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card overflow-hidden">
          <iframe
            title="HomeLink Location"
            width="100%"
            height="350"
            style={{ border: 0 }}
            loading="lazy"
            src={`https://maps.google.com/maps?q=${loc.lat},${loc.lng}&z=15&output=embed`}
          />
        </div>
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-brand-orange" /> HomeLink Office</h2>
            <p className="text-gray-600 mb-4">{loc.address}</p>
            <a href={loc.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2 text-sm">
              <Navigation className="w-4 h-4" /> Get Directions
            </a>
          </div>
          <div className="card p-6 space-y-3 text-sm">
            <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-brand-teal" /> (02) 8123-4567</p>
            <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-brand-teal" /> support@homelink.com</p>
            <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-brand-teal" /> Mon-Sat: 8:00 AM - 6:00 PM</p>
          </div>
        </div>
      </div>
    </div>
  );
}
