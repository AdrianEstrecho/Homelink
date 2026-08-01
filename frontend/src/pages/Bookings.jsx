import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, formatPrice, statusColor } from '../api/client';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { api.get('/bookings/my').then(setBookings).catch(() => {}); }, []);

  const cancel = async (id) => {
    if (!confirm('Cancel this booking?')) return;
    await api.put(`/bookings/${id}/cancel`);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="font-display text-3xl font-bold text-brand-navy mb-8">My Service Bookings</h1>
      {bookings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No bookings yet.</p>
      ) : (
        <div className="space-y-4">
          {bookings.map(b => (
            <div key={b.id} className="card p-6">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                <div>
                  <h3 className="font-semibold">{b.service_name}</h3>
                  <p className="text-sm text-gray-500">{b.service_category}</p>
                </div>
                <span className={`badge ${statusColor(b.status)}`}>{b.status.replace('_', ' ')}</span>
              </div>
              <div className="text-sm text-gray-600 space-y-1 mb-3">
                <p>Date: {b.scheduled_date} at {b.scheduled_time}</p>
                <p>Address: {b.address}</p>
                {b.employee_first_name && <p>Technician: {b.employee_first_name} {b.employee_last_name}</p>}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-brand-orange">{formatPrice(b.price)}</span>
                {['pending', 'confirmed'].includes(b.status) && (
                  <button onClick={() => cancel(b.id)} className="text-sm text-red-600 hover:underline">Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
