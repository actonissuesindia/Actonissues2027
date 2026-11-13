import { useRef, useState } from 'react';
import api from '../../../services/api';

export default function ImageForm({ config, onSave, onCancel, saving }) {
  const [url, setUrl] = useState(config.url || '');
  const [alt, setAlt] = useState(config.alt || '');
  const [shape, setShape] = useState(config.shape || 'square');
  const [size, setSize] = useState(config.size || 200);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/admin/page-blocks/upload-image', fd);
      setUrl(res.data.url || '');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-2">
      <div className="mb-2 d-flex align-items-center gap-3">
        <div
          className="d-flex align-items-center justify-content-center bg-body-tertiary rounded-3 flex-shrink-0"
          style={{ width: 96, height: 64, overflow: 'hidden' }}
        >
          {url
            ? <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <span className="text-muted small">No image</span>}
        </div>
        <button type="button" className="btn btn-sm btn-gradient" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? 'Uploading…' : 'Upload image'}
        </button>
        <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png" hidden onChange={handleFile} />
      </div>
      <div className="mb-2">
        <label className="form-label small mb-1">Alt text (for accessibility)</label>
        <input className="form-control form-control-sm" value={alt} onChange={e => setAlt(e.target.value)} />
      </div>
      <div className="d-flex gap-2 mb-2">
        <div>
          <label className="form-label small mb-1">Shape</label>
          <select className="form-select form-select-sm" value={shape} onChange={e => setShape(e.target.value)}>
            <option value="square">Square/rounded</option>
            <option value="round">Round</option>
          </select>
        </div>
        <div>
          <label className="form-label small mb-1">Size (px)</label>
          <input type="number" min={40} className="form-control form-control-sm" style={{ width: 90 }} value={size} onChange={e => setSize(Number(e.target.value))} />
        </div>
      </div>
      <div className="d-flex gap-2">
        <button
          type="button" className="btn btn-sm btn-gradient" disabled={saving || uploading || !url}
          onClick={() => onSave({ url, alt, shape, size })}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
