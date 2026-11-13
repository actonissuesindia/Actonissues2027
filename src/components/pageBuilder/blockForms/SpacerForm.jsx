import { useState } from 'react';

export default function SpacerForm({ config, onSave, onCancel, saving }) {
  const [height, setHeight] = useState(config.height ?? 40);

  return (
    <div className="p-2">
      <div className="mb-2">
        <label className="form-label small mb-1">Height (pixels)</label>
        <input
          type="number" min={0} className="form-control form-control-sm" style={{ width: 100 }}
          value={height} onChange={e => setHeight(Number(e.target.value))}
        />
      </div>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-sm btn-gradient" disabled={saving} onClick={() => onSave({ height })}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
