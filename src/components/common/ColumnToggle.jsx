import { useEffect, useRef, useState } from 'react';

// Dropdown checklist for showing/hiding optional table columns. `visible` is
// an object of {columnKey: boolean}; persists to localStorage under `storageKey`
// so the choice survives a reload.
export default function ColumnToggle({ label = 'Columns', columns, visible, onChange, storageKey }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggle = (key) => {
    const next = { ...visible, [key]: !visible[key] };
    onChange(next);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
    }
  };

  return (
    <div className="position-relative" ref={ref}>
      <button type="button" className="btn btn-sm btn-pill-outline" onClick={() => setOpen(o => !o)}>
        <i className="bi bi-layout-three-columns me-1"></i>{label}
      </button>
      {open && (
        <div className="position-absolute end-0 mt-2 bg-white border rounded-4 shadow-sm p-2" style={{ minWidth: 190, zIndex: 60 }}>
          <div className="px-2 py-1 text-muted small fw-semibold">Show columns</div>
          {columns.map(c => (
            <label key={c.key} className="d-flex align-items-center gap-2 px-2 py-1 small dropdown-item-custom rounded" style={{ cursor: 'pointer' }}>
              <input type="checkbox" className="form-check-input m-0" checked={visible[c.key] !== false} onChange={() => toggle(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function loadColumnPrefs(storageKey, defaults) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return saved ? { ...defaults, ...saved } : defaults;
  } catch {
    return defaults;
  }
}
