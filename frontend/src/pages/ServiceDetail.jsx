import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Award, CalendarCheck, Check, ChevronRight, ClipboardList, Clock, CreditCard, MapPin, ShieldCheck, Tag, Wrench } from 'lucide-react';
import { api, formatPrice } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLoginPrompt } from '../hooks/useLoginPrompt';
import { specEntries, toHighlights } from '../utils/catalogSpecs';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import SafeImage from '../components/SafeImage';
import ServiceCard from '../components/ServiceCard';
import { Skeleton } from '../components/Skeleton';
import { getServiceCategoryIcon } from '../constants/serviceCategoryIcons';

const TABS = ['Overview', 'Service Details', 'How It Works'];

// How many detail rows get pulled up next to the booking button as an at-a-glance summary.
// The rest stay in the Service Details tab.
const QUICK_DETAIL_COUNT = 4;

const DEFAULT_GUARANTEE = 'Every job is backed by our service guarantee — if something is not right, tell us and we will put it right.';

// Mirrors the four numbered steps of ServiceBook's form, so this page sets the
// right expectation before the customer commits to the booking flow.
const STEPS = [
  { icon: CalendarCheck, title: 'Pick a date & time', body: 'Choose from the open slots for the day that suits you — slots already taken are greyed out as you browse.' },
  { icon: MapPin, title: 'Confirm the address', body: 'Save a service address or pick one you have used before, and leave any notes for the technician.' },
  { icon: CreditCard, title: 'Pay securely', body: 'Card, GCash, QR Ph, or bank transfer. Nothing is charged until you confirm the booking.' },
  { icon: Wrench, title: 'A verified pro arrives', body: 'We assign a technician and keep you posted — follow the job from your Bookings page.' },
];

// Free-text descriptions are written as prose; honour any blank-line paragraph breaks the
// staff typed instead of collapsing the whole thing into one block.
function paragraphs(text) {
  return String(text || '').split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean);
}

