import { useEffect, useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import Modal, { ModalBody, ModalFooter, ModalHeader, modalButton } from './Modal';
import SafeImage from './SafeImage';
import StarRating from './account/StarRating';

// At z-[110] like ReturnRequestModal, so it sits above the order details modal it can
// open from. Reviews are one per customer per product (reviews.js enforces it with a 400), so
// this only ever offers the products of this order that the customer has not already rated —
// `reviewed` is the set of product ids they have, passed down rather than re-fetched.
export default function OrderReviewModal({ order, reviewed, onClose, onSubmitted }) {
  const [drafts, setDrafts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order) return;
    setDrafts({});
    setError('');
    setSubmitting(false);
  }, [order]);

  if (!order) return null;

  // An order that lists the same product on two lines still earns one review, so the list is
  // deduped by product before anything is offered.
  const seen = new Set();
  const items = (order.items || []).filter((i) => {
    if (seen.has(i.product_id) || reviewed?.has(i.product_id)) return false;
    seen.add(i.product_id);
    return true;
  });

  const rated = items.filter((i) => drafts[i.product_id]?.rating > 0);

  const setDraft = (productId, patch) => setDrafts((d) => ({
    ...d,
    [productId]: { rating: 0, comment: '', ...d[productId], ...patch },
  }));

  const submit = async (e) => {
    e.preventDefault();
    if (!rated.length || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      // Sequential rather than Promise.all: a partial failure should leave the reviews that did
      // land saved, and the first error is the one worth showing.
      for (const i of rated) {
        const draft = drafts[i.product_id];
        await api.post('/reviews', {
          productId: i.product_id,
          orderId: order.id,
          rating: draft.rating,
          comment: draft.comment || '',
        });
      }
      onSubmitted?.(rated.length);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} dismissible={!submitting} as="form" onSubmit={submit} zIndex={110}>
      <ModalHeader icon={Star} tone="orange" title="Write a review" subtitle={`Order #${order.id.slice(0, 8).toUpperCase()}`} />
      <ModalBody>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            You have already reviewed everything in this order. Thank you!
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((i) => (
              <div key={i.product_id} className="flex gap-3.5">
                <SafeImage
                  src={i.image}
                  alt={i.name}
                  className="w-14 h-14 shrink-0 rounded-xl object-cover bg-gray-100 ring-1 ring-gray-200/80"
                  iconClassName="w-5 h-5"
                />
                <div className="flex-1 min-w-0">
                  {i.brand && (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-teal truncate">{i.brand}</p>
                  )}
                  <p className="font-semibold text-sm text-brand-ink truncate mb-1.5">{i.name}</p>
                  <StarRating
                    value={drafts[i.product_id]?.rating || 0}
                    onChange={(rating) => setDraft(i.product_id, { rating })}
                  />
                  {drafts[i.product_id]?.rating > 0 && (
                    <textarea
                      value={drafts[i.product_id]?.comment || ''}
                      onChange={(e) => setDraft(i.product_id, { comment: e.target.value })}
                      rows={2}
                      placeholder="What did you think? (optional)"
                      className="input-field mt-2 text-sm resize-none"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p role="alert" className="text-sm text-red-600 mt-4">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} disabled={submitting} className={`${modalButton.base} ${modalButton.secondary}`}>
          {items.length === 0 ? 'Close' : 'Cancel'}
        </button>
        {items.length > 0 && (
          <button type="submit" disabled={!rated.length || submitting} className={`${modalButton.base} ${modalButton.primary}`}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Posting…' : rated.length > 1 ? `Post ${rated.length} reviews` : 'Post review'}
          </button>
        )}
      </ModalFooter>
    </Modal>
  );
}
