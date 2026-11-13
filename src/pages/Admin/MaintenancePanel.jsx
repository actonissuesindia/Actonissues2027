import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

// One-off data fixes, without a terminal.
//
// These jobs all existed as command-line scripts, and in practice that meant
// they did not get run — each needs the right folder, the right shell syntax
// and a production connection string, and every step is a place to give up.
// Four of them sat undone for days while the code depending on them was live.
//
// The shape of the screen is the safeguard: nothing runs until its preview has
// been fetched and read. "Check first" is the only button available on an
// untouched job, and the button that actually does the work does not appear
// until there is something to show.
export default function MaintenancePanel() {
  const toast = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previews, setPreviews] = useState({});
  const [busy, setBusy] = useState(null);
  const [confirmText, setConfirmText] = useState({});

  useEffect(() => {
    api.get('/admin/maintenance')
      .then(res => setJobs(res.data.jobs))
      .catch(() => toast('Could not load the maintenance jobs.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const check = async (job) => {
    setBusy(job.id);
    try {
      const res = await api.get(`/admin/maintenance/${job.id}/preview`);
      setPreviews(p => ({ ...p, [job.id]: res.data.report }));
    } catch (err) {
      toast(err.response?.data?.message || 'Could not check that job.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const run = async (job) => {
    setBusy(job.id);
    try {
      const res = await api.post(`/admin/maintenance/${job.id}/run`,
        job.danger ? { confirm: confirmText[job.id] } : {});
      toast(res.data.report.summary);
      // Re-check afterwards, so the screen shows the state it left behind
      // rather than the state it found.
      const fresh = await api.get(`/admin/maintenance/${job.id}/preview`);
      setPreviews(p => ({ ...p, [job.id]: fresh.data.report }));
      setConfirmText(c => ({ ...c, [job.id]: '' }));
    } catch (err) {
      toast(err.response?.data?.message || 'That job could not be completed.', 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-muted small mb-0">Loading…</p>;

  return (
    <div className="card p-3">
      <h6 className="fw-semibold mb-1">
        <i className="bi bi-tools me-2 text-primary"></i>Maintenance
      </h6>
      <p className="text-muted small mb-3">
        One-off fixes to stored data. Each one shows you what it would change before it changes
        anything — press <strong>Check first</strong>, read it, then decide. Nothing here runs on
        its own.
      </p>

      <div className="d-flex flex-column gap-3">
        {jobs.map(job => {
          const report = previews[job.id];
          const nothingToDo = report && (report.rows || []).length === 0;
          return (
            <div className="border rounded-3 p-3" key={job.id}>
              <div className="d-flex flex-wrap align-items-start gap-2">
                <div className="flex-grow-1" style={{ minWidth: 240 }}>
                  <div className="fw-semibold">
                    {job.name}
                    {job.danger && <span className="badge text-bg-danger ms-2">deletes data</span>}
                  </div>
                  <p className="small text-muted mb-0">{job.why}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-pill-outline flex-shrink-0"
                  disabled={busy === job.id}
                  onClick={() => check(job)}
                >
                  {busy === job.id ? 'Checking…' : report ? 'Check again' : 'Check first'}
                </button>
              </div>

              {report && (
                <div className="mt-3 border-top pt-3">
                  <p className={`small fw-semibold mb-2 ${nothingToDo ? 'text-success' : ''}`}>
                    {report.summary}
                  </p>

                  {(report.rows || []).length > 0 && (
                    <div className="table-responsive mb-3">
                      <table className="table table-sm mb-0">
                        <tbody>
                          {report.rows.map((row, i) => (
                            <tr key={i}>
                              <td className="small">{row.who || row.label || row.field || row.key || row.menu}</td>
                              <td className="small text-muted">
                                {row.from && <span>{row.from}</span>}
                                {row.to && <span> → <strong>{row.to}</strong></span>}
                                {row.href && <span className="ms-1">{row.href}</span>}
                              </td>
                              <td className="small">
                                {row.blocked
                                  ? <span className="text-danger">{row.blocked}</span>
                                  : <span className="text-success">ready</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!nothingToDo && (
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      {job.danger && (
                        <>
                          <label className="small mb-0" htmlFor={`confirm-${job.id}`}>
                            Type <code>{job.id}</code> to confirm:
                          </label>
                          <input
                            id={`confirm-${job.id}`}
                            className="form-control form-control-sm"
                            style={{ maxWidth: 200 }}
                            value={confirmText[job.id] || ''}
                            onChange={e => setConfirmText(c => ({ ...c, [job.id]: e.target.value }))}
                          />
                        </>
                      )}
                      <button
                        type="button"
                        className={`btn btn-sm ${job.danger ? 'btn-danger' : 'btn-gradient'}`}
                        disabled={busy === job.id || (job.danger && confirmText[job.id] !== job.id)}
                        onClick={() => run(job)}
                      >
                        {busy === job.id ? 'Working…' : 'Make these changes'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-muted mt-3 mb-0" style={{ fontSize: '0.75rem' }}>
        Every run is recorded in the audit log with your name. The same jobs are still available as
        scripts in <code>scripts/</code> for anyone who prefers a terminal — they share this code,
        so both do exactly the same thing.
      </p>
    </div>
  );
}
