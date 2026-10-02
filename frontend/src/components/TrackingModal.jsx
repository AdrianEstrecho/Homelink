import { useEffect, useState } from 'react';
import { Truck, User, Phone, MapPinned } from 'lucide-react';
import { api } from '../api/client';
import Modal, { ModalBody, ModalHeader } from './Modal';
import { formatDateTime } from '../data/auditActions';
import StatusStepper from './StatusStepper';
import TrackingMap from './TrackingMap';

const ORDER_LABELS = { pending: 'Order Placed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered' };
const BOOKING_LABELS = { pending: 'Requested', confirmed: 'Technician Assigned', in_progress: 'In Progress', completed: 'Completed' };

// Distance-only ETA (no real courier to query) — once 'shipped', interpolate the product's map
// position between office and destination based on how much of the estimated transit has
// elapsed since the shipped timestamp in the timeline.
function interpolatedOrderPosition(data) {
  if (data.status !== 'shipped' || !data.origin || !data.destination) return null;
  const shippedEntry = [...data.timeline].reverse().find(e => e.status === 'shipped');
  if (!shippedEntry || !data.etaDays) return null;
  const elapsedMs = Date.now() - new Date(shippedEntry.at).getTime();
  const totalMs = data.etaDays * 24 * 60 * 60 * 1000;
  const fraction = Math.max(0, Math.min(1, elapsedMs / totalMs));
  return {
    lat: data.origin.lat + (data.destination.lat - data.origin.lat) * fraction,
    lng: data.origin.lng + (data.destination.lng - data.origin.lng) * fraction,
  };
}

export default function TrackingModal({ kind, id, title, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/${kind}s/${id}/tracking`).then(setData).catch(() => setError(true));
  }, [kind, id]);

  const steps = kind === 'order' ? ['pending', 'processing', 'shipped', 'delivered'] : ['pending', 'confirmed', 'in_progress', 'completed'];
  const labels = kind === 'order' ? ORDER_LABELS : BOOKING_LABELS;

  return (
    <Modal onClose={onClose}>
      <ModalHeader
        icon={MapPinned}
        title={title || 'Track your order'}
        subtitle={kind === 'order' ? 'Where your delivery is now, and every step so far.' : 'Your technician, the schedule, and every step so far.'}
      />
      <ModalBody className="space-y-5">
          {error && <p role="alert" className="text-sm text-red-600">Couldn't load tracking info right now. Close this and try again in a moment.</p>}

          {!error && !data && (
            <div className="space-y-4" role="status" aria-label="Loading tracking info">
              <div className="skeleton h-12" />
              <div className="skeleton h-48" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          )}

          {data && (
            <>
              {data.status === 'cancelled' ? (
                <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                  <p className="text-sm font-semibold text-red-700 mb-1">Cancelled</p>
                  {data.cancelReason && <p className="text-sm text-red-800">{data.cancelReason}</p>}
                </div>
              ) : (
                <StatusStepper steps={steps} labels={labels} currentStatus={data.status} />
              )}

              {kind === 'order' && data.status !== 'cancelled' && data.estimatedDeliveryDate && (
                <p className="text-sm text-gray-600">
                  Estimated delivery: <span className="font-semibold text-brand-navy">{new Date(data.estimatedDeliveryDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })}</span>
                  {' '}(~{data.etaDays} day{data.etaDays === 1 ? '' : 's'} in transit)
                </p>
              )}

              {(data.origin || data.destination) && (
                <TrackingMap
                  origin={data.origin}
                  destination={data.destination}
                  movingPoint={kind === 'order' ? interpolatedOrderPosition(data) : null}
                  technicianLocation={kind === 'booking' ? data.technicianLocation : null}
                />
              )}

              {kind === 'booking' && data.technician && (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <User className="w-4 h-4 text-brand-orange" />
                    <span className="font-medium">{data.technician.name}</span>
                  </div>
                  {data.technician.phone && (
                    <a href={`tel:${data.technician.phone}`} className="flex items-center gap-1 text-xs text-brand-teal hover:underline">
                      <Phone className="w-3.5 h-3.5" /> {data.technician.phone}
                    </a>
                  )}
                </div>
              )}

              {kind === 'booking' && data.status === 'in_progress' && !data.technicianLocation && (
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Technician hasn't started sharing live location yet.
                </p>
              )}

              <div>
                <h3 className="text-sm font-semibold text-brand-ink mb-3">History</h3>
                <div className="space-y-3">
                  {data.timeline.map((entry, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center pt-0.5">
                        <span className="w-2 h-2 rounded-full bg-brand-orange shrink-0" />
                        {i < data.timeline.length - 1 && <span className="w-px flex-1 bg-gray-200 mt-1" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-sm font-medium text-gray-800">{entry.note}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(entry.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
      </ModalBody>
    </Modal>
  );
}
