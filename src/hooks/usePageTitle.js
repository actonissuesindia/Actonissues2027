import { useEffect } from 'react';

// The SPA shell's <title> (index.html) is static, and nothing here uses
// react-helmet — so without this, every route keeps showing the same
// generic "Act On Issues" tab title once client-side routing takes over.
// Server-rendered routes (issues/articles/custom pages/reporters, see
// server.js) already get a real per-page <title> on first load; this covers
// the static, code-defined pages those routes don't touch.
export default function usePageTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — Act On Issues` : 'Act On Issues';
    return () => { document.title = previous; };
  }, [title]);
}
