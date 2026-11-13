import { useEffect, useRef, useState } from 'react';

const EMOJI_SET = [
  '😀', '😂', '😍', '😢', '😡', '😮', '👍', '👏', '🙏', '💪',
  '🎉', '🎊', '✨', '🔥', '⭐', '❤️', '💔', '⚠️', '🚧', '🚨',
  '📢', '📌', '✅', '❌', '🕒', '📍', '🏙️', '🚗', '💧', '🌳'
];

// A small popover grid of common emoji — calls onSelect(emoji) and lets the
// caller decide what to do with it (e.g. insert at the text field's current
// cursor position, see insertAtCursor in AdminDashboard.jsx).
export default function EmojiPicker({ onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="position-relative d-inline-block" ref={ref}>
      <button
        type="button" className="btn btn-outline-secondary" title="Insert emoji"
        onClick={() => setOpen(o => !o)}
      >
        😊
      </button>
      {open && (
        <div
          className="position-absolute bg-white border rounded-3 shadow-sm p-2"
          style={{ zIndex: 60, width: 230, top: '100%', marginTop: 4 }}
        >
          <div className="d-flex flex-wrap gap-1">
            {EMOJI_SET.map(e => (
              <button
                key={e} type="button" className="btn btn-sm p-1 border-0"
                style={{ fontSize: '1.15rem', lineHeight: 1 }}
                onClick={() => { onSelect(e); setOpen(false); }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
