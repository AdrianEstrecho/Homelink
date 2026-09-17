import { Quote } from 'lucide-react';
import Reveal from '../Reveal';
import ErrorState from '../ErrorState';
import StarRating from '../account/StarRating';
import { ReviewCardSkeleton } from '../Skeleton';

// A loop narrower than the viewport would show an empty gap before its
// duplicate scrolls in, so short review lists are repeated up to this many.
const MIN_PER_LOOP = 6;
const SECONDS_PER_CARD = 9;

function ReviewCard({ review }) {
  return (
    <figure className="w-[300px] sm:w-[360px] shrink-0 bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_-8px_rgba(15,43,91,0.10)] p-6 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-orange/30 hover:shadow-[0_20px_40px_-16px_rgba(15,43,91,0.25)]">
      <div className="flex items-center justify-between">
        <StarRating value={review.rating} readOnly size="w-4 h-4" />
        <Quote className="w-7 h-7 text-brand-orange/25" />
      </div>
      <blockquote className="text-gray-600 text-sm leading-relaxed flex-1">{review.comment}</blockquote>
      <figcaption className="flex items-center gap-3 pt-4 mt-1 border-t border-gray-100">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-navy to-brand-blue flex items-center justify-center text-white font-semibold text-sm shrink-0">
          {review.first_name[0]}{review.last_name[0]}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{review.first_name} {review.last_name}</p>
          <p className="text-xs text-gray-400 truncate">{review.product_name}</p>
        </div>
      </figcaption>
    </figure>
  );
}

// Featured reviews as an endless, edge-faded marquee (.testimonial-marquee in
// index.css) that pauses on hover or focus. Speed stays constant regardless
// of how many reviews there are, since the duration scales with the loop.
export default function Testimonials({ reviews, onRetry }) {
  if (!reviews.loading && !reviews.error && reviews.data.length === 0) return null;

  const loop = reviews.data.length
    ? Array.from({ length: Math.ceil(MIN_PER_LOOP / reviews.data.length) }, () => reviews.data).flat()
    : [];

  return (
    <section className="py-20 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center max-w-xl mx-auto mb-10">
          <p className="eyebrow justify-center mb-3">Testimonials</p>
          <h2 className="section-title">What our customers say</h2>
          <p className="text-gray-500 mt-3">Real reviews from homeowners who bought through HomeLink.</p>
        </Reveal>
        {reviews.loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => <ReviewCardSkeleton key={i} />)}
          </div>
        ) : reviews.error && (
          <ErrorState message="Couldn't load reviews right now." onRetry={onRetry} />
        )}
      </div>

      {loop.length > 0 && (
        <Reveal className="testimonial-marquee">
          <div className="testimonial-track" style={{ animationDuration: `${loop.length * SECONDS_PER_CARD}s` }}>
            {[0, 1].map(copy => (
              <div key={copy} className="flex gap-6 pr-6 shrink-0" aria-hidden={copy === 1 || undefined}>
                {loop.map((r, i) => <ReviewCard key={`${r.id}-${i}`} review={r} />)}
              </div>
            ))}
          </div>
        </Reveal>
      )}
    </section>
  );
}
