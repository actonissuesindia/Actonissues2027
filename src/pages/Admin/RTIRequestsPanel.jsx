import { Fragment, useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { RTIStatusBadge } from '../../components/common/StatusBadge';

// Admin/Authority surface for RTI requests — same /api/rti-requests
// endpoints the dedicated Lawyer dashboard uses (src/pages/Lawyer/
// LawyerDashboard.jsx), just a different frontend view: staff can see and
// act on every request, not only ones assigned to them. The "Lawyer
// Profile" tab (AdminDashboard.jsx) is where an Admin opts into acting as
// a lawyer too — not linked from here to avoid two paths to the same place.
export default function RTIRequestsPanel() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [feeInputs, setFeeInputs] = useState({});
  const [freeInputs, setFreeInputs] = useState({});
  const [noteInputs, setNoteInputs] = useState({});
  const [notesOpenFor, setNotesOpenFor] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/rti-requests'),
      api.get('/admin/users')
    ]).then(([reqRes, usersRes]) => {
      setRequests(reqRes.data.requests);
      // Same eligibility as the public directory — a dedicated Lawyer
      // account (listed unless explicitly paused), or an Admin who's
      // opted into acting as one too (see src/pages/Lawyer/LawyerProfile.jsx).
      setLawyers((usersRes.data.users || []).filter(u => (
        (u.role === 'Lawyer' && u.lawyerProfile?.isListed !== false) ||
        (u.role === 'Admin' && u.lawyerProfile?.isListed === true)
      )));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const act = async (id, fn) => {
    setBusyId(id);
    try {
      await fn();
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Something went wrong', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const assignLawyer = (id, lawyerId) => act(id, () => api.patch(`/rti-requests/${id}/assign`, { lawyer: lawyerId || null }));
  const quote = (id) => {
    const isFree = !!freeInputs[id];
    const fee = feeInputs[id];
    if (!isFree && (fee === undefined || fee === '')) { toast('Enter a fee, or mark it free', 'error'); return; }
    act(id, () => api.post(`/rti-requests/${id}/quote`, { isFree, quotedFee: isFree ? 0 : Number(fee) }));
  };
  const decline = (id) => act(id, () => api.post(`/rti-requests/${id}/decline`));
  const markFiled = (id) => act(id, () => api.post(`/rti-requests/${id}/file`));
  const resolve = (id) => act(id, () => api.post(`/rti-requests/${id}/resolve`, { responseSummary: 'Resolved by staff.' }));
  const addNote = (id) => {
    const note = noteInputs[id];
    if (!note || !note.trim()) { toast('Write a note first', 'error'); return; }
    act(id, async () => {
      await api.post(`/rti-requests/${id}/notes`, { note });
      setNoteInputs(f => ({ ...f, [id]: '' }));
    });
  };

  if (loading) return <div className="text-muted small">Loading…</div>;

  return (
    <div className="table-responsive">
      <table className="table align-middle">
        <thead>
          <tr>
            <th>Request</th>
            <th>Citizen</th>
            <th>Lawyer</th>
            <th>Status</th>
            <th>Fee</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 && (
            <tr><td colSpan={6} className="text-muted small">No legal assistance requests yet.</td></tr>
          )}
          {requests.map(r => (
            <Fragment key={r._id}>
              <tr>
                <td>
                  <div className="small text-muted">{r.requestNumber} · {r.requestType}</div>
                  <div className="fw-semibold small">{r.subject}</div>
                </td>
                <td className="small">{r.citizen?.name}</td>
                <td>
                  <select className="form-select form-select-sm" style={{ minWidth: 140 }}
                    value={r.lawyer?._id || ''} disabled={busyId === r._id}
                    onChange={e => assignLawyer(r._id, e.target.value)}>
                    <option value="">Unassigned</option>
                    {lawyers.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                  </select>
                </td>
                <td><RTIStatusBadge status={r.status} /></td>
                <td>
                  {r.status === 'Submitted' ? (
                    <div className="d-flex flex-column gap-1">
                      <div className="d-flex gap-1">
                        <input type="number" className="form-control form-control-sm" style={{ width: 80 }}
                          placeholder="₹" disabled={!!freeInputs[r._id]} value={feeInputs[r._id] ?? ''}
                          onChange={e => setFeeInputs(f => ({ ...f, [r._id]: e.target.value }))} />
                        <button className="btn btn-sm btn-outline-primary" disabled={busyId === r._id} onClick={() => quote(r._id)}>Quote</button>
                      </div>
                      <div className="form-check">
                        <input className="form-check-input" type="checkbox" id={`admin-free-${r._id}`} checked={!!freeInputs[r._id]}
                          onChange={e => setFreeInputs(f => ({ ...f, [r._id]: e.target.checked }))} />
                        <label className="form-check-label small" htmlFor={`admin-free-${r._id}`}>Free</label>
                      </div>
                    </div>
                  ) : r.isFree ? 'Free' : r.quotedFee != null ? `₹${r.quotedFee}` : '—'}
                </td>
                <td>
                  <div className="d-flex gap-1 flex-wrap">
                    {r.status === 'Submitted' && (
                      <button className="btn btn-sm btn-outline-danger" disabled={busyId === r._id} onClick={() => decline(r._id)}>Decline</button>
                    )}
                    {r.status === 'Accepted' && (
                      <button className="btn btn-sm btn-outline-secondary" disabled={busyId === r._id} onClick={() => markFiled(r._id)}>Mark Filed</button>
                    )}
                    {r.status === 'Filed' && (
                      <button className="btn btn-sm btn-outline-success" disabled={busyId === r._id} onClick={() => resolve(r._id)}>Resolve</button>
                    )}
                    {!['Rejected', 'Cancelled'].includes(r.status) && (
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setNotesOpenFor(notesOpenFor === r._id ? null : r._id)}>
                        Notes
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {notesOpenFor === r._id && (
                <tr>
                  <td colSpan={6}>
                    <div className="d-flex flex-column gap-2 mb-2">
                      {(r.workNotes || []).map((n, i) => (
                        <div key={n._id || i} className="small border-start ps-2">{n.note}</div>
                      ))}
                    </div>
                    <div className="d-flex gap-2">
                      <input className="form-control form-control-sm" placeholder="Add a work note for the citizen…"
                        value={noteInputs[r._id] || ''} onChange={e => setNoteInputs(f => ({ ...f, [r._id]: e.target.value }))} />
                      <button className="btn btn-sm btn-outline-primary" disabled={busyId === r._id} onClick={() => addNote(r._id)}>Post</button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
