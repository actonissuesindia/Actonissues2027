import { Link } from 'react-router-dom';
import { RTIStatusBadge } from '../common/StatusBadge';
import timeAgo from '../../utils/timeAgo';

export default function RTICard({ request }) {
  return (
    <Link to={`/rti/${request._id}`} className="card issue-card p-3 h-100 text-decoration-none text-dark">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <span className="text-muted small">{request.requestNumber}</span>
        <RTIStatusBadge status={request.status} />
      </div>
      <div className="fw-semibold mb-1">{request.subject}</div>
      <div className="text-muted small mb-2">
        <span className="badge text-bg-light border me-1">{request.requestType || 'RTI'}</span>
        {request.requestType === 'RTI' && request.publicAuthority
          ? request.publicAuthority
          : request.lawyer?.name && `with ${request.lawyer.name}`}
      </div>
      {request.quotedFee != null && (
        <div className="small mb-2">
          <i className="bi bi-currency-rupee"></i> Quoted fee: ₹{request.quotedFee}
        </div>
      )}
      <div className="text-muted small mt-auto">{timeAgo(request.createdAt)}</div>
    </Link>
  );
}
