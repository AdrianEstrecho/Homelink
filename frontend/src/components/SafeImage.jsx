import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export default function SafeImage({ src, alt, className = '', iconClassName = 'w-8 h-8' }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
        <ImageOff className={iconClassName} />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}
