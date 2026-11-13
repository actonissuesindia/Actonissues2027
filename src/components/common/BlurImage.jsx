import { useState } from 'react';

// Fades in from a blur once the image actually finishes downloading,
// instead of popping in abruptly — same idea as Instagram/Medium's
// progressive image loading, without needing a real low-res placeholder.
export default function BlurImage({ src, alt = '', className = '', style }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      style={style}
      loading="lazy"
      decoding="async"
      className={`${className} blur-img ${loaded ? 'blur-img-loaded' : ''}`.trim()}
      onLoad={() => setLoaded(true)}
    />
  );
}
