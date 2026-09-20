import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Award, CalendarCheck, ChevronRight, Clock, CreditCard, MapPin, ShieldCheck, Tag, Wrench } from 'lucide-react';
import { api, formatPrice } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLoginPrompt } from '../hooks/useLoginPrompt';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import SafeImage from '../components/SafeImage';
import ServiceCard from '../components/ServiceCard';
import { Skeleton } from '../components/Skeleton';
import { getServiceCategoryIcon } from '../constants/serviceCategoryIcons';

const TABS = ['Description', 'Service Details', 'How It Works'];

// Mirrors the four numbered steps of ServiceBook's form, so this page sets the
// right expectation before the customer commits to the booking flow.
const STEPS = [
  { icon: CalendarCheck, title: 'Pick a date & time', body: 'Choose from the open slots for the day that suits you — slots already taken are greyed out as you browse.' },
  { icon: MapPin, title: 'Confirm the address', body: 'Save a service address or pick one you have used before, and leave any notes for the technician.' },
  { icon: CreditCard, title: 'Pay securely', body: 'Card, GCash, QR Ph, or bank transfer. Nothing is charged until you confirm the booking.' },
  { icon: Wrench, title: 'A verified pro arrives', body: 'We assign a technician and keep you posted — follow the job from your Bookings page.' },
];

export default function ServiceDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const promptLogin = useLoginPrompt();
  const [service, setService] = useState(null);
  const [error, setError] = useState(false);
  const [related, setRelated] = useState([]);
  const [tab, setTab] = useState('Description');

  const loadService = useCallback(() => {
    setService(null);
    setError(false);
    setTab('Description');
    api.get(`/services/${slug}`).then(setService).catch(() => setError(true));
  }, [slug]);

  useEffect(() => { loadService(); }, [loadService]);

  useEffect(() => {
    if (!service) return;
    const params = service.category ? `category=${encodeURIComponent(service.category)}` : 'sort=popular';
    api.get(`/services?${params}&limit=5`)
      .then(data => setRelated(data.filter(s => s.id !== service.id).slice(0, 4)))
      .catch(() => setRelated([]));
  }, [service?.id, service?.category]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20">
        <ErrorState message="Couldn't load this service right now." onRetry={loadService} />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <Skeleton className="h-4 w-40 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <Skeleton className="w-full h-96 rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const CategoryIcon = getServiceCategoryIcon(service.category);
  const hours = Number(service.duration_hours).toFixed(1);
  const bookPath = `/services/${service.slug}/book`;

  const handleBook = () => {
    if (user?.role !== 'customer') { promptLogin('Log in to book a service.'); return; }
    navigate(bookPath);
  };

  // Services carry no free-form specifications column the way products do, so the
  // details table is built from the service row plus the fixed terms every booking
  // runs under (slot window from /bookings/availability, methods from PaymentMethodPicker).
  const details = [
    ['Category', service.category],
    ['Typical duration', `~${hours} hours`],
    ['Starting price', formatPrice(service.base_price)],
    ['Booking slots', '8:00 AM – 4:00 PM, daily'],
    ['Technician', 'Verified HomeLink pro'],
    ['Payment', 'Card, GCash, QR Ph, or bank transfer'],
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14">
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-8 flex-wrap" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-navy transition">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <Link to="/services" className="hover:text-brand-navy transition">Services</Link>
        {service.category && (
          <>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <Link to={`/services?category=${encodeURIComponent(service.category)}`} className="hover:text-brand-navy transition">{service.category}</Link>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="text-brand-ink font-medium truncate max-w-[14rem]">{service.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <Reveal className="card relative">
          <SafeImage src={service.image} alt={service.name} className="w-full h-96 lg:h-[28rem] object-cover" />
          <span className="absolute top-4 left-4 badge bg-brand-teal text-white flex items-center gap-1">
            <CategoryIcon className="w-3 h-3" /> {service.category}
          </span>
          <span className="absolute top-4 right-4 badge bg-white/90 backdrop-blur text-brand-navy flex items-center gap-1">
            <Clock className="w-3 h-3" /> ~{hours}h
          </span>
        </Reveal>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Reveal delay={80}>
            <p className="eyebrow text-brand-teal mb-3">{service.category}</p>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-brand-ink mb-3">{service.name}</h1>

            <div className="flex items-baseline gap-2 mb-6">
              <p className="text-3xl font-bold text-brand-navy">{formatPrice(service.base_price)}</p>
              <span className="text-sm text-gray-400">starting price</span>
            </div>

            <p className="text-gray-500 mb-6 leading-relaxed">{service.description}</p>

            <p className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
              <Clock className="w-4 h-4 text-brand-teal" />
              Typically takes about {hours} hours on site
            </p>

            <button onClick={handleBook} className="btn-primary flex items-center gap-2 w-full justify-center mb-3">
              <Wrench className="w-5 h-5" /> Book This Service
            </button>
            <p className="text-center text-xs text-gray-400 mb-6">
              First-time customers get 15% off. Zero obligation until you confirm.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6 text-center">
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-2 py-3">
                <ShieldCheck className="w-5 h-5 text-brand-teal mx-auto mb-1.5" />
                <p className="text-xs text-gray-500 leading-tight">Verified Technicians</p>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-2 py-3">
                <Tag className="w-5 h-5 text-brand-teal mx-auto mb-1.5" />
                <p className="text-xs text-gray-500 leading-tight">Upfront Pricing</p>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-2 py-3">
                <Award className="w-5 h-5 text-brand-teal mx-auto mb-1.5" />
                <p className="text-xs text-gray-500 leading-tight">Satisfaction Guaranteed</p>
              </div>
            </div>

            <Link to="/products" className="block text-center text-sm text-brand-teal hover:underline">
              Need parts or equipment? Shop products →
            </Link>
          </Reveal>
        </div>
      </div>

      <Reveal className="mt-16">
        <div className="flex gap-8 border-b border-gray-200 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-4 text-sm font-semibold transition border-b-2 -mb-px whitespace-nowrap ${tab === t ? 'border-brand-orange text-brand-navy' : 'border-transparent text-gray-400 hover:text-brand-navy'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="py-8 max-w-3xl">
          {tab === 'Description' && (
            <p className="text-gray-600 leading-relaxed">{service.description || 'No description available.'}</p>
          )}

          {tab === 'Service Details' && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <dt className="text-gray-400">{k}</dt>
                  <dd className="font-medium text-brand-ink text-right">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {tab === 'How It Works' && (
            <ol className="space-y-6">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="flex gap-4">
                  <span className="w-9 h-9 rounded-full bg-brand-navy text-white text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div>
                    <p className="flex items-center gap-1.5 font-semibold text-brand-ink mb-1">
                      <Icon className="w-4 h-4 text-brand-teal" /> {title}
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Reveal>

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-brand-ink mb-6">Other Services You Might Need</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((s, i) => (
              <Reveal key={s.id} delay={i * 60} className="h-full">
                <ServiceCard service={s} />
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