export default function ServiceDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const promptLogin = useLoginPrompt();
  const [service, setService] = useState(null);
  const [error, setError] = useState(false);
  const [related, setRelated] = useState([]);
  const [tab, setTab] = useState('Overview');

  const loadService = useCallback(() => {
    setService(null);
    setError(false);
    setTab('Overview');
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

  const specs = useMemo(() => specEntries(service?.specifications), [service?.specifications]);
  const inclusions = useMemo(() => toHighlights(service?.highlights), [service?.highlights]);
  const requirements = useMemo(() => toHighlights(service?.requirements), [service?.requirements]);

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

  // The details table mixes what staff recorded for this service with the fixed terms every
  // booking runs under (slot window from /bookings/availability, methods from
  // PaymentMethodPicker), so the tab reads as one table rather than two half-empty ones.
  const bookingTerms = [
    { key: 'term-category', label: 'Category', value: service.category },
    { key: 'term-duration', label: 'Typical duration', value: `~${hours} hours` },
    { key: 'term-price', label: 'Starting price', value: formatPrice(service.base_price) },
    { key: 'term-slots', label: 'Booking slots', value: '8:00 AM – 4:00 PM, daily' },
    { key: 'term-tech', label: 'Technician', value: 'Verified HomeLink pro' },
    { key: 'term-payment', label: 'Payment', value: 'Card, GCash, QR Ph, or bank transfer' },
  ];
  const quickDetails = specs.slice(0, QUICK_DETAIL_COUNT);
  const descriptionParagraphs = paragraphs(service.description);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-12 items-start">
        <div className="space-y-4">
          <Reveal className="card relative">
            <SafeImage src={service.image} alt={service.name} className="w-full h-96 lg:h-[28rem] object-cover" />
            <span className="absolute top-4 left-4 badge bg-brand-teal text-white flex items-center gap-1">
              <CategoryIcon className="w-3 h-3" /> {service.category}
            </span>
            <span className="absolute top-4 right-4 badge bg-white/90 backdrop-blur text-brand-navy flex items-center gap-1">
              <Clock className="w-3 h-3" /> ~{hours}h
            </span>
          </Reveal>

          {quickDetails.length > 0 && (
            <Reveal delay={60} className="card p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">At a glance</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                {quickDetails.map(d => (
                  <div key={d.key}>
                    <dt className="text-xs text-gray-400">{d.label}</dt>
                    <dd className="text-sm font-semibold text-brand-ink">{d.value}</dd>
                  </div>
                ))}
              </dl>
              {specs.length > QUICK_DETAIL_COUNT && (
                <button onClick={() => setTab('Service Details')} className="mt-4 text-sm font-medium text-brand-teal hover:underline">
                  See all {specs.length} service details →
                </button>
              )}
            </Reveal>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Reveal delay={80}>
            <p className="eyebrow text-brand-teal mb-3">{service.category}</p>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-brand-ink mb-3">{service.name}</h1>

            <div className="flex items-baseline gap-2 mb-5">
              <p className="text-3xl font-bold text-brand-navy">{formatPrice(service.base_price)}</p>
              <span className="text-sm text-gray-400">starting price</span>
            </div>

            {descriptionParagraphs[0] && (
              <p className="text-gray-500 mb-5 leading-relaxed">{descriptionParagraphs[0]}</p>
            )}

            {inclusions.length > 0 && (
              <ul className="space-y-2 mb-5">
                {inclusions.slice(0, 4).map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-start gap-2.5 rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3 mb-6">
              <Clock className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-brand-ink">Typically about {hours} hours on site</p>
                <p className="text-xs text-gray-400">Slots run 8:00 AM to 4:00 PM, seven days a week.</p>
              </div>
            </div>

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
              {t}{t === 'Service Details' && specs.length > 0 ? ` (${specs.length})` : ''}
            </button>
          ))}
        </div>

        <div className="py-8">
          {tab === 'Overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-4">
                <h2 className="font-display text-xl font-bold text-brand-ink">About this service</h2>
                {descriptionParagraphs.length > 0 ? (
                  descriptionParagraphs.map((p, i) => <p key={i} className="text-gray-600 leading-relaxed">{p}</p>)
                ) : (
                  <p className="text-gray-400 text-sm">No description available.</p>
                )}

                {requirements.length > 0 && (
                  <div className="mt-8 rounded-xl border border-gray-100 bg-gray-50 p-5">
                    <h3 className="flex items-center gap-2 font-semibold text-sm text-brand-ink mb-3">
                      <ClipboardList className="w-4 h-4 text-brand-teal" /> Before your visit
                    </h3>
                    <ul className="space-y-2">
                      {requirements.map(item => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-teal shrink-0 mt-1.5" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">What&apos;s included</h3>
                {inclusions.length > 0 ? (
                  <ul className="space-y-2.5">
                    {inclusions.map(item => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">Scope is confirmed with you by the technician before work begins.</p>
                )}
              </div>
            </div>
          )}

          {tab === 'Service Details' && (
            <div className="max-w-3xl">
              <p className="text-sm text-gray-400 mb-4">What this booking covers, and the terms every HomeLink visit runs under.</p>
              <dl className="rounded-xl border border-gray-100 overflow-hidden">
                {[...specs, ...bookingTerms].map((row, i) => (
                  <div key={row.key} className={`grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_1fr] gap-1 sm:gap-6 px-4 py-3 text-sm ${i % 2 ? 'bg-white' : 'bg-gray-50/70'}`}>
                    <dt className="text-gray-400">{row.label}</dt>
                    <dd className="font-medium text-brand-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {tab === 'How It Works' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <ol className="lg:col-span-2 space-y-6">
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

              <div className="space-y-6">
                <div className="rounded-xl border border-gray-100 p-5">
                  <div className="w-9 h-9 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center mb-3">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm text-brand-ink mb-1.5">Service guarantee</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{service.warranty || DEFAULT_GUARANTEE}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-5">
                  <div className="w-9 h-9 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center mb-3">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm text-brand-ink mb-1.5">Rescheduling</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Bookings can be cancelled or rescheduled up to 24 hours before the appointment, from your Bookings page.
                  </p>
                </div>
              </div>
            </div>
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
