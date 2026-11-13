import { useEffect, useState } from 'react';
import api from '../../services/api';
import RichTextEditor from './RichTextEditor';

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

// Guesses which saved Department Directory contact covers this issue, from
// its location fields against the contact's own state/district/mandal —
// a Village/Mandal-level match on mandal outranks a District-level match on
// district, which outranks a state-only match. Prefers an exact match but
// falls back to substring containment either way (e.g. the issue's district
// came from Geoapify as "Nellore" while a contact was entered as "Sri Potti
// Sriramulu Nellore" — same place, different spelling of the official
// name). Not a real administrative-boundary lookup, so this is only ever
// offered as a pre-filled suggestion staff can change, never applied silently.
function matchDepartment(issue, departments) {
  const loc = issue?.location;
  if (!loc) return null;
  const norm = (s) => (s || '').toLowerCase().trim();
  const same = (a, b) => !!a && !!b && (a === b || a.includes(b) || b.includes(a));
  const mandal = norm(loc.mandal) || norm(loc.city);
  const district = norm(loc.district);
  const state = norm(loc.state);

  let best = null;
  let bestScore = -1;
  for (const dept of departments) {
    let score = -1;
    if ((dept.level === 'Village' || dept.level === 'Mandal') && same(mandal, norm(dept.mandal))) score = 3;
    else if (dept.level === 'District' && same(district, norm(dept.district))) score = 2;
    else if (same(district, norm(dept.district))) score = 1.5;
    else if (same(state, norm(dept.state))) score = 1;
    if (score > bestScore) { bestScore = score; best = dept; }
  }
  return best;
}

