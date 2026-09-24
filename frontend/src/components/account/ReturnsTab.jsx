import { useEffect, useState } from 'react';
import { PackageCheck, Image as ImageIcon } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import SafeImage from '../SafeImage';
import {
  returnRef, orderRef, RETURN_STATUS_STYLE, RETURN_STATUS_LABEL, RETURN_STATUS_HINT,
  REFUND_STATUS_LABEL,
} from '../../utils/returns';

// Photos are deliberately left out of GET /returns/my — they're base64 and would make the list
// multi-megabyte — so each card fetches its own on demand, once.
function PhotoStrip({ returnId }) {
  const [photos, setPhotos] = useState(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    setOpen(true);
    if (photos === null) api.get(`/returns/${returnId}/photos`).then(setPhotos).catch(() => setPhotos([]));
  };

  if (!open) {
    return (
      <button onClick={show} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-navy hover:underline">
        <ImageIcon className="w-3.5 h-3.5" /> View photos
      </button>
    );
  }

  if (photos === null) return <p className="mt-3 text-xs text-gray-400">Loading photos...</p>;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {photos.map((p) => (
        <SafeImage key={p.id} src={p.image} alt="Returned product" className="w-20 h-20 rounded-lg object-cover bg-gray-100" iconClassName="w-5 h-5" />
      ))}
    </div>
  );
}

export default function ReturnsTab() {
  const [returns, setReturns] = useState(null);

  useEffect(() => {
    api.get('/returns/my').then(setReturns).catch(() => setReturns([]));
  }, []);

  return (
    <div>
      <h2 className="font-display font-bold text-lg text-brand-ink mb-1">Returns &amp; Refunds</h2>
      <p className="text-sm text-gray-500 mb-6">
        Requests you&apos;ve made to send items back. Start one from a delivered order in My Orders.
      </p>

      {returns === null ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : returns.length === 0 ? (
        <div className="text-center py-10">
          <PackageCheck className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">You haven&apos;t requested any returns yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((r) => (
            <div key={r.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-brand-navy bg-brand-navy/10 rounded px-1.5 py-0.5">{returnRef(r.id)}</span>
                  <p className="text-sm font-semibold text-gray-800">Order {orderRef(r.order_id)}</p>
                </div>
                <span className={`badge ${RETURN_STATUS_STYLE[r.status]}`}>{RETURN_STATUS_LABEL[r.status]}</span>
              </div>

              <p className="text-xs text-gray-500 mt-2">{RETURN_STATUS_HINT[r.status]}</p>

              <div className="mt-3 space-y-1.5">
                {r.items.map((i, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <SafeImage src={i.image} alt={i.name} className="w-9 h-9 rounded-lg object-cover bg-gray-100 shrink-0" iconClassName="w-4 h-4" />
                    <p className="text-sm text-gray-700 min-w-0 truncate">
                      {i.name} <span className="text-gray-400">&times;{i.quantity}</span>
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-600 mt-3"><span className="text-gray-400">Your reason:</span> {r.reason}</p>

              {r.review_note && (
                <p className="text-sm text-gray-700 mt-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <span className="text-xs font-semibold text-brand-navy block mb-0.5">Note from HomeLink</span>
                  {r.review_note}
                </p>
              )}

              {r.photo_count > 0 && <PhotoStrip returnId={r.id} />}

              <div className="flex items-center justify-between gap-2 flex-wrap mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-400">
                  Requested {new Date(r.created_at).toLocaleDateString()}
                  {r.received_at ? ` · Received ${new Date(r.received_at).toLocaleDateString()}` : ''}
                </p>
                <p className="text-sm">
                  <span className="text-gray-400 text-xs mr-1.5">{REFUND_STATUS_LABEL[r.refund_status]}</span>
                  <span className="font-semibold text-brand-navy">{formatPrice(r.refund_amount)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
