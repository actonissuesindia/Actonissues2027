import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { RegionEditor } from './PageBuilderPanel';
import GroupedTableRows, { GroupBySelect } from '../../components/admin/GroupedTableRows';

const EMPTY_FORM = { title: '', slug: '', status: 'Draft', seoTitle: '', seoDescription: '' };

// Lets Super Admin publish a brand-new standalone page (its own URL, e.g.
// /p/volunteer-guidelines) without a developer writing a .jsx file for it —
// the metadata (title/slug/status/SEO) lives here (models/CustomPage.js);
// the actual page content reuses the exact same block editor as About/
// Founder's Message (RegionEditor, imported from PageBuilderPanel.jsx),
// scoped to this page's own region key (`custom-<CustomPage _id>`).
export default function CustomPagesPanel() {
  const toast = useToast();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null = list, 'new' = create, else page._id
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [inNav, setInNav] = useState(false);
  const [navBusy, setNavBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/admin/pages').then(res => setPages(res.data.pages)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY_FORM); setError(''); setInNav(false); setEditingId('new'); };
  const openEdit = (p) => {
    setForm({ title: p.title, slug: p.slug, status: p.status, seoTitle: p.seoTitle || '', seoDescription: p.seoDescription || '' });
    setError('');
    setInNav(!!p.navLinkBlockId?.visible);
    setEditingId(p._id);
  };
  const cancel = () => setEditingId(null);

  const toggleNav = async () => {
    setNavBusy(true);
    try {
      const res = await api.patch(`/admin/pages/${editingId}/toggle-nav`);
      setInNav(res.data.inNav);
      toast(res.data.inNav ? 'Added to the top navigation' : 'Removed from the top navigation');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to update navigation', 'danger');
    } finally {
      setNavBusy(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setError('');
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      status: form.status,
      seoTitle: form.seoTitle.trim(),
      seoDescription: form.seoDescription.trim(),
      slug: form.slug.trim() || undefined
    };
    try {
      if (editingId === 'new') {
        const res = await api.post('/admin/pages', payload);
        toast('Page created — now add some content below');
        setEditingId(res.data.page._id);
        setForm(f => ({ ...f, slug: res.data.page.slug }));
        load();
      } else {
        const res = await api.patch(`/admin/pages/${editingId}`, payload);
        toast('Page updated');
        setForm(f => ({ ...f, slug: res.data.page.slug }));
        load();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save page');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"? This can't be undone and removes all of its content.`)) return;
    await api.delete(`/admin/pages/${p._id}`);
    toast('Page deleted');
    load();
  };

  if (editingId) {
    return (
      <div className="card p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="fw-bold mb-0">{editingId === 'new' ? 'New Page' : 'Edit Page'}</h5>
          <button type="button" className="btn btn-sm btn-pill-outline" onClick={cancel} disabled={busy}>Back to List</button>
        </div>
        <form onSubmit={save}>
          {error && <div className="alert alert-danger py-2">{error}</div>}

          <label className="form-label small fw-semibold">Title</label>
          <input className="form-control mb-3" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required autoFocus />

          <label className="form-label small fw-semibold">Slug (optional — auto-generated from title if left blank)</label>
          <div className="input-group mb-3">
            <span className="input-group-text">/p/</span>
            <input className="form-control" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="e.g. volunteer-guidelines" />
          </div>

          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold">SEO Title Override (optional)</label>
              <input className="form-control" maxLength={100} value={form.seoTitle} onChange={e => setForm({ ...form, seoTitle: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">SEO Description Override (optional)</label>
              <input className="form-control" maxLength={200} value={form.seoDescription} onChange={e => setForm({ ...form, seoDescription: e.target.value })} />
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <label className="form-label small fw-semibold mb-0">Status:</label>
            <select className="form-select form-select-sm" style={{ width: 'auto' }} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="Draft">Draft</option>
              <option value="Published">Published</option>
            </select>
            {editingId !== 'new' && form.status === 'Published' && (
              <a href={`/p/${form.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary">
                <i className="bi bi-box-arrow-up-right me-1"></i>View live
              </a>
            )}
            <button type="submit" className="btn btn-gradient ms-auto" disabled={busy}>
              {busy ? 'Saving…' : editingId === 'new' ? 'Create Page' : 'Save Changes'}
            </button>
          </div>
        </form>

        {editingId !== 'new' && (
          <div className="mt-3 pt-3 border-top d-flex align-items-center gap-2">
            <div className="form-check form-switch mb-0">
              <input
                className="form-check-input" type="checkbox" role="switch" id="page-in-nav"
                checked={inNav} disabled={navBusy || form.status !== 'Published'}
                onChange={toggleNav}
              />
              <label className="form-check-label small fw-semibold" htmlFor="page-in-nav">Show in top navigation</label>
            </div>
            <span className="text-muted small">
              {form.status !== 'Published'
                ? '— publish the page first'
                : inNav ? `— appears as "${form.title}" in the nav bar` : '— add a clickable link to this page in the top nav'}
            </span>
          </div>
        )}

        {editingId !== 'new' && (
          <div className="mt-4 pt-3 border-top">
            <h6 className="fw-semibold mb-2">Content</h6>
            <RegionEditor page={`custom-${editingId}`} label="Page blocks" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="fw-bold mb-0">Pages</h5>
        <div className="d-flex align-items-center gap-3 ms-auto">
          <GroupBySelect value={groupBy} onChange={setGroupBy} options={[{ value: 'status', label: 'Status' }]} />
          <button type="button" className="btn btn-sm btn-gradient" onClick={openNew}>
            <i className="bi bi-plus-lg me-1"></i>New Page
          </button>
        </div>
      </div>
      {loading ? <p className="text-muted small">Loading…</p> : pages.length === 0 ? (
        <p className="text-muted small">No custom pages yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Title</th><th>Status</th><th>Nav</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              <GroupedTableRows
                rows={pages}
                groupBy={groupBy}
                groupKeyFn={p => p.status}
                colSpan={5}
                renderRow={p => (
                <tr key={p._id}>
                  <td>{p.title}<div className="text-muted small">/p/{p.slug}</div></td>
                  <td><span className={`badge ${p.status === 'Published' ? 'text-bg-success' : 'text-bg-secondary'}`}>{p.status}</span></td>
                  <td>{p.navLinkBlockId?.visible && <span className="badge text-bg-info-subtle text-info-emphasis">In nav</span>}</td>
                  <td className="small text-muted">{new Date(p.updatedAt).toLocaleDateString()}</td>
                  <td className="text-end">
                    <button type="button" className="btn btn-sm btn-link" onClick={() => openEdit(p)}>Edit</button>
                    <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => remove(p)}>Delete</button>
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
