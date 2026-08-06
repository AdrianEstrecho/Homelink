import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Navigation, Phone, Mail, Clock, Copy, Check, ArrowRight } from 'lucide-react';
import { api } from '../api/client';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import { Skeleton } from '../components/Skeleton';

const CONTACT = { phone: '(02) 8123-4567', phoneHref: 'tel:+6281234567', email: 'support@homelink.com' };

function getOpenStatus() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const hour = now.getHours() + now.getMinutes() / 60;
  const open = day !== 0 && hour >= 8 && hour < 18;
  return open;
}

export default function Location() {
  const [loc, setLoc] = useState(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const isOpen = getOpenStatus();

  const loadLocation = useCallback(() => {
    setLoc(null);
    setError(false);
    api.get('/promos/location').then(setLoc).catch(() => setError(true));
  }, []);

  useEffect(() => { loadLocation(); }, [loadLocation]);

  const handleCopyAddress = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(loc.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20">
        <ErrorState message="Couldn't load location details right now." onRetry={loadLocation} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20">
      <div className="mb-10">
        <p className="eyebrow mb-3">Visit Us</p>
        <h1 className="section-title mb-2">Find Us</h1>
        <p className="text-gray-500 max-w-lg">Visit our showroom, call ahead, or get directions straight from your map app.</p>
      </div>

      {!loc ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <Skeleton className="lg:col-span-3 h-[420px] w-full rounded-2xl" />
          <Skeleton className="lg:col-span-2 h-[420px] w-full rounded-2xl" />
        </div>
      ) : (
        <Reveal className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 card overflow-hidden">
            <iframe
              title="HomeLink Location"
              width="100%"
              height="420"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${loc.lat},${loc.lng}&z=15&output=embed`}
            />
          </div>

          <div className="lg:col-span-2 card p-6 space-y-6">
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="font-display font-bold text-lg text-brand-ink flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand-orange shrink-0" /> HomeLink Office
                </h2>
                <span className={`badge shrink-0 ${isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {isOpen ? 'Open Now' : 'Closed'}
                </span>
              </div>
              <p className="text-gray-500 leading-relaxed mb-1">{loc.address}</p>
              <button onClick={handleCopyAddress} className="flex items-center gap-1.5 text-xs font-semibold text-brand-teal hover:underline mb-5">
                {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy address</>}
              </button>
              <a href={loc.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2 text-sm w-full justify-center">
                <Navigation className="w-4 h-4" /> Get Directions
              </a>
            </div>

            <div className="pt-6 border-t border-gray-100 space-y-3">
              <a href={CONTACT.phoneHref} className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-brand-navy transition group">
                <span className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 group-hover:border-brand-teal/40 transition"><Phone className="w-4 h-4 text-brand-teal" /></span>
                {CONTACT.phone}
              </a>
              <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-brand-navy transition group">
                <span className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 group-hover:border-brand-teal/40 transition"><Mail className="w-4 h-4 text-brand-teal" /></span>
                {CONTACT.email}
              </a>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
                <Clock className="w-3.5 h-3.5" /> Business Hours
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Monday – Saturday</span>
                  <span className="font-medium text-brand-ink">8:00 AM – 6:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sunday</span>
                  <span className="font-medium text-gray-400">Closed</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {loc && (
        <Reveal className="mt-10 rounded-2xl bg-brand-navy px-6 py-8 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="text-center sm:text-left">
            <p className="font-display text-lg font-bold text-white mb-1">Can't make it in person?</p>
            <p className="text-white/60 text-sm">Shop products or book a technician online, anytime.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/products" className="inline-flex items-center border border-white/25 text-white hover:bg-white/10 hover:border-white/40 font-semibold px-6 py-2.5 rounded-lg transition-all text-sm">Browse Products</Link>
            <Link to="/services" className="btn-primary text-sm inline-flex items-center gap-1.5">Book a Service <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </Reveal>
      )}
    </div>
  );
}