// Staff-only "Escalate to Authority" compose modal — emails a concerned
// authority the issue's full details (including its photos plus any extra
// ones attached here) plus a personal note (see
// controllers/escalationController.js / services/emailTemplate.js's
// buildIssueEscalationMessage), and sets a per-escalation reply address so
// any response the authority sends back is captured automatically (see
// docs/DEPLOYMENT.md Step 17) instead of going to a personal inbox. The eye
// button renders the exact same template server-side before anything sends.
export default function EscalateIssueModal({ issue, show, onClose, onSent }) {
  const [authorityName, setAuthorityName] = useState('');
  const [authorityEmail, setAuthorityEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [suggestedDept, setSuggestedDept] = useState(null);

  useEffect(() => {
    if (show && issue) {
      setAuthorityName('');
      setAuthorityEmail('');
      setCcEmails('');
      setSubject(`Escalation: "${issue.title}" (${issue.issueNumber})`);
      setMessage('');
      setImages([]);
      setError('');
      setResult(null);
      setPreviewHtml(null);
      setSelectedDeptId('');
      setSuggestedDept(null);
      api.get('/admin/departments').then(res => {
        const list = res.data.contacts || [];
        setDepartments(list);
        const match = matchDepartment(issue, list);
        if (match) {
          setSuggestedDept(match);
          setSelectedDeptId(match._id);
          setAuthorityName(match.name);
          setAuthorityEmail(match.email);
        }
      }).catch(() => setDepartments([]));
    }
  }, [show, issue]);

  if (!show || !issue) return null;

  const pickDepartment = (id) => {
    setSelectedDeptId(id);
    const c = departments.find(d => d._id === id);
    if (!c) return;
    setAuthorityName(c.name);
    setAuthorityEmail(c.email);
  };

  const addImages = (list) => {
    const incoming = Array.from(list || []);
    const ok = incoming.filter(f =>
      ALLOWED_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext)) && f.size <= MAX_IMAGE_BYTES
    );
    const room = Math.max(0, MAX_IMAGES - images.length);
    setImages(prev => [...prev, ...ok.slice(0, room)]);
  };

  const openPreview = async () => {
    setPreviewBusy(true);
    setError('');
    try {
      const res = await api.post(`/issues/${issue._id}/escalate/preview`, { subject: subject.trim(), message });
      setPreviewHtml(res.data.html);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load preview');
    } finally {
      setPreviewBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!authorityEmail.trim() || !subject.trim()) {
      setError('Authority email and subject are required.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('authorityName', authorityName.trim());
      fd.append('authorityEmail', authorityEmail.trim());
      fd.append('ccEmails', ccEmails.trim());
      fd.append('subject', subject.trim());
      fd.append('message', message);
      images.forEach(f => fd.append('images', f));
      await api.post(`/issues/${issue._id}/escalate`, fd);
      setResult('Escalation email sent.');
      onSent && onSent();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send escalation email');
    } finally {
      setBusy(false);
    }
  };

  if (previewHtml !== null) {
    return (
      <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.45)' }} onMouseDown={(e) => e.target === e.currentTarget && setPreviewHtml(null)}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header border-0 pb-0">
              <h5 className="fw-bold mb-0"><i className="bi bi-eye me-2"></i>Preview — what the authority will see</h5>
              <button type="button" className="btn-close" onClick={() => setPreviewHtml(null)}></button>
            </div>
            <div className="modal-body">
              <iframe title="Escalation email preview" srcDoc={previewHtml} style={{ width: '100%', height: '60vh', border: '1px solid #E2E8F0', borderRadius: '10px' }} />
              {images.length > 0 && (
                <div className="form-text mt-2">
                  + {images.length} newly attached photo{images.length === 1 ? '' : 's'} will also be included when actually sent (not shown here until upload completes).
                </div>
              )}
            </div>
            <div className="modal-footer border-0 pt-0">
              <button type="button" className="btn btn-pill-outline" onClick={() => setPreviewHtml(null)}>Back to Compose</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.45)' }} onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header border-0 pb-0">
            <h5 className="fw-bold mb-0">Escalate to Authority</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={busy}></button>
          </div>
          <form onSubmit={submit}>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}
              {result ? (
                <div className="alert alert-success py-2 mb-0">{result}</div>
              ) : (
                <>
                  {departments.length > 0 && (
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Pick a saved contact (optional)</label>
                      <select className="form-select" value={selectedDeptId} onChange={e => pickDepartment(e.target.value)}>
                        <option value="">— Choose from the Department Directory —</option>
                        {departments.map(d => (
                          <option key={d._id} value={d._id}>{d.name} — {[d.mandal, d.district, d.state].filter(Boolean).join(', ')} ({d.email})</option>
                        ))}
                      </select>
                      {suggestedDept?._id === selectedDeptId && selectedDeptId && (
                        <div className="form-text text-primary">
                          <i className="bi bi-magic me-1"></i>Suggested from this issue's location — change above if it's not right.
                        </div>
                      )}
                      <div className="form-text">Fills in the fields below — you can still edit them, or type a different address manually.</div>
                    </div>
                  )}
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Authority Name (optional)</label>
                      <input className="form-control" value={authorityName} onChange={e => setAuthorityName(e.target.value)} placeholder="e.g. Municipal Commissioner's Office" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Authority Email</label>
                      <input type="email" className="form-control" value={authorityEmail} onChange={e => setAuthorityEmail(e.target.value)} required autoFocus placeholder="office@authority.gov.in" />
                    </div>
                  </div>
                  <label className="form-label small fw-semibold">CC (optional, comma-separated)</label>
                  <input className="form-control mb-3" value={ccEmails} onChange={e => setCcEmails(e.target.value)} placeholder="second.office@authority.gov.in, ward.office@authority.gov.in" />
                  <div className="d-flex justify-content-between align-items-end mb-1">
                    <label className="form-label small fw-semibold mb-0">Subject</label>
                    <button type="button" className="btn btn-sm btn-link p-0" onClick={openPreview} disabled={previewBusy || !subject.trim()}>
                      <i className="bi bi-eye me-1"></i>{previewBusy ? 'Loading preview…' : 'Preview email'}
                    </button>
                  </div>
                  <input className="form-control mb-3" value={subject} onChange={e => setSubject(e.target.value)} maxLength={150} required />
                  <label className="form-label small fw-semibold">Note (optional)</label>
                  <RichTextEditor value={message} onChange={setMessage} placeholder="Add any context for the authority…" />

                  <label className="form-label small fw-semibold mt-3">Additional Photos (optional, up to {MAX_IMAGES})</label>
                  <input type="file" className="form-control" accept=".jpg,.jpeg,.png" multiple
                    onChange={e => { addImages(e.target.files); e.target.value = ''; }} />
                  {images.length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {images.map((f, i) => (
                        <span key={i} className="badge text-bg-light border d-inline-flex align-items-center gap-1">
                          {f.name}
                          <button type="button" className="btn-close btn-close-sm" style={{ fontSize: '0.6rem' }}
                            onClick={() => setImages(images.filter((_, idx) => idx !== i))}></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="form-text">The issue's own report photos are always included automatically. A reply from the authority or any CC'd address will appear below on this page.</div>
                </>
              )}
            </div>
            <div className="modal-footer border-0 pt-0">
              <button type="button" className="btn btn-pill-outline" onClick={onClose} disabled={busy}>
                {result ? 'Close' : 'Cancel'}
              </button>
              {!result && (
                <button type="submit" className="btn btn-gradient" disabled={busy}>
                  {busy ? 'Sending…' : 'Send Escalation'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
