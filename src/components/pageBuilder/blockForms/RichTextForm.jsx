import { useState } from 'react';

export default function RichTextForm({ config, onSave, onCancel, saving }) {
  const [paragraphs, setParagraphs] = useState(config.paragraphs?.length ? config.paragraphs : ['']);

  const update = (i, value) => setParagraphs(list => list.map((p, idx) => idx === i ? value : p));
  const remove = (i) => setParagraphs(list => list.filter((_, idx) => idx !== i));
  const add = () => setParagraphs(list => [...list, '']);

  const canSave = paragraphs.some(p => p.trim());

  return (
    <div className="p-2">
      {paragraphs.map((p, i) => (
        <div className="mb-2 d-flex gap-2 align-items-start" key={i}>
          <textarea
            className="form-control form-control-sm" rows={3}
            value={p} onChange={e => update(i, e.target.value)}
            placeholder={`Paragraph ${i + 1}`}
          />
          {paragraphs.length > 1 && (
            <button type="button" className="btn btn-sm btn-outline-danger flex-shrink-0" onClick={() => remove(i)}>
              <i className="bi bi-trash3"></i>
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={add}>+ Add paragraph</button>
      <div className="d-flex gap-2">
        <button
          type="button" className="btn btn-sm btn-gradient" disabled={saving || !canSave}
          onClick={() => onSave({ paragraphs: paragraphs.filter(p => p.trim()) })}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
