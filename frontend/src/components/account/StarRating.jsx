import { useState } from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ value, onChange, readOnly = false, size = 'w-5 h-5' }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className={`flex items-center gap-0.5 ${readOnly ? '' : ''}`}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer'}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star className={`${size} ${n <= display ? 'fill-brand-orange text-brand-orange' : 'text-gray-300'} transition-colors`} />
        </button>
      ))}
    </div>
  );
}
