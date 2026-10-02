import { MapPin, CreditCard, User, StickyNote, Truck, CheckCircle2, CalendarDays, Wrench } from 'lucide-react';
import { formatPrice, statusColor } from '../api/client';
import Modal, { ModalBody, ModalFooter, ModalHeader, modalButton } from './Modal';
import SafeImage from './SafeImage';
import { paymentMethodLabel } from '../constants/paymentMethods';

// One labelled fact in the details grid.
function Detail({ icon: Icon, label, children, wide = false }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
        {Icon && <Icon className="w-3.5 h-3.5" />} {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-800">{children}</dd>
    </div>
  );
}

export default function BookingDetailsModal({
  booking, onClose, onDismiss, onCancelBooking, onTrackBooking, justConfirmed = false, person, personLabel = 'Customer',
}) {
  const subtotal = Number(booking.price) + Number(booking.discount || 0);
  // Same split as OrderDetailsModal: on the just-confirmed receipt, X/backdrop ("I'm done
  // here") and "Continue to My Bookings" ("take me to my bookings") are different exits.
  const handleDismiss = justConfirmed && onDismiss ? onDismiss : onClose;

  const showCancel = onCancelBooking && booking.status === 'pending';

  return (
    <Modal onClose={handleDismiss}>
      <ModalHeader
        icon={Wrench}
        title={booking.service_name}
        subtitle={`Booked ${new Date(booking.created_at).toLocaleString()}`}
      />
      <ModalBody className="space-y-5">
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

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {person && (
              <Detail icon={User} label={personLabel}>
                <span className="font-medium">{person.name}</span>
                {person.email && <span className="block text-gray-500 break-all">{person.email}</span>}
              </Detail>
            )}
            <Detail icon={Wrench} label="Service">
              <span className="font-medium">{booking.service_name}</span>
              {booking.service_category && <span className="block text-gray-500">{booking.service_category}</span>}
            </Detail>
            <Detail icon={CalendarDays} label="Schedule">{booking.scheduled_date} at {booking.scheduled_time}</Detail>
            {booking.employee_first_name && (
              <Detail icon={User} label="Technician">{booking.employee_first_name} {booking.employee_last_name}</Detail>
            )}
            {booking.payment_method && (
              <Detail icon={CreditCard} label="Payment method">{paymentMethodLabel(booking.payment_method)}</Detail>
            )}
            <Detail icon={MapPin} label="Address" wide>{booking.address}</Detail>
            {booking.notes && (
              <Detail icon={StickyNote} label="Notes" wide><span className="whitespace-pre-wrap">{booking.notes}</span></Detail>
            )}
            {booking.status === 'completed' && booking.completion_notes && (
              <Detail icon={CheckCircle2} label="Completion notes" wide><span className="whitespace-pre-wrap">{booking.completion_notes}</span></Detail>
            )}
          </dl>

          <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-1.5 text-sm">
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
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-brand-navy">{formatPrice(booking.price)}</span>
            </div>
          </div>
      </ModalBody>
      {(justConfirmed || showCancel) && (
        <ModalFooter>
          {showCancel && (
            <button
              type="button"
              onClick={() => onCancelBooking(booking)}
              className={`${modalButton.base} border border-red-200 bg-white text-red-600 hover:bg-red-50 ${justConfirmed ? '' : 'sm:mr-auto'}`}
            >
              Cancel booking
            </button>
          )}
          {justConfirmed && (
            <button type="button" onClick={onClose} className={`${modalButton.base} ${modalButton.primary}`}>
              Continue to My Bookings
            </button>
          )}
        </ModalFooter>
      )}
    </Modal>
  );
}
