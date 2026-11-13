import { useState } from 'react';

export default function ButtonForm({ config, onSave, onCancel, saving }) {
  const [text, setText] = useState(config.text || '');
  const [href, setHref] = useState(config.href || '');
  const [style, setStyle] = useState(config.style || 'gradient');
  const [external, setExternal] = useState(!!config.external);

  return (
    <div className="p-2">
      <div className="mb-2">
        <label className="form-label small mb-1">Button text</label>
        <input className="form-control form-control-sm" value={text} onChange={e => setText(e.target.value)} />
      </div>
      <div className="mb-2">
        <label className="form-label small mb-1">Link (e.g. /feed or https://...)</label>
        <input className="form-control form-control-sm" value={href} onChange={e => setHref(e.target.value)} />
      </div>
      <div className="mb-2">
        <label className="form-label small mb-1">Style</label>
        <select className="form-select form-select-sm" value={style} onChange={e => setStyle(e.target.value)}>
          <option value="gradient">Solid gradient</option>
          <option value="outline">Outline</option>
          <option value="light">Light (for dark backgrounds)</option>
        </select>
      </div>
      <div className="form-check mb-2">
        <input className="form-check-input" type="checkbox" id="btn-external" checked={external} onChange={e => setExternal(e.target.checked)} />
        <label className="form-check-label small" htmlFor="btn-external">Opens in a new tab (external link)</label>
      </div>
      <div className="d-flex gap-2">
        <button
          type="button" className="btn btn-sm btn-gradient" disabled={saving || !text.trim() || !href.trim()}
          onClick={() => onSave({ text, href, style, external })}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
