import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { RTIStatusBadge } from '../../components/common/StatusBadge';

// A separate, lightweight surface for the Lawyer role — deliberately not
// part of AdminDashboard.jsx, which has moderation/users/articles/settings
// a Lawyer has no reason to see. Hits the exact same /api/rti-requests
// endpoints as the AdminDashboard "RTI Requests" tab (src/pages/Admin/
// RTIRequestsPanel.jsx) — only the frontend surface differs.
export default function LawyerDashboard() {
  const toast = useToast();
  const [mine, setMine] = useState([]);
  const [pool, setPool] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [feeInputs, setFeeInputs] = useState({});
  const [freeInputs, setFreeInputs] = useState({});
  const [noteInputs, setNoteInputs] = useState({});
  const [notesOpenFor, setNotesOpenFor] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/rti-requests', { params: { lawyer: 'me' } }),
      api.get('/rti-requests', { params: { unassigned: true } })
    ]).then(([mineRes, poolRes]) => {
      setMine(mineRes.data.requests);
      setPool(poolRes.data.requests);
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

  const claim = (id) => act(id, () => api.post(`/rti-requests/${id}/claim`));
  const quote = (id) => {
    const isFree = !!freeInputs[id];
    const fee = feeInputs[id];
    if (!isFree && (fee === undefined || fee === '')) { toast('Enter a fee, or mark it free', 'error'); return; }
    act(id, () => api.post(`/rti-requests/${id}/quote`, { isFree, quotedFee: isFree ? 0 : Number(fee) }));
  };
  const decline = (id) => act(id, () => api.post(`/rti-requests/${id}/decline`));
  const markFiled = (id) => act(id, () => api.post(`/rti-requests/${id}/file`));
  const resolve = (id) => act(id, () => api.post(`/rti-requests/${id}/resolve`, { responseSummary: 'Resolved.' }));
  const addNote = (id) => {
    const note = noteInputs[id];
    if (!note || !note.trim()) { toast('Write a note first', 'error'); return; }
    act(id, async () => {
      await api.post(`/rti-requests/${id}/notes`, { note });
      setNoteInputs(f => ({ ...f, [id]: '' }));
    });
  };

  if (loading) return <div className="container-fluid px-4 py-4">Loading…</div>;

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">Lawyer Dashboard</h3>
        <Link to="/lawyer/profile" className="btn btn-outline-secondary btn-sm">My Profile</Link>
      </div>

      <h5 className="fw-semibold mb-2">My Assigned Requests</h5>
      {mine.length === 0 ? (
        <div className="text-muted small mb-4">No requests assigned to you yet.</div>
      ) : (
        <div className="table-responsive mb-4">
          <table className="table align-middle">
            <thead>
              <tr><th>Request</th><th>Citizen</th><th>Status</th><th>Fee</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {mine.map(r => (
                <Fragment key={r._id}>
                  <tr>
                    <td>
                      <div className="small text-muted">{r.requestNumber} · {r.requestType}</div>
                      <div className="fw-semibold small">{r.subject}</div>
                    </td>
                    <td className="small">{r.citizen?.name}</td>
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
                            <input className="form-check-input" type="checkbox" id={`free-${r._id}`} checked={!!freeInputs[r._id]}
                              onChange={e => setFreeInputs(f => ({ ...f, [r._id]: e.target.checked }))} />
                            <label className="form-check-label small" htmlFor={`free-${r._id}`}>Free</label>
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
                      <td colSpan={5}>
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
      )}

      <h5 className="fw-semibold mb-2">Unclaimed Pool</h5>
      {pool.length === 0 ? (
        <div className="text-muted small">Nothing waiting to be claimed right now.</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr><th>Request</th><th>Type</th><th>Authority</th><th>Action</th></tr>
            </thead>
            <tbody>
              {pool.map(r => (
                <tr key={r._id}>
                  <td><div className="small text-muted">{r.requestNumber}</div><div className="fw-semibold small">{r.subject}</div></td>
                  <td className="small">{r.requestType}</td>
                  <td className="small">{r.publicAuthority || '—'}</td>
                  <td><button className="btn btn-sm btn-gradient" disabled={busyId === r._id} onClick={() => claim(r._id)}>Claim</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
