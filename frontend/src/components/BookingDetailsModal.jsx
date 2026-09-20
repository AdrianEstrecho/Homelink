import { createPortal } from 'react-dom';
import { X, MapPin, CreditCard, User, StickyNote, Truck, CheckCircle2 } from 'lucide-react';
import { formatPrice, statusColor } from '../api/client';
import SafeImage from './SafeImage';
import { paymentMethodLabel } from '../constants/paymentMethods';

// Portaled to <body> — same reasoning as OrderDetailsModal/ConfirmDialog/PromptDialog: rendered
// inline, this ended up boxed inside its position in the page instead of sitting above everything.
export default function BookingDetailsModal({
  booking, onClose, onDismiss, onCancelBooking, onTrackBooking, justConfirmed = false, person, personLabel = 'Customer',
}) {
  const subtotal = Number(booking.price) + Number(booking.discount || 0);
  // Same split as OrderDetailsModal: on the just-confirmed receipt, X/backdrop ("I'm done
  // here") and "Continue to My Bookings" ("take me to my bookings") are different exits.
  const handleDismiss = justConfirmed && onDismiss ? onDismiss : onClose;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={handleDismiss} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto fade-up">
        <div className="flex items-start justify-between p-6 pb-4 sticky top-0 bg-white border-b border-gray-100">
          <div>
            <h2 className="font-display text-lg font-bold text-brand-navy">{booking.service_name}</h2>
            <p className="text-sm text-gray-500">{new Date(booking.created_at).toLocaleString()}</p>
          </div>
          <button onClick={handleDismiss} title="Close" className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 pt-4 space-y-5">
          {justConfirmed && (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800 text-sm">Booking confirmed!</p>
                <p className="text-sm text-green-700 mt-0.5">
                  {person?.email
                    ? `We've emailed a copy of this receipt to ${person.email}.`
                    : "We've emailed a copy of this receipt to your account email."}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <span className={`badge capitalize ${statusColor(booking.status)}`}>{booking.status.replace('_', ' ')}</span>
              {booking.payment_status && (
                <span className={`badge ${statusColor(booking.payment_status)}`}>{booking.payment_status}</span>
              )}
            </div>
            {onTrackBooking && booking.status !== 'cancelled' && (
              <button onClick={() => onTrackBooking(booking)} className="flex items-center gap-1.5 text-xs font-semibold text-brand-teal hover:underline shrink-0">
                <Truck className="w-3.5 h-3.5" /> Track Booking
              </button>
            )}
          </div>

          {booking.status === 'cancelled' && booking.cancel_reason && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Cancellation Reason</p>
              <p className="text-sm text-red-800">{booking.cancel_reason}</p>
            </div>
          )}

          {booking.service_image && (
            <SafeImage src={booking.service_image} alt={booking.service_name} className="w-full h-40 object-cover rounded-xl" />
          )}

          {person && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{personLabel}</h3>
              <p className="text-sm font-medium text-gray-800">{person.name}</p>
              {person.email && <p className="text-sm text-gray-500">{person.email}</p>}
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Service</h3>
            <p className="text-sm font-medium text-gray-800">{booking.service_name}</p>
            <p className="text-sm text-gray-500">{booking.service_category}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Schedule</h3>
            <p className="text-sm text-gray-700">{booking.scheduled_date} at {booking.scheduled_time}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Address
            </h3>
            <p className="text-sm text-gray-700">{booking.address}</p>
          </div>

          {booking.employee_first_name && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Technician
              </h3>
              <p className="text-sm text-gray-700">{booking.employee_first_name} {booking.employee_last_name}</p>
            </div>
          )}

          {booking.notes && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5" /> Notes
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
            </div>
          )}

          {booking.status === 'completed' && booking.completion_notes && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Completion Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{booking.completion_notes}</p>
            </div>
          )}

          {booking.payment_method && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Payment Method
              </h3>
              <p className="text-sm text-gray-700">{paymentMethodLabel(booking.payment_method)}</p>
            </div>
          )}

          <div className="pt-3 border-t border-gray-100 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {booking.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatPrice(booking.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100">
              <span>Total</span>
              <span className="text-brand-navy">{formatPrice(booking.price)}</span>
            </div>
          </div>

          {justConfirmed && (
            <button onClick={onClose} className="btn-primary w-full py-3">
              Continue to My Bookings
            </button>
          )}

          {onCancelBooking && booking.status === 'pending' && (
            <button
              onClick={() => onCancelBooking(booking)}
              className="w-full border border-red-200 text-red-600 rounded-lg py-2.5 font-semibold text-sm hover:bg-red-50 transition"
            >
              Cancel Booking
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
