import { useEffect } from 'react';
import { isVideoAttachment } from '../../utils/attachmentType';

// Full-screen photo viewer with prev/next for multi-photo issues. Closes on
// backdrop click, the close button, or Escape.
export default function Lightbox({ images, index, onClose, onNavigate }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate((index + 1) % images.length);
      if (e.key === 'ArrowLeft') onNavigate((index - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, images.length, onClose, onNavigate]);

  if (index == null) return null;
  const current = images[index];

  return (
    <div className="lightbox-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
        <i className="bi bi-x-lg"></i>
      </button>
      {images.length > 1 && (
        <button type="button" className="lightbox-nav lightbox-prev" onClick={() => onNavigate((index - 1 + images.length) % images.length)} aria-label="Previous">
          <i className="bi bi-chevron-left"></i>
        </button>
      )}
      {isVideoAttachment(current) ? (
        <video src={current.url} className="lightbox-image" controls autoPlay playsInline />
      ) : (
        <img src={current.url} alt={current.originalName || ''} className="lightbox-image" />
      )}
      {images.length > 1 && (
        <button type="button" className="lightbox-nav lightbox-next" onClick={() => onNavigate((index + 1) % images.length)} aria-label="Next">
          <i className="bi bi-chevron-right"></i>
        </button>
      )}
      {images.length > 1 && (
        <div className="lightbox-counter">{index + 1} / {images.length}</div>
      )}
    </div>
  );
}
