import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, XCircle } from 'lucide-react';
import { api, formatPrice, statusColor } from '../api/client';
import { useToast } from '../context/ToastContext';
import CancelReasonModal from '../components/CancelReasonModal';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [cancelTarget, setCancelTarget] = useState(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => { api.get('/bookings/my').then(setBookings).catch(() => {}); }, []);

  const submitCancel = async (reason) => {
    const booking = cancelTarget;
    await api.put(`/bookings/${booking.id}/cancel`, { reason });
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'cancelled', cancel_reason: reason } : b));
    setCancelTarget(null);
    showToast({ icon: XCircle, iconClass: 'bg-red-100 text-red-600', title: 'Booking cancelled', description: booking.service_name });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-brand-navy transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <p className="eyebrow mb-3">Schedule</p>
      <h1 className="section-title mb-8">My Service Bookings</h1>
      {bookings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No bookings yet.</p>
      ) : (
        <div className="space-y-4">
          {bookings.map(b => (
            <div key={b.id} className="card p-6">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-4 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="font-display font-bold text-brand-ink">{b.service_name}</h3>
                  <p className="text-sm text-gray-500">{b.service_category}</p>
                </div>
                <span className={`badge ${statusColor(b.status)}`}>{b.status.replace('_', ' ')}</span>
              </div>
              <div className="text-sm text-gray-600 space-y-1 mb-4">
                <p>Date: {b.scheduled_date} at {b.scheduled_time}</p>
                <p>Address: {b.address}</p>
                {b.employee_first_name && <p>Technician: {b.employee_first_name} {b.employee_last_name}</p>}
              </div>
              {b.status === 'cancelled' && b.cancel_reason && (
                <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Cancellation Reason</p>
                  <p className="text-sm text-red-800">{b.cancel_reason}</p>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-bold text-brand-navy">{formatPrice(b.price)}</span>
                {b.status === 'pending' && (
                  <button onClick={() => setCancelTarget(b)} className="text-sm text-red-600 hover:underline">Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CancelReasonModal
        open={!!cancelTarget}
        title="Cancel this booking?"
        message="This can't be undone once submitted. Let us know why you're cancelling."
        onSubmit={submitCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
