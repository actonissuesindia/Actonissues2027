import { useState } from 'react';

export default function HeadingForm({ config, onSave, onCancel, saving }) {
  const [eyebrow, setEyebrow] = useState(config.eyebrow || '');
  const [text, setText] = useState(config.text || '');
  const [level, setLevel] = useState(config.level || 'h2');

  return (
    <div className="p-2">
      <div className="mb-2">
        <label className="form-label small mb-1">Eyebrow (small line above, optional)</label>
        <input className="form-control form-control-sm" value={eyebrow} onChange={e => setEyebrow(e.target.value)} />
      </div>
      <div className="mb-2">
        <label className="form-label small mb-1">Heading text</label>
        <input className="form-control form-control-sm" value={text} onChange={e => setText(e.target.value)} />
      </div>
      <div className="mb-2">
        <label className="form-label small mb-1">Size</label>
        <select className="form-select form-select-sm" value={level} onChange={e => setLevel(e.target.value)}>
          <option value="h2">Section heading</option>
          <option value="h1">Large heading</option>
        </select>
      </div>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-sm btn-gradient" disabled={saving || !text.trim()} onClick={() => onSave({ eyebrow, text, level })}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
