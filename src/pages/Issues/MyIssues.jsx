import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import IssueCard from '../../components/feed/IssueCard';
import SkeletonCard from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';

export default function MyIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/issues', { params: { mine: true } })
      .then(res => setIssues(res.data.issues))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">My Issues</h3>
        <Link to="/feed" className="btn btn-gradient"><i className="bi bi-plus-lg me-1"></i>Raise an Issue</Link>
      </div>
      {loading ? (
        <div className="row g-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="col-md-6 col-lg-4" key={i}><SkeletonCard /></div>
          ))}
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          icon="bi-inbox"
          title="You haven't reported any issues yet"
          subtitle="Spotted something that needs fixing? Raise it and track it here."
          action={<Link to="/feed" className="btn btn-gradient"><i className="bi bi-plus-lg me-1"></i>Raise your first issue</Link>}
        />
      ) : (
        <div className="row g-3">
          {issues.map(issue => (
            <div className="col-md-6 col-lg-4" key={issue._id}><IssueCard issue={issue} /></div>
          ))}
        </div>
      )}
    </div>
  );
}
