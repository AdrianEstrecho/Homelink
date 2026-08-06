import { useState } from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ value, onChange, readOnly = false, size = 'w-5 h-5' }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  if (readOnly) {
    return (
      <div className="flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map(n => (
          <Star key={n} className={`${size} ${n <= value ? 'fill-brand-orange text-brand-orange' : 'text-gray-300'} transition-colors`} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="cursor-pointer"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star className={`${size} ${n <= display ? 'fill-brand-orange text-brand-orange' : 'text-gray-300'} transition-colors`} />
        </button>
      ))}
    </div>
  );
}
