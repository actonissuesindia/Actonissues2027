import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import timeAgo from '../../utils/timeAgo';
import EscalationReply from '../../components/common/EscalationReply';

// Cross-issue view of every "Escalate to Authority" send + any reply an
// authority sent back (captured via the Brevo inbound-parsing webhook,
// controllers/webhookController.js) — the same underlying data already
// shown per-issue on IssueDetail.jsx, just not discoverable admin-wide
// without knowing which specific issue to look at.
export default function EscalationsPanel() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.get('/admin/escalations').then(res => setEscalations(res.data.escalations)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted small mb-0">Loading…</p>;

  return (
    <div className="card p-3">
      <h6 className="fw-semibold mb-3">
        <i className="bi bi-send-check me-2 text-primary"></i>Escalations & Replies
      </h6>

      {escalations.length === 0 && (
        <p className="text-muted small mb-0">No issues have been escalated to an authority yet.</p>
      )}

      {escalations.map(esc => (
        <div key={esc._id} className="border rounded-4 p-3 mb-2">
          <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
            <div>
              <div className="fw-semibold">
                {esc.issue ? (
                  <Link to={`/issues/${esc.issue._id}`}>{esc.issue.title} <span className="text-muted small">({esc.issue.issueNumber})</span></Link>
                ) : <span className="text-muted">Issue deleted</span>}
              </div>
              <div className="text-muted small">
                To {esc.authorityName ? `${esc.authorityName} — ` : ''}{esc.authorityEmail} · by {esc.sentBy?.name || 'Unknown'} · {timeAgo(esc.createdAt)}
              </div>
              <div className="small">{esc.subject}</div>
            </div>
            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              {esc.status === 'Sent'
                ? <span className="badge bg-success-subtle text-success-emphasis">Sent</span>
                : <span className="badge bg-danger-subtle text-danger-emphasis" title={esc.error || ''}>Failed</span>}
              {esc.replies?.length > 0 && (
                <span className="badge bg-primary-subtle text-primary-emphasis">{esc.replies.length} repl{esc.replies.length === 1 ? 'y' : 'ies'}</span>
              )}
              <button type="button" className="btn btn-sm btn-outline-secondary"
                onClick={() => setExpandedId(id => id === esc._id ? null : esc._id)}>
                {expandedId === esc._id ? 'Hide' : 'Details'}
              </button>
            </div>
          </div>

          {expandedId === esc._id && (
            <div className="mt-3 border-top pt-2">
              {esc.ccEmails?.length > 0 && <div className="small text-muted mb-2">CC: {esc.ccEmails.join(', ')}</div>}
              {esc.replies?.length > 0 ? (
                <div className="d-flex flex-column gap-2">
                  {esc.replies.map((r, i) => (
                    <div key={i} className="bg-body-tertiary rounded-3 p-2 small">
                      <EscalationReply reply={r} showSubject />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted small mb-0">No reply received yet.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
