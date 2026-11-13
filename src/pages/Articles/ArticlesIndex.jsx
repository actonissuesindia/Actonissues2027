import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopNav from '../../components/layout/TopNav';
import Footer from '../../components/layout/Footer';
import api from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

// Public, unauthenticated — the whole point is to be crawlable and
// linkable without a login wall (unlike /issues/:id). Real per-post
// title/description come from server.js's dynamic meta injection for
// /articles/:slug; this component just renders the list once JS loads.
export default function ArticlesIndex() {
  const { t } = useLanguage();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/articles').then(res => setArticles(res.data.articles)).finally(() => setLoading(false));
  }, []);

  // Client-side filter over the already-fetched list — plenty for a blog
  // this size; worth moving server-side only once the article count grows
  // large enough that fetching the full list up front stops being cheap.
  const q = query.trim().toLowerCase();
  const filtered = !q ? articles : articles.filter(a =>
    a.title.toLowerCase().includes(q) ||
    a.excerpt?.toLowerCase().includes(q) ||
    a.tags?.some(t => t.toLowerCase().includes(q))
  );

  return (
    <>
      <TopNav />
      <div className="container-fluid px-4 py-4">
        <div className="mx-auto" style={{ maxWidth: 960 }}>
          <h2 className="fw-bold mb-1">{t('footer.guidesResources')}</h2>
          <p className="text-muted mb-4">Practical guides on reporting civic issues, getting community support, and escalating to the right authority.</p>

          {articles.length > 0 && (
            <div className="input-group mb-4" style={{ maxWidth: 420 }}>
              <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
              <input
                type="search"
                className="form-control"
                placeholder="Search guides — e.g. water supply, escalation…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Search articles"
              />
            </div>
          )}

          {loading ? (
            <p className="text-muted small">Loading…</p>
          ) : articles.length === 0 ? (
            <p className="text-muted small">No articles published yet.</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted small">No guides match "{query}".</p>
          ) : (
            <div className="row g-3">
              {filtered.map(a => (
                <div className="col-md-6 col-lg-4" key={a.slug}>
                  <Link to={`/articles/${a.slug}`} className="card h-100 text-decoration-none text-dark p-0 overflow-hidden">
                    {a.coverImage && (
                      <img src={a.coverImage} alt="" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                    )}
                    <div className="p-3">
                      <h5 className="fw-semibold mb-2">{a.title}</h5>
                      {a.excerpt && <p className="text-muted small mb-2">{a.excerpt}</p>}
                      {a.tags?.length > 0 && (
                        <div className="d-flex flex-wrap gap-1 mb-2">
                          {a.tags.map(t => <span key={t} className="badge text-bg-light border">{t}</span>)}
                        </div>
                      )}
                      {a.publishedAt && (
                        <div className="text-muted small">{new Date(a.publishedAt).toLocaleDateString()}</div>
                      )}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
