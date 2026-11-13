import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopNav from '../../components/layout/TopNav';
import Footer from '../../components/layout/Footer';
import api from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

// Public, unauthenticated (unlike /issues/:id) — real per-post title/
// description/canonical come from server.js's dynamic meta injection for
// crawlers; this just renders the same article for a real browser. `body`
// is already sanitized server-side on save (see articleController.js),
// so it's safe to render as HTML here.
export default function ArticleDetail() {
  const { t } = useLanguage();
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api.get(`/articles/${slug}`)
      .then(res => setArticle(res.data.article))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <>
      <TopNav />
      <div className="container-fluid px-4 py-4">
        <div className="mx-auto" style={{ maxWidth: 760 }}>
          <Link to="/articles" className="d-inline-flex align-items-center gap-1 fw-semibold text-decoration-none text-dark mb-3">
            <i className="bi bi-arrow-left"></i>Back to {t('footer.guidesResources')}
          </Link>

          {loading ? (
            <p className="text-muted small">Loading…</p>
          ) : notFound || !article ? (
            <p className="text-muted small">Article not found.</p>
          ) : (
            <article className="card p-4 p-md-5">
              <h1 className="fw-bold mb-2" style={{ fontSize: '1.75rem' }}>{article.title}</h1>
              <div className="text-muted small mb-3">
                By {article.authorName}
                {article.publishedAt && ` · ${new Date(article.publishedAt).toLocaleDateString()}`}
              </div>
              {article.coverImage && (
                <img src={article.coverImage} alt="" className="mb-4" style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 10 }} />
              )}
              <div dangerouslySetInnerHTML={{ __html: article.body }} />
              {article.tags?.length > 0 && (
                <div className="d-flex flex-wrap gap-2 mt-4 pt-3 border-top">
                  {article.tags.map(t => <span key={t} className="badge text-bg-light border">{t}</span>)}
                </div>
              )}
            </article>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
