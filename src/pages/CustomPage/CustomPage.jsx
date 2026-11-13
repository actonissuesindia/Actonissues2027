import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopNav from '../../components/layout/TopNav';
import Footer from '../../components/layout/Footer';
import api from '../../services/api';
import usePageBlocks from '../../hooks/usePageBlocks';
import { renderBlockList } from '../../components/pageBuilder/BlockRenderer';

// Renders any Super Admin-created standalone page (models/CustomPage.js) —
// same freeform block types (heading/richtext/image/button/cardgrid/spacer)
// as About/Founder's Message, just without a developer having written a
// dedicated .jsx file for it. Its content comes from PageBlock.js under
// `page: custom-<CustomPage _id>` (see controllers/pageBlockController.js),
// fetched the same way usePageBlocks already works for every other page.
export default function CustomPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setPage(null);
    api.get(`/pages/${slug}`)
      .then(res => setPage(res.data.page))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const blocks = usePageBlocks(page ? `custom-${page._id}` : undefined);

  return (
    <div>
      <TopNav />
      <div className="container-fluid px-4 px-lg-5 py-4 py-lg-5">
        <div className="mx-auto" style={{ maxWidth: 900 }}>
          {loading ? (
            <p className="text-muted small">Loading…</p>
          ) : notFound || !page ? (
            <div className="text-center py-5">
              <h1 className="display-heading fs-2 mb-3">Page not found</h1>
              <p className="text-muted mb-4">This page doesn't exist, or isn't published yet.</p>
              <Link to="/" className="btn btn-gradient">Back to Home</Link>
            </div>
          ) : blocks === null ? (
            <p className="text-muted small">Loading…</p>
          ) : blocks.length === 0 ? (
            <div className="text-center py-5">
              <h1 className="display-heading fs-2 mb-3">{page.title}</h1>
              <p className="text-muted">This page doesn't have any content yet.</p>
            </div>
          ) : renderBlockList(blocks)}
        </div>
      </div>
      <Footer />
    </div>
  );
}
