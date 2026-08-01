import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, CreditCard } from 'lucide-react';
import { api, formatPrice } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ServiceBook() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ date: '', time: '', address: user?.address || '', notes: '', paymentMethod: 'card' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/services/${slug}`).then(setService).catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (form.date) api.get(`/bookings/availability?date=${form.date}`).then(setSlots).catch(() => {});
  }, [form.date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/bookings', {
        serviceId: service.id,
        scheduledDate: form.date,
        scheduledTime: form.time,
        address: form.address,
        notes: form.notes,
        paymentMethod: form.paymentMethod,
      });
      navigate('/bookings');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!service) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-brand-navy mb-2">Book Service</h1>
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-lg">{service.name}</h2>
        <p className="text-gray-600 text-sm mt-1">{service.description}</p>
        <p className="text-brand-orange font-bold text-xl mt-3">{formatPrice(service.base_price)}</p>
        <p className="text-xs text-brand-teal mt-1">First-time customers get 15% off!</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5 flex items-center gap-1"><Calendar className="w-4 h-4" /> Preferred Date</label>
          <input type="date" required min={new Date().toISOString().split('T')[0]} value={form.date} onChange={e => setForm({ ...form, date: e.target.value, time: '' })} className="input-field" />
        </div>
        {form.date && (
          <div>
            <label className="block text-sm font-medium mb-1.5 flex items-center gap-1"><Clock className="w-4 h-4" /> Preferred Time</label>
            <div className="grid grid-cols-4 gap-2">
              {slots.map(s => (
                <button key={s.time} type="button" disabled={!s.available} onClick={() => setForm({ ...form, time: s.time })}
                  className={`py-2 rounded-lg text-sm font-medium transition ${form.time === s.time ? 'bg-brand-navy text-white' : s.available ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}>
                  {s.time}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1.5 flex items-center gap-1"><MapPin className="w-4 h-4" /> Service Address</label>
          <textarea required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Notes (optional)</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="input-field" placeholder="Any special instructions..." />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 flex items-center gap-1"><CreditCard className="w-4 h-4" /> Payment Method</label>
          <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className="input-field">
            <option value="card">Credit/Debit Card</option>
            <option value="gcash">GCash</option>
            <option value="bank">Bank Transfer</option>
          </select>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading || !form.time} className="btn-primary w-full py-3 disabled:opacity-50">
          {loading ? 'Processing...' : 'Confirm Booking & Pay'}
        </button>
      </form>
    </div>
  );
}
