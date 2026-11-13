import { useState } from 'react';

// Toggle blocks (Feed's chrome rows, Home's live-section placeholders) are
// seeded once and never added through the admin UI — `key` is a fixed system
// identifier Feed.jsx/Home.jsx look up by exact match, so it's shown but not
// editable here: changing it away from what was seeded would leave two
// blocks claiming the same slot (or none), which the lookup can't recover from.
export default function ToggleForm({ config, onSave, onCancel, saving }) {
  const [label, setLabel] = useState(config.label || '');

  return (
    <div className="p-2">
      <div className="mb-2">
        <label className="form-label small mb-1">Toggle key (fixed, not editable)</label>
        <input className="form-control form-control-sm" value={config.key} disabled readOnly />
      </div>
      <div className="mb-2">
        <label className="form-label small mb-1">Label shown to Super Admin</label>
        <input className="form-control form-control-sm" value={label} onChange={e => setLabel(e.target.value)} />
      </div>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-sm btn-gradient" disabled={saving || !label.trim()} onClick={() => onSave({ key: config.key, label })}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
