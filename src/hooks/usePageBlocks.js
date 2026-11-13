import { useEffect, useState } from 'react';
import api from '../services/api';

// Public, unauthenticated — mirrors useLogoOverrides.js's shape. Returns
// null while the first fetch is in flight and [] once it resolves to no
// blocks (not seeded yet, or the Super Admin removed all of them) — callers
// treat `blocks === null || blocks.length === 0` as "render the page's own
// hardcoded fallback content" so a fetch hiccup never leaves a blank section.
export default function usePageBlocks(page) {
  const [blocks, setBlocks] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setBlocks(null);
    api.get('/page-blocks', { params: { page } })
      .then(res => { if (!cancelled) setBlocks(res.data.blocks || []); })
      .catch(() => { if (!cancelled) setBlocks([]); });
    return () => { cancelled = true; };
  }, [page]);
  return blocks;
}
