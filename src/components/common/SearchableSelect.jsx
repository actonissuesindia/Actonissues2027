import { useEffect, useRef, useState } from 'react';

// Drop-in replacement for a plain <select> when the option list is long
// enough that scrolling through it is the actual complaint (categories,
// cities, states, topics, ...). Same value/onChange contract as a native
// select — onChange receives the raw string — so it swaps in without
// touching whatever state/logic already consumes that value.
//
// `clearable` controls whether `allLabel` is a real selectable "clear to
// no filter" option (for optional filters like "All categories") or just
// placeholder text for a required field with no meaningful empty state
// (e.g. "Select a topic").
//
// `labels` optionally remaps raw option values to display text (e.g. the
// stored value 'Rejected' shown as 'Refused') without changing what's
// actually sent through onChange/value — the rest of the app keeps working
// against the real enum value.
export default function SearchableSelect({
  value, onChange, options, labels, allLabel = 'All', clearable = true, className = '', style, title
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const labelFor = (o) => (labels && labels[o]) || o;

  const filtered = query
    ? options.filter(o => labelFor(o).toLowerCase().includes(query.toLowerCase()))
    : options;

  const select = (next) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={`searchable-select ${className}`} style={style} ref={containerRef}>
      <input
        type="text"
        className="form-control form-control-sm searchable-select-input"
        title={title}
        value={open ? query : (value ? labelFor(value) : '')}
        placeholder={allLabel}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') { setOpen(false); setQuery(''); e.currentTarget.blur(); }
          if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); select(filtered[0]); }
        }}
      />
      <i className="bi bi-chevron-down searchable-select-caret"></i>
      {open && (
        <div className="searchable-select-menu">
          {clearable && (
            <button type="button" className={`searchable-select-option ${!value ? 'active' : ''}`}
              onMouseDown={e => e.preventDefault()} onClick={() => select('')}>
              {allLabel}
            </button>
          )}
          {filtered.length === 0 && <div className="searchable-select-empty">No matches</div>}
          {filtered.map(o => (
            <button key={o} type="button" className={`searchable-select-option ${o === value ? 'active' : ''}`}
              onMouseDown={e => e.preventDefault()} onClick={() => select(o)}>
              {labelFor(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
