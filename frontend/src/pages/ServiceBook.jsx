import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, Clock, ChevronRight, ShieldCheck, Award, Timer, Plus, X } from 'lucide-react';
import { api, formatPrice } from '../api/client';
import AddressPicker from '../components/AddressPicker';
import PaymentMethodPicker from '../components/PaymentMethodPicker';
import ErrorState from '../components/ErrorState';
import { Skeleton } from '../components/Skeleton';
import SafeImage from '../components/SafeImage';
import Select from '../components/Select';

function calcDiscount(amount, promo) {
  if (!promo) return 0;
  return promo.type === 'percent' ? Math.round(amount * promo.value / 100 * 100) / 100 : Math.min(promo.value, amount);
}

export default function ServiceBook() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const addressRef = useRef(null);
  const paymentRef = useRef(null);

  const [service, setService] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [discounts, setDiscounts] = useState(null);

  const [extraServices, setExtraServices] = useState([]);
  const [catalog, setCatalog] = useState([]);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState([]);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadService = () => {
    setService(null);
    setLoadError(false);
    setExtraServices([]);
    api.get(`/services/${slug}`).then(setService).catch(() => setLoadError(true));
  };

  useEffect(() => { loadService(); }, [slug]);

  useEffect(() => {
    api.get('/bookings/discount-preview').then(setDiscounts).catch(() => setDiscounts({ firstTime: null, holiday: null }));
  }, []);

  useEffect(() => {
    api.get('/services').then(setCatalog).catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (date) api.get(`/bookings/availability?date=${date}`).then(setSlots).catch(() => setSlots([]));
  }, [date]);

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20">
        <ErrorState message="Couldn't load this service right now." onRetry={loadService} />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <Skeleton className="h-4 w-40 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const allServices = [service, ...extraServices];
  const addableServices = catalog.filter(s => !allServices.some(a => a.id === s.id));

  const addService = (id) => {
    const found = catalog.find(s => s.id === id);
    if (found) setExtraServices(prev => [...prev, found]);
  };
  const removeService = (id) => setExtraServices(prev => prev.filter(s => s.id !== id));

  // Mirrors priceService() on the backend, applied per service in submission order: the
  // first-time discount only ever lands on the first booking actually created (once that
  // insert lands, the user no longer qualifies as first-time for the rest of the loop).
  const lines = allServices.map((s, i) => {
    const firstTimeAmt = i === 0 ? calcDiscount(s.base_price, discounts?.firstTime) : 0;
    const holidayAmt = calcDiscount(s.base_price - firstTimeAmt, discounts?.holiday);
    return { service: s, firstTimeAmt, holidayAmt, total: Math.max(0, s.base_price - firstTimeAmt - holidayAmt) };
  });
  const base = lines.reduce((sum, l) => sum + l.service.base_price, 0);
  const firstTimeAmt = lines[0]?.firstTimeAmt || 0;
  const holidayAmt = lines.reduce((sum, l) => sum + l.holidayAmt, 0);
  const total = lines.reduce((sum, l) => sum + l.total, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !time) { setError('Please pick a date and time.'); return; }
    const selectedAddress = addressRef.current?.validate();
    if (!selectedAddress) { setError('Please select or add a service address.'); return; }
    const payment = paymentRef.current?.validate();
    if (!payment) return;

    setLoading(true);
    setError('');
    try {
      for (const s of allServices) {
        await api.post('/bookings', {
          serviceId: s.id,
          scheduledDate: date,
          scheduledTime: time,
          address: selectedAddress.fullAddress,
          notes,
          paymentMethod: payment.method,
        });
      }
      navigate('/bookings');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14">
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-8 flex-wrap" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-navy transition">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <Link to="/services" className="hover:text-brand-navy transition">Services</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="text-brand-ink font-medium truncate max-w-[14rem]">{service.name}</span>
      </nav>

      <p className="eyebrow mb-3">Schedule</p>
      <h1 className="section-title mb-8">Book {service.name}</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="flex items-center gap-2.5 text-sm font-semibold text-brand-ink mb-5">
              <span className="w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
              Services
            </h2>
            <div className="space-y-3">
              {allServices.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <SafeImage src={s.image} alt={s.name} className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-100" iconClassName="w-5 h-5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-brand-ink truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.category} · ~{Number(s.duration_hours).toFixed(1)}h</p>
                  </div>
                  <span className="text-sm font-semibold text-brand-navy shrink-0">{formatPrice(s.base_price)}</span>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => removeService(s.id)}
                      aria-label={`Remove ${s.name}`}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {addableServices.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="flex items-center gap-1.5 text-sm font-medium text-brand-ink mb-1.5">
                  <Plus className="w-4 h-4 text-gray-400" /> Add Another Service
                </label>
                <Select
                  value=""
                  onChange={addService}
                  placeholder="Choose a service to add..."
                  options={addableServices.map(s => ({ value: s.id, label: `${s.name} — ${formatPrice(s.base_price)}` }))}
                />
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-2.5 text-sm font-semibold text-brand-ink mb-5">
              <span className="w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
              Date &amp; Time
            </h2>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-brand-ink mb-1.5"><Calendar className="w-4 h-4 text-gray-400" /> Preferred Date</label>
              <input type="date" required min={new Date().toISOString().split('T')[0]} value={date} onChange={e => { setDate(e.target.value); setTime(''); }} className="input-field max-w-xs" />
            </div>
            {date && (
              <div className="mt-4">
                <label className="flex items-center gap-1.5 text-sm font-medium text-brand-ink mb-1.5"><Clock className="w-4 h-4 text-gray-400" /> Preferred Time</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map(s => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setTime(s.time)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition border ${
                        time === s.time
                          ? 'border-brand-orange bg-brand-orange/5 text-brand-navy font-semibold'
                          : s.available
                          ? 'border-gray-200 hover:border-gray-300'
                          : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="card p-6">
            <AddressPicker ref={addressRef} stepNumber={3} title="Service Address" />
          </section>

          <section className="card p-6">
            <PaymentMethodPicker ref={paymentRef} stepNumber={4} />
          </section>

          <section className="card p-6">
            <h2 className="text-sm font-semibold text-brand-ink mb-3">Notes (optional)</h2>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-field" placeholder="Any special instructions for the technician..." />
          </section>

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="lg:sticky lg:top-24">
          <div className="card p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 mb-4">Booking Summary</h2>

            <div className="space-y-3 pb-4 border-b border-gray-100">
              {allServices.map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  <SafeImage src={s.image} alt={s.name} className="w-14 h-14 rounded-lg object-cover shrink-0 bg-gray-100" iconClassName="w-5 h-5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-brand-ink truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.category} · ~{Number(s.duration_hours).toFixed(1)}h</p>
                  </div>
                  <span className="text-xs font-medium text-gray-500 shrink-0">{formatPrice(s.base_price)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm mt-4">
              <div className="flex justify-between text-gray-500"><span>Base Price</span><span>{formatPrice(base)}</span></div>
              {firstTimeAmt > 0 && (
                <div className="flex justify-between text-green-600"><span>{discounts.firstTime.label}</span><span>-{formatPrice(firstTimeAmt)}</span></div>
              )}
              {holidayAmt > 0 && (
                <div className="flex justify-between text-green-600"><span>{discounts.holiday.label}</span><span>-{formatPrice(holidayAmt)}</span></div>
              )}
              {!firstTimeAmt && !holidayAmt && (
                <p className="text-xs text-brand-teal font-medium">First-time customers get 15% off</p>
              )}
            </div>

            <div className="flex justify-between items-center font-bold text-lg mt-3 pt-3 border-t border-gray-200">
              <span className="text-brand-ink">Total</span>
              <span className="text-brand-navy">{formatPrice(total)}</span>
            </div>

            <button type="submit" disabled={loading || !date || !time} className="btn-primary w-full py-3 mt-5 disabled:opacity-50">
              {loading ? 'Confirming...' : `Confirm Booking — ${formatPrice(total)}`}
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">Zero obligation until confirmed. We never share your info.</p>

            <div className="grid grid-cols-3 gap-2 mt-5 pt-5 border-t border-gray-100 text-center">
              <div>
                <ShieldCheck className="w-4 h-4 text-brand-teal mx-auto mb-1" />
                <p className="text-[11px] text-gray-400 leading-tight">Verified Technicians</p>
              </div>
              <div>
                <Award className="w-4 h-4 text-brand-teal mx-auto mb-1" />
                <p className="text-[11px] text-gray-400 leading-tight">Satisfaction Guarantee</p>
              </div>
              <div>
                <Timer className="w-4 h-4 text-brand-teal mx-auto mb-1" />
                <p className="text-[11px] text-gray-400 leading-tight">On-Time Arrival</p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
