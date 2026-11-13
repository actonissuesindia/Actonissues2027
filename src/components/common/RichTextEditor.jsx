import { useEffect, useRef } from 'react';

// Minimal WYSIWYG toolbar (bold/italic/underline, font/size, color,
// alignment, lists) for composing bulk emails to users — built on the
// browser's own contentEditable + execCommand rather than a new dependency,
// consistent with this codebase's otherwise dependency-light approach (no
// UI kit beyond Bootstrap anywhere else). `onChange` receives the resulting
// HTML string, which is what actually gets emailed (see
// controllers/userAdminController.js's sendBulkEmail, messageIsHtml: true).
const TEXT_COLORS = ['#0F172A', '#DC2626', '#2563EB', '#16A34A', '#D97706'];

export default function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);

  // Only pushes `value` into the DOM when it's actually out of sync with
  // what the user is looking at (e.g. the form was reset/cleared) — syncing
  // on every render would otherwise fight the browser's own cursor position
  // mid-keystroke.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (cmd, arg) => {
    ref.current.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current.innerHTML);
  };

  const execFromSelect = (cmd) => (e) => {
    if (e.target.value) exec(cmd, e.target.value);
    e.target.value = '';
  };

  return (
    <div className="border rounded-3">
      <div className="d-flex flex-wrap align-items-center gap-1 p-2 border-bottom bg-body-tertiary">
        <select className="form-select form-select-sm w-auto" defaultValue="" onChange={execFromSelect('fontName')} title="Font">
          <option value="">Font</option>
          <option value="Arial, Helvetica, sans-serif">Sans Serif</option>
          <option value="Georgia, 'Times New Roman', serif">Serif</option>
          <option value="'Courier New', monospace">Monospace</option>
        </select>
        <select className="form-select form-select-sm w-auto" defaultValue="" onChange={execFromSelect('fontSize')} title="Size">
          <option value="">Size</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="5">Large</option>
          <option value="7">Huge</option>
        </select>
        <div className="vr mx-1"></div>
        <button type="button" className="btn btn-sm btn-light border" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} title="Bold">
          <i className="bi bi-type-bold"></i>
        </button>
        <button type="button" className="btn btn-sm btn-light border" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')} title="Italic">
          <i className="bi bi-type-italic"></i>
        </button>
        <button type="button" className="btn btn-sm btn-light border" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')} title="Underline">
          <i className="bi bi-type-underline"></i>
        </button>
        <div className="vr mx-1"></div>
        <div className="d-flex gap-1 align-items-center">
          {TEXT_COLORS.map(c => (
            <button
              key={c} type="button" className="btn p-0 border rounded-circle flex-shrink-0"
              style={{ width: 20, height: 20, background: c }}
              onMouseDown={e => e.preventDefault()} onClick={() => exec('foreColor', c)}
              title="Text color"
            ></button>
          ))}
        </div>
        <div className="vr mx-1"></div>
        <button type="button" className="btn btn-sm btn-light border" onMouseDown={e => e.preventDefault()} onClick={() => exec('justifyLeft')} title="Align left">
          <i className="bi bi-text-left"></i>
        </button>
        <button type="button" className="btn btn-sm btn-light border" onMouseDown={e => e.preventDefault()} onClick={() => exec('justifyCenter')} title="Align center">
          <i className="bi bi-text-center"></i>
        </button>
        <button type="button" className="btn btn-sm btn-light border" onMouseDown={e => e.preventDefault()} onClick={() => exec('justifyRight')} title="Align right">
          <i className="bi bi-text-right"></i>
        </button>
        <div className="vr mx-1"></div>
        <button type="button" className="btn btn-sm btn-light border" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')} title="Bulleted list">
          <i className="bi bi-list-ul"></i>
        </button>
        <button type="button" className="btn btn-sm btn-light border" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertOrderedList')} title="Numbered list">
          <i className="bi bi-list-ol"></i>
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        className="rich-text-editor-body p-2"
        style={{ minHeight: 160, outline: 'none' }}
        onInput={() => onChange(ref.current.innerHTML)}
        data-placeholder={placeholder}
      />
    </div>
  );
}
