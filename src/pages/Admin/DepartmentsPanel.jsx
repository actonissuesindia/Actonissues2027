import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const LEVELS = ['District', 'Mandal', 'Village', 'Other'];
const LEVEL_LABELS = { District: 'District (Zilla Parishad)', Mandal: 'Mandal (Mandal Panchayat)', Village: 'Village (Grama Panchayat)', Other: 'Other (Municipal Corp, Electricity Board, etc.)' };
const BLANK = { name: '', email: '', phone: '', level: 'Village', state: '', district: '', mandal: '', notes: '' };

function locationLine(c) {
  const parts = [c.mandal, c.district, c.state].filter(Boolean);
  return parts.length ? `${LEVEL_LABELS[c.level] || c.level} — ${parts.join(', ')}` : (LEVEL_LABELS[c.level] || c.level);
}

// Staff-maintained address book of department/authority contacts (e.g. a
// specific Gram Panchayat office, Municipal Corporation ward, Electricity
// Board division) — feeds the picker in EscalateIssueModal.jsx so staff
// don't have to remember or re-type an email every time they escalate an
// issue. Deliberately not pre-populated with real addresses: coverage and
// correctness vary by state/district/panchayat and change over time, so
// only local staff who actually escalate issues in that area can keep this
// list current — see the lgdirectory.gov.in link below for the official
// source to look one up before adding it here.
export default function DepartmentsPanel() {
  const toast = useToast();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null); // null | 'new' | contact._id
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importLevel, setImportLevel] = useState('Village');
  const [importState, setImportState] = useState('');
  const [importDistrict, setImportDistrict] = useState('');
  const [importMandal, setImportMandal] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState(null); // { issue, matches }

  const load = () => api.get('/admin/departments').then(res => setContacts(res.data.contacts || [])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditingId('new'); setForm(BLANK); };
  const startEdit = (c) => { setEditingId(c._id); setForm({ name: c.name, email: c.email, phone: c.phone || '', level: c.level || 'Other', state: c.state || '', district: c.district || '', mandal: c.mandal || '', notes: c.notes || '' }); };
  const cancelEdit = () => { setEditingId(null); setForm(BLANK); };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingId === 'new') {
        await api.post('/admin/departments', form);
        toast('Department contact added');
      } else {
        await api.patch(`/admin/departments/${editingId}`, form);
        toast('Department contact updated');
      }
      await load();
      cancelEdit();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save contact', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runLookup = async (e) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    setLookupBusy(true);
    setLookupError('');
    setLookupResult(null);
    try {
      const { data } = await api.get('/admin/departments/lookup', { params: { issueNumber: lookupId.trim() } });
      setLookupResult(data);
    } catch (err) {
      setLookupError(err.response?.data?.message || 'Lookup failed');
    } finally {
      setLookupBusy(false);
    }
  };

  const runImport = async (e) => {
    e.preventDefault();
    if (!importFile) return;
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('level', importLevel);
      fd.append('state', importState.trim());
      fd.append('district', importDistrict.trim());
      fd.append('mandal', importMandal.trim());
      const { data } = await api.post('/admin/departments/import', fd);
      toast(`Imported ${data.total} contact${data.total === 1 ? '' : 's'} (${data.created} new, ${data.updated} updated).`);
      await load();
      setImportOpen(false);
      setImportState(''); setImportDistrict(''); setImportMandal('');
      setImportFile(null);
    } catch (err) {
      toast(err.response?.data?.message || 'Import failed', 'error');
    } finally {
      setImportBusy(false);
    }
  };

  const remove = async (c) => {
    if (!confirm(`Remove "${c.name}" from the department directory? This won't affect any escalations already sent.`)) return;
    await api.delete(`/admin/departments/${c._id}`);
    setContacts(list => list.filter(x => x._id !== c._id));
    toast('Department contact removed', 'info');
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? contacts.filter(c => [c.name, c.state, c.district, c.mandal, c.email].some(v => (v || '').toLowerCase().includes(q)))
    : contacts;

  if (loading) return <p className="text-muted small mb-0">Loading…</p>;

  return (
    <div className="card p-3">
      <div className="d-flex align-items-center justify-content-between mb-3 gap-2 flex-wrap">
        <h6 className="fw-semibold mb-0">
          <i className="bi bi-diagram-3-fill me-2 text-primary"></i>Department Directory
        </h6>
        {editingId === null && (
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-sm btn-pill-outline" onClick={() => setImportOpen(o => !o)}>
              <i className="bi bi-file-earmark-arrow-up me-1"></i>Import from Excel
            </button>
            <button type="button" className="btn btn-sm btn-gradient" onClick={startNew}>
              <i className="bi bi-plus-lg me-1"></i>New Contact
            </button>
          </div>
        )}
      </div>
      <p className="text-muted small">
        Saved here shows up as a pick-list when escalating an issue, instead of typing an email from
        memory. For Panchayat/local-body emails, look up the current official address on{' '}
        <a href="https://lgdirectory.gov.in/" target="_blank" rel="noopener noreferrer">
          lgdirectory.gov.in
        </a>{' '}
        (Ministry of Panchayati Raj's own directory — Reports → PRI Localbody Email IDs) before adding it
        here, rather than guessing.
      </p>

      <form onSubmit={runLookup} className="mb-3 p-3 border rounded-4 bg-body-tertiary">
        <label className="form-label small fw-semibold mb-1">
          <i className="bi bi-search me-1"></i>Look up by Issue ID
        </label>
        <div className="d-flex gap-2 flex-wrap">
          <input
            className="form-control" style={{ maxWidth: 220 }}
            placeholder="e.g. AOI-000123" value={lookupId} onChange={e => setLookupId(e.target.value)}
          />
          <button type="submit" className="btn btn-pill-outline" disabled={lookupBusy || !lookupId.trim()}>
            {lookupBusy ? 'Looking up…' : 'Look Up'}
          </button>
        </div>
        <div className="form-text">
          Shows whatever's already saved for that issue's location, split by level — and if a level's
          missing, exactly what to search for on lgdirectory.gov.in.
        </div>

        {lookupError && <div className="alert alert-danger py-2 mt-2 mb-0">{lookupError}</div>}

        {lookupResult && (
          <div className="mt-3 pt-3 border-top">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
              <div>
                <Link to={`/issues/${lookupResult.issue._id}`} target="_blank" rel="noopener noreferrer" className="fw-semibold">
                  {lookupResult.issue.issueNumber} — {lookupResult.issue.title}
                </Link>
                <div className="text-muted small">
                  {[lookupResult.issue.location?.city, lookupResult.issue.location?.mandal, lookupResult.issue.location?.district, lookupResult.issue.location?.state].filter(Boolean).join(', ') || 'No location recorded on this issue'}
                </div>
              </div>
            </div>

            {['District', 'Mandal', 'Village'].map(level => {
              const found = lookupResult.matches[level] || [];
              const loc = lookupResult.issue.location || {};
              return (
                <div key={level} className="mb-2">
                  <div className="small fw-semibold">{LEVEL_LABELS[level]}</div>
                  {found.length > 0 ? (
                    found.map(c => (
                      <div key={c._id} className="small">
                        {c.name} — <a href={`mailto:${c.email}`}>{c.email}</a>
                      </div>
                    ))
                  ) : (
                    <div className="small text-muted">
                      Not saved yet. On lgdirectory.gov.in's PRI Localbody Email IDs report, look up
                      {' '}<strong>{loc.state || 'this issue\'s state'}</strong>
                      {level !== 'District' && <> → <strong>{loc.district || 'its district'}</strong></>}
                      {level !== 'District' && <> → <strong>{loc.mandal || loc.city || 'its mandal'}</strong></>}
                      {level === 'District' && <> → <strong>{loc.district || 'its district'}</strong></>},
                      then import the result above.
                    </div>
                  )}
                </div>
              );
            })}
            {(lookupResult.matches.Other || []).length > 0 && (
              <div className="mb-2">
                <div className="small fw-semibold">Other</div>
                {lookupResult.matches.Other.map(c => (
                  <div key={c._id} className="small">{c.name} — <a href={`mailto:${c.email}`}>{c.email}</a></div>
                ))}
              </div>
            )}
            <a href="https://lgdirectory.gov.in/" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-pill-outline mt-1">
              Open lgdirectory.gov.in
            </a>
          </div>
        )}
      </form>

      {importOpen && (
        <form onSubmit={runImport} className="mb-3 p-3 border rounded-4">
          <p className="small text-muted mb-2">
            On lgdirectory.gov.in, open the PRI Localbody Email IDs report for a mandal, click its
            <strong> Excel</strong> button, then upload that file here (.xlsx, .xls, or .csv). Every row's
            name and email is taken straight from the file — nothing is guessed.
          </p>
          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Level</label>
              <select className="form-select" value={importLevel} onChange={e => setImportLevel(e.target.value)}>
                {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">State</label>
              <input className="form-control" value={importState} onChange={e => setImportState(e.target.value)}
                placeholder="Andhra Pradesh" />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">District</label>
              <input className="form-control" value={importDistrict} onChange={e => setImportDistrict(e.target.value)}
                placeholder="Sri Potti Sriramulu Nellore" />
            </div>
            {(importLevel === 'Village' || importLevel === 'Mandal') && (
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Mandal</label>
                <input className="form-control" value={importMandal} onChange={e => setImportMandal(e.target.value)}
                  placeholder="Butchireddipalem" />
              </div>
            )}
            <div className="col-12">
              <label className="form-label small fw-semibold">Report file</label>
              <input type="file" className="form-control" accept=".xlsx,.xls,.csv"
                onChange={e => setImportFile(e.target.files?.[0] || null)} required />
            </div>
          </div>
          <div className="d-flex gap-2 mt-3">
            <button type="submit" className="btn btn-gradient" disabled={importBusy || !importFile}>
              {importBusy ? 'Importing…' : 'Import'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setImportOpen(false)}>Cancel</button>
          </div>
        </form>
      )}

      {editingId === 'new' && (
        <DepartmentForm form={form} setForm={setForm} onSubmit={save} onCancel={cancelEdit} busy={busy} submitLabel="Add" />
      )}

      {contacts.length > 0 && editingId === null && (
        <input
          className="form-control form-control-sm mb-3" style={{ maxWidth: 320 }}
          placeholder="Search by name, area, or email…" value={query} onChange={e => setQuery(e.target.value)}
        />
      )}

      {contacts.length === 0 && editingId !== 'new' && (
        <p className="text-muted small text-center py-4 mb-0">No department contacts saved yet.</p>
      )}
      {contacts.length > 0 && visible.length === 0 && (
        <p className="text-muted small text-center py-3 mb-0">No contacts match "{query}".</p>
      )}

      <div className="d-flex flex-column gap-2">
        {visible.map(c => (
          <div key={c._id} className="p-3 border rounded-4">
            {editingId === c._id ? (
              <DepartmentForm form={form} setForm={setForm} onSubmit={save} onCancel={cancelEdit} busy={busy} submitLabel="Save" />
            ) : (
              <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                <div>
                  <div className="fw-semibold">{c.name}</div>
                  <div className="text-muted small">{locationLine(c)}</div>
                  <div className="small">
                    <a href={`mailto:${c.email}`}>{c.email}</a>
                    {c.phone && <span className="text-muted"> · {c.phone}</span>}
                  </div>
                  {c.notes && <div className="text-muted small mt-1">{c.notes}</div>}
                  <div className="text-muted small mt-1">Added by {c.addedBy?.name || 'Staff'}</div>
                </div>
                <div className="d-flex gap-1 flex-shrink-0">
                  <button type="button" className="btn btn-sm btn-pill-outline" onClick={() => startEdit(c)}>Edit</button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(c)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DepartmentForm({ form, setForm, onSubmit, onCancel, busy, submitLabel }) {
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  return (
    <form onSubmit={onSubmit} className="mb-3 p-3 border rounded-4">
      <div className="row g-2">
        <div className="col-md-6">
          <label className="form-label small fw-semibold">Department / Office Name</label>
          <input className="form-control" value={form.name} onChange={set('name')} required autoFocus
            placeholder="e.g. Chellayapalem Grama Panchayat" />
        </div>
        <div className="col-md-6">
          <label className="form-label small fw-semibold">Level</label>
          <select className="form-select" value={form.level} onChange={set('level')}>
            {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label small fw-semibold">State</label>
          <input className="form-control" value={form.state} onChange={set('state')} placeholder="Andhra Pradesh" />
        </div>
        <div className="col-md-4">
          <label className="form-label small fw-semibold">District</label>
          <input className="form-control" value={form.district} onChange={set('district')} placeholder="Sri Potti Sriramulu Nellore" />
        </div>
        {(form.level === 'Village' || form.level === 'Mandal') && (
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Mandal</label>
            <input className="form-control" value={form.mandal} onChange={set('mandal')} placeholder="Butchireddipalem" />
          </div>
        )}
        <div className="col-md-6">
          <label className="form-label small fw-semibold">Email</label>
          <input type="email" className="form-control" value={form.email} onChange={set('email')} required
            placeholder="office@panchayat.tn.gov.in" />
        </div>
        <div className="col-md-6">
          <label className="form-label small fw-semibold">Phone (optional)</label>
          <input className="form-control" value={form.phone} onChange={set('phone')} placeholder="e.g. 044-12345678" />
        </div>
        <div className="col-12">
          <label className="form-label small fw-semibold">Notes (optional)</label>
          <input className="form-control" value={form.notes} onChange={set('notes')}
            placeholder="e.g. Handles roads and drainage complaints for wards 1–4" />
        </div>
      </div>
      <div className="d-flex gap-2 mt-3">
        <button type="submit" className="btn btn-gradient" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
