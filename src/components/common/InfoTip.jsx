import { useEffect, useRef, useState } from 'react';

// A small "i" button next to a form label that reveals a format hint on
// tap/click — used instead of filling the field with fake example data as
// a placeholder, which can read as pre-filled real content at a glance.
export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <span className="position-relative d-inline-flex" ref={ref}>
      <button
        type="button"
        className="info-tip-btn"
        aria-label="More info"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <i className="bi bi-info-circle"></i>
      </button>
      {open && (
        <div className="info-tip-bubble position-absolute top-100 start-0 mt-1 bg-white border rounded-3 shadow-sm p-2 small text-muted">
          {text}
        </div>
      )}
    </span>
  );
}
