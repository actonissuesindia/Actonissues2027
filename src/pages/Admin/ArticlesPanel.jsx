import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import RichTextEditor from '../../components/common/RichTextEditor';
import GroupedTableRows, { GroupBySelect } from '../../components/admin/GroupedTableRows';

const EMPTY_FORM = {
  title: '', excerpt: '', body: '', coverImage: '', tags: '', status: 'Draft',
  authorName: '', seoTitle: '', seoDescription: '', slug: ''
};

// SEO blog content — Super Admin only (see routes/adminRoutes.js), separate
// from the Page Builder tab which only edits fixed site chrome (Home/About/
// Footer/TopNav), not long-form posts. Reuses RichTextEditor (real HTML
// body, unlike Page Builder's plain-textarea richtext block) and the
// existing page-blocks image-upload endpoint for the cover image.
export default function ArticlesPanel() {
  const toast = useToast();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null = list view, 'new' = create, else article._id
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [groupBy, setGroupBy] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/admin/articles').then(res => setArticles(res.data.articles)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY_FORM); setError(''); setEditingId('new'); };
  const openEdit = (a) => {
    setForm({
      title: a.title, excerpt: a.excerpt || '', body: a.body, coverImage: a.coverImage || '',
      tags: (a.tags || []).join(', '), status: a.status, authorName: a.authorName || '',
      seoTitle: a.seoTitle || '', seoDescription: a.seoDescription || '', slug: a.slug
    });
    setError('');
    setEditingId(a._id);
  };
  const cancel = () => setEditingId(null);

  const uploadCoverImage = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/admin/page-blocks/upload-image', fd);
      setForm(f => ({ ...f, coverImage: res.data.url }));
    } catch {
      toast('Failed to upload image', 'danger');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required.');
      return;
    }
    setError('');
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      body: form.body,
      coverImage: form.coverImage,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      status: form.status,
      authorName: form.authorName.trim(),
      seoTitle: form.seoTitle.trim(),
      seoDescription: form.seoDescription.trim(),
      slug: form.slug.trim() || undefined
    };
    try {
      if (editingId === 'new') {
        await api.post('/admin/articles', payload);
        toast('Article created');
      } else {
        await api.patch(`/admin/articles/${editingId}`, payload);
        toast('Article updated');
      }
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save article');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"? This can't be undone.`)) return;
    await api.delete(`/admin/articles/${a._id}`);
    toast('Article deleted');
    load();
  };

  if (editingId) {
    return (
      <div className="card p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="fw-bold mb-0">{editingId === 'new' ? 'New Article' : 'Edit Article'}</h5>
          <button type="button" className="btn btn-sm btn-pill-outline" onClick={cancel} disabled={busy}>Back to List</button>
        </div>
        <form onSubmit={save}>
          {error && <div className="alert alert-danger py-2">{error}</div>}

          <label className="form-label small fw-semibold">Title</label>
          <input className="form-control mb-3" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required autoFocus />

          <label className="form-label small fw-semibold">Slug (optional — auto-generated from title if left blank)</label>
          <input className="form-control mb-3" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="e.g. how-to-report-a-pothole" />

          <label className="form-label small fw-semibold">Excerpt / Meta Description</label>
          <textarea className="form-control mb-1" rows={2} maxLength={300} value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} />
          <div className={`form-text mb-3 ${form.excerpt.length > 155 ? 'text-danger' : ''}`}>{form.excerpt.length}/155 characters (used as the meta description shown in search results)</div>

          <label className="form-label small fw-semibold">Cover Image (optional)</label>
          <input type="file" className="form-control mb-2" accept="image/png,image/jpeg"
            onChange={e => e.target.files[0] && uploadCoverImage(e.target.files[0])} disabled={uploading} />
          {form.coverImage && <img src={form.coverImage} alt="" style={{ maxWidth: 240, borderRadius: 8 }} className="mb-3 d-block" />}

          <label className="form-label small fw-semibold">Body</label>
          <RichTextEditor value={form.body} onChange={html => setForm({ ...form, body: html })} placeholder="Write the article…" />

          <div className="row g-2 mt-1">
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Tags (comma-separated)</label>
              <input className="form-control" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="pothole, roads, how-to" />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Author Name</label>
              <input className="form-control" value={form.authorName} onChange={e => setForm({ ...form, authorName: e.target.value })} placeholder="Act On Issues Team" />
            </div>
          </div>

          <div className="row g-2 mt-1">
            <div className="col-md-6">
              <label className="form-label small fw-semibold">SEO Title Override (optional)</label>
              <input className="form-control" maxLength={100} value={form.seoTitle} onChange={e => setForm({ ...form, seoTitle: e.target.value })} />
              <div className={`form-text ${form.seoTitle.length > 60 ? 'text-danger' : ''}`}>{form.seoTitle.length}/60</div>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">SEO Description Override (optional)</label>
              <input className="form-control" maxLength={200} value={form.seoDescription} onChange={e => setForm({ ...form, seoDescription: e.target.value })} />
              <div className={`form-text ${form.seoDescription.length > 155 ? 'text-danger' : ''}`}>{form.seoDescription.length}/155</div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 mt-3">
            <label className="form-label small fw-semibold mb-0">Status:</label>
            <select className="form-select form-select-sm" style={{ width: 'auto' }} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="Draft">Draft</option>
              <option value="Published">Published</option>
            </select>
            <button type="submit" className="btn btn-gradient ms-auto" disabled={busy}>
              {busy ? 'Saving…' : editingId === 'new' ? 'Create Article' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="fw-bold mb-0">Articles</h5>
        <div className="d-flex align-items-center gap-3 ms-auto">
          <GroupBySelect value={groupBy} onChange={setGroupBy} options={[{ value: 'status', label: 'Status' }]} />
          <button type="button" className="btn btn-sm btn-gradient" onClick={openNew}>
            <i className="bi bi-plus-lg me-1"></i>New Article
          </button>
        </div>
      </div>
      {loading ? <p className="text-muted small">Loading…</p> : articles.length === 0 ? (
        <p className="text-muted small">No articles yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Title</th><th>Status</th><th>Published</th><th>By</th><th></th></tr></thead>
            <tbody>
              <GroupedTableRows
                rows={articles}
                groupBy={groupBy}
                groupKeyFn={a => a.status}
                colSpan={5}
                renderRow={a => (
                <tr key={a._id}>
                  <td>{a.title}<div className="text-muted small">/articles/{a.slug}</div></td>
                  <td><span className={`badge ${a.status === 'Published' ? 'text-bg-success' : 'text-bg-secondary'}`}>{a.status}</span></td>
                  <td className="small text-muted">{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : '—'}</td>
                  <td className="small text-muted">{a.createdBy?.name || '—'}</td>
                  <td className="text-end">
                    <button type="button" className="btn btn-sm btn-link" onClick={() => openEdit(a)}>Edit</button>
                    <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => remove(a)}>Delete</button>
                  </td>
                </tr>
                )}
              />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
