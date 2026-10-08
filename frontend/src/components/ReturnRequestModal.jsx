import { useEffect, useId, useState } from 'react';
import { RotateCcw, X, ImagePlus, Loader2 } from 'lucide-react';
import { api, formatPrice } from '../api/client';
import Modal, { ModalBody, ModalFooter, ModalHeader, modalButton } from './Modal';
import SafeImage from './SafeImage';
import { downscaleImage, validateImageFile, dataUrlBytes } from '../utils/imageUpload';
import { MAX_RETURN_PHOTOS, INELIGIBLE_MESSAGE, orderRef } from '../utils/returns';

const MIN_REASON = 10;
// The server accepts 8MB of photos in total; stopping short of that here means the customer gets
// a real message instead of the bare "Request failed" a 413 would produce.
const MAX_TOTAL_BYTES = 7 * 1024 * 1024;

// At z-[110] like CancelReasonModal, so it sits above the order details modal it opens
// from. Loads its own eligibility on open rather than trusting the list's canReturn flag, since
// another tab may have used up the remaining quantity in the meantime.
export default function ReturnRequestModal({ order, onClose, onSubmitted }) {
  const reasonId = useId();
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState({});
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order) return;
    setData(null); setPicked({}); setReason(''); setPhotos([]); setError(''); setSubmitting(false);
    api.get(`/returns/eligibility/${order.id}`).then(setData).catch((err) => {
      setError(err.message);
      setData({ eligible: false, lines: [], existingReturns: [] });
    });
  }, [order]);

  if (!order) return null;

  const lines = (data?.lines || []).filter((l) => l.returnableQty > 0);
  const selected = lines
    .filter((l) => picked[l.orderItemId] > 0)
    .map((l) => ({ ...l, quantity: picked[l.orderItemId] }));
  // Same sum as the backend's prorateRefund: each line's share of the discount comes off and its
  // share of the tax goes back. Shipping isn't refunded.
  const estimate = selected.reduce((sum, l) => {
    const lineTotal = l.quantity * l.unitPrice;
    const ratio = order.subtotal > 0 ? lineTotal / order.subtotal : 0;
    return sum + Math.max(0, lineTotal - ratio * (order.discount || 0)) + ratio * (Number(order.tax) || 0);
  }, 0);

  const toggle = (line) => setPicked((p) => ({
    ...p,
    [line.orderItemId]: p[line.orderItemId] > 0 ? 0 : 1,
  }));

  const setQty = (line, qty) => setPicked((p) => ({
    ...p,
    [line.orderItemId]: Math.max(1, Math.min(line.returnableQty, qty)),
  }));

  const addPhotos = async (fileList) => {
    const files = [...fileList].slice(0, MAX_RETURN_PHOTOS - photos.length);
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      const next = [...photos];
      for (const file of files) {
        const invalid = validateImageFile(file);
        if (invalid) { setError(invalid); continue; }
        next.push(await downscaleImage(file));
      }
      if (next.reduce((n, p) => n + dataUrlBytes(p), 0) > MAX_TOTAL_BYTES) {
        setError('Those photos are too large together. Please use fewer or smaller images.');
        return;
      }
      setPhotos(next);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!selected.length) { setError('Select at least one item to return.'); return; }
    if (reason.trim().length < MIN_REASON) { setError(`Please describe the problem in at least ${MIN_REASON} characters.`); return; }
    if (!photos.length) { setError('Please attach at least one photo of the product.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const created = await api.post('/returns', {
        orderId: order.id,
        reason: reason.trim(),
        items: selected.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity })),
        photos,
      });
      onSubmitted(created);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const eligible = data?.eligible;

  return (
    <Modal onClose={onClose} dismissible={!submitting} as="form" onSubmit={submit} zIndex={110}>
      <ModalHeader icon={RotateCcw} title="Return & refund" subtitle={`Order ${orderRef(order.id)}`} />
      <ModalBody>
        {data === null ? (
          <div className="space-y-3" role="status" aria-label="Loading your order">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
          </div>
        ) : !eligible ? (
          <p className="text-sm text-gray-600">
            {INELIGIBLE_MESSAGE[data.reason] || error || 'This order can’t be returned.'}
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Pick what you’re sending back and tell us what went wrong. A member of our team reviews every request.
            </p>

            <p className="text-sm font-medium text-brand-ink mt-5 mb-2">Items to return</p>
            <div className="space-y-2">
              {lines.map((l) => {
                const qty = picked[l.orderItemId] || 0;
                return (
                  <div key={l.orderItemId} className={`rounded-xl border p-3 transition ${qty > 0 ? 'border-brand-navy/30 bg-brand-navy/[0.03]' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={qty > 0}
                        onChange={() => toggle(l)}
                        disabled={submitting}
                        className="w-4 h-4 rounded border-gray-300 text-brand-navy shrink-0"
                      />
                      <SafeImage src={l.image} alt={l.name} className="w-12 h-12 rounded-lg object-cover bg-gray-100 shrink-0" iconClassName="w-5 h-5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">{l.name}</p>
                        <p className="text-xs text-gray-500">{formatPrice(l.unitPrice)} each · {l.returnableQty} of {l.orderedQty} available</p>
                      </div>
                    </div>
                    {qty > 0 && l.returnableQty > 1 && (
                      <div className="flex items-center gap-2 mt-3 pl-7">
                        <span className="text-xs text-gray-500">Quantity</span>
                        <button type="button" onClick={() => setQty(l, qty - 1)} disabled={submitting || qty <= 1} className="w-7 h-7 rounded border border-gray-300 text-gray-600 disabled:opacity-40">−</button>
                        <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                        <button type="button" onClick={() => setQty(l, qty + 1)} disabled={submitting || qty >= l.returnableQty} className="w-7 h-7 rounded border border-gray-300 text-gray-600 disabled:opacity-40">+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <label htmlFor={reasonId} className="block text-sm font-medium text-brand-ink mt-5 mb-1.5">What’s wrong with it?</label>
            <textarea
              id={reasonId}
              rows={3}
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (error) setError(''); }}
              placeholder="Tell us what happened — damaged on arrival, wrong item, not as described..."
              disabled={submitting}
              className="input-field resize-none disabled:opacity-60"
            />

            <p className="text-sm font-medium text-brand-ink mt-5 mb-1.5">
              Photos of the product <span className="text-gray-400 font-normal">({photos.length}/{MAX_RETURN_PHOTOS}, required)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {photos.map((src, i) => (
                <div key={i} className="relative">
                  <SafeImage src={src} alt={`Photo ${i + 1}`} className="w-20 h-20 rounded-lg object-cover bg-gray-100" iconClassName="w-5 h-5" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                    disabled={submitting}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-300 text-gray-500 flex items-center justify-center hover:text-red-600 disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_RETURN_PHOTOS && (
                <label className={`w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-brand-navy/40 hover:text-brand-navy focus-within:border-brand-orange focus-within:text-brand-navy transition ${busy || submitting ? 'opacity-50' : 'cursor-pointer'}`}>
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                  <span className="text-[10px] mt-1">{busy ? 'Adding' : 'Add'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    disabled={busy || submitting}
                    onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }}
                    aria-label="Add photos"
                    className="sr-only"
                  />
                </label>
              )}
            </div>

            {selected.length > 0 && (
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Estimated refund</p>
                  <p className="text-xs text-gray-400">Our team confirms the final amount.</p>
                </div>
                <p className="font-display font-bold text-lg text-brand-navy">{formatPrice(estimate)}</p>
              </div>
            )}

            {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} disabled={submitting} className={`${modalButton.base} ${modalButton.secondary}`}>
          {eligible ? 'Cancel' : 'Close'}
        </button>
        {eligible && (
          <button type="submit" disabled={submitting || busy} className={`${modalButton.base} ${modalButton.primary}`}>
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit request'}
          </button>
        )}
      </ModalFooter>
    </Modal>
  );
}
