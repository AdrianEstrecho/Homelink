import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Trash2, PenLine } from 'lucide-react';
import { api } from '../../api/client';
import StarRating from './StarRating';

export default function ReviewsTab() {
  const [reviewable, setReviewable] = useState(null);
  const [myReviews, setMyReviews] = useState(null);
  const [writing, setWriting] = useState(null); // product id currently being reviewed
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    api.get('/reviews/reviewable').then(setReviewable).catch(() => setReviewable([]));
    api.get('/reviews/my').then(setMyReviews).catch(() => setMyReviews([]));
  };
  useEffect(() => { load(); }, []);

  const startReview = (product) => { setWriting(product); setRating(0); setComment(''); setError(''); };
  const cancelReview = () => { setWriting(null); setRating(0); setComment(''); setError(''); };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!rating) { setError('Pick a star rating'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/reviews', { productId: writing.id, orderId: writing.order_id, rating, comment });
      cancelReview();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this review?')) return;
    await api.delete(`/reviews/${id}`);
    load();
  };

  return (
    <div>
      <h2 className="font-display font-semibold text-lg text-brand-navy mb-1">Reviews</h2>
      <p className="text-sm text-gray-500 mb-6">Share your experience with products you've purchased.</p>

      {/* Products awaiting review */}
      {reviewable !== null && reviewable.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Products to Review</h3>
          <div className="space-y-3">
            {reviewable.map(p => (
              <div key={p.id} className="rounded-xl bg-gray-50 border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <img src={p.image} alt={p.name} className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-100" />
                  <p className="text-sm font-semibold text-gray-800 flex-1 min-w-0 truncate">{p.name}</p>
                  {writing?.id !== p.id && (
                    <button onClick={() => startReview(p)} className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:text-brand-orange transition shrink-0">
                      <PenLine className="w-4 h-4" /> Write a Review
                    </button>
                  )}
                </div>
                {writing?.id === p.id && (
                  <form onSubmit={submitReview} className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-200">
                    <StarRating value={rating} onChange={setRating} />
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="How was it? (optional)"
                      rows={2}
                      className="input-field text-sm"
                    />
                    {error && <p className="text-red-600 text-sm">{error}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving} className="btn-primary text-sm py-1.5 disabled:opacity-60">{saving ? 'Posting...' : 'Post Review'}</button>
                      <button type="button" onClick={cancelReview} className="text-sm font-semibold text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My reviews */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">My Reviews</h3>
      {myReviews === null ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : myReviews.length === 0 ? (
        <div className="text-center py-10">
          <Star className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {reviewable?.length ? 'No reviews yet — write your first one above.' : (
              <>You haven't purchased anything yet. <Link to="/products" className="text-brand-orange font-semibold hover:underline">Browse products</Link></>
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {myReviews.map(r => (
            <div key={r.id} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <img src={r.product_image} alt={r.product_name} className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-100" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-800 truncate">{r.product_name}</p>
                  <StarRating value={r.rating} readOnly size="w-3.5 h-3.5" />
                </div>
                {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
                <p className="text-xs text-gray-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <button onClick={() => remove(r.id)} title="Delete review" className="p-2 text-gray-400 hover:text-red-600 transition shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
