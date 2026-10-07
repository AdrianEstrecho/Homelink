import { forwardRef, useState } from 'react';
import { ImageOff } from 'lucide-react';

// An <img> that swaps in a placeholder icon if it fails to load, and fades in once it has
// (.img-pending / .img-in in motion.css). The ref goes to the <img>, e.g. for flyToCart.
const SafeImage = forwardRef(function SafeImage({ src, alt, className = '', iconClassName = 'w-8 h-8' }, ref) {
  const [failed, setFailed] = useState(false);
  // Tracked per source, so switching to another picture fades that one in too.
  const [loadedSrc, setLoadedSrc] = useState(null);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
        <ImageOff className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={`${className} ${loadedSrc === src ? 'img-in' : 'img-pending'}`}
      loading="lazy"
      onLoad={() => setLoadedSrc(src)}
      onError={() => setFailed(true)}
    />
  );
});

export default SafeImage;
