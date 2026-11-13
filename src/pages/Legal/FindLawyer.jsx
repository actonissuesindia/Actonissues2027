import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopNav from '../../components/layout/TopNav';
import Footer from '../../components/layout/Footer';
import api from '../../services/api';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';

// Public, unauthenticated — the whole point is to be browsable without a
// login wall; the "Request Help" action itself lands on /rti/new, which
// is login-gated, same split as browsing /articles vs. commenting.
export default function FindLawyer() {
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/lawyers').then(res => setLawyers(res.data.lawyers)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <><TopNav /><div className="container-fluid px-4 py-4">Loading…</div></>;

  return (
    <>
    <TopNav />
    <div className="container-fluid px-4 py-4">
      <h3 className="fw-bold mb-1">Find a Lawyer</h3>
      <p className="text-muted small mb-4">
        Browse lawyers available on Act On Issues and request help directly. Fees, if any, are set by the lawyer
        once they review your request — payment happens directly between you and the lawyer.
      </p>

      {lawyers.length === 0 ? (
        <EmptyState icon="bi-briefcase" title="No lawyers listed yet" subtitle="Check back soon." />
      ) : (
        <div className="row g-3">
          {lawyers.map(l => (
            <div className="col-md-6 col-lg-4" key={l._id}>
              <div className="card p-3 h-100 d-flex flex-column">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Avatar name={l.name} src={l.avatar} size="md" />
                  <div className="fw-semibold">{l.name}</div>
                </div>
                {l.lawyerProfile?.bio && <p className="small text-muted mb-2">{l.lawyerProfile.bio}</p>}
                {l.lawyerProfile?.specializations?.length > 0 && (
                  <div className="d-flex flex-wrap gap-1 mb-2">
                    {l.lawyerProfile.specializations.map(s => (
                      <span key={s} className="chip py-1 px-2" style={{ fontSize: '0.72rem' }}>{s}</span>
                    ))}
                  </div>
                )}
                {(l.lawyerProfile?.contactPhone || l.lawyerProfile?.contactEmail) && (
                  <div className="small text-muted mb-2">
                    {l.lawyerProfile.contactPhone && <div><i className="bi bi-telephone me-1"></i>{l.lawyerProfile.contactPhone}</div>}
                    {l.lawyerProfile.contactEmail && <div><i className="bi bi-envelope me-1"></i>{l.lawyerProfile.contactEmail}</div>}
                  </div>
                )}
                <Link to={`/rti/new?lawyer=${l._id}`} className="btn btn-gradient mt-auto">
                  Request Help From {l.name.split(' ')[0]}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    <Footer />
    </>
  );
}
