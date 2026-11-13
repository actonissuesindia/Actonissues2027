import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import RTICard from '../../components/rti/RTICard';
import SkeletonCard from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';

export default function MyRTIRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/rti-requests', { params: { mine: true } })
      .then(res => setRequests(res.data.requests))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">My Legal Advice</h3>
        <Link to="/rti/new" className="btn btn-gradient"><i className="bi bi-plus-lg me-1"></i>New Legal Advice Request</Link>
      </div>
      {loading ? (
        <div className="row g-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="col-md-6 col-lg-4" key={i}><SkeletonCard /></div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon="bi-file-earmark-text"
          title="You haven't requested any legal advice yet"
          subtitle="Need an RTI filed, a lawyer for a case, or other legal help? Get started below."
          action={<Link to="/rti/new" className="btn btn-gradient"><i className="bi bi-plus-lg me-1"></i>File your first request</Link>}
        />
      ) : (
        <div className="row g-3">
          {requests.map(request => (
            <div className="col-md-6 col-lg-4" key={request._id}><RTICard request={request} /></div>
          ))}
        </div>
      )}
    </div>
  );
}
