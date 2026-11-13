import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopNav from '../../components/layout/TopNav';
import Footer from '../../components/layout/Footer';
import Avatar from '../../components/common/Avatar';
import api from '../../services/api';

// Public, unauthenticated — a citizen's shareable track record. Real per-
// profile title/description/canonical come from server.js's dynamic meta
// injection for crawlers; this just renders the same data for a real
// browser. Linked from the homepage's Top Voices leaderboard (see
// src/pages/Home/Home.jsx).
export default function ReporterProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api.get(`/reporters/${id}`)
      .then(res => setProfile(res.data.profile))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <>
      <TopNav />
      <div className="container-fluid px-4 py-4">
        <div className="mx-auto" style={{ maxWidth: 640 }}>
          <Link to="/" className="d-inline-flex align-items-center gap-1 fw-semibold text-decoration-none text-dark mb-3">
            <i className="bi bi-arrow-left"></i>Back to home
          </Link>

          {loading ? (
            <p className="text-muted small">Loading…</p>
          ) : notFound || !profile ? (
            <p className="text-muted small">Profile not found.</p>
          ) : (
            <div className="card p-4 p-md-5">
              {profile.banner && (
                <img src={profile.banner} alt="" className="mb-4" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10 }} />
              )}
              <div className="d-flex align-items-center gap-3 mb-3">
                <Avatar src={profile.avatar} name={profile.name} size="xl" />
                <div>
                  <h1 className="fw-bold mb-0" style={{ fontSize: '1.5rem' }}>{profile.name}</h1>
                  <div className="text-muted small">
                    {profile.roleLabel} · Member since {new Date(profile.memberSince).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-4">
                {[
                  { label: 'Reported', value: profile.reported, icon: 'bi-collection', color: 'text-primary' },
                  { label: 'Resolved', value: profile.resolved, icon: 'bi-check-circle', color: 'text-success' },
                  { label: 'Supported', value: profile.supported, icon: 'bi-heart-fill', color: 'text-danger' }
                ].map(s => (
                  <div className="col-4" key={s.label}>
                    <div className="card stat-card p-3 h-100">
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <div className="text-muted small">{s.label}</div>
                          <div className="fs-3 fw-bold">{s.value}</div>
                        </div>
                        <i className={`bi ${s.icon} fs-2 ${s.color}`}></i>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {profile.badges?.length > 0 && (
                <div className="d-flex flex-wrap gap-2 pt-3 border-top">
                  {profile.badges.map(b => (
                    <span key={b} className="badge text-bg-light border"><i className="bi bi-award-fill me-1 text-warning"></i>{b}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
