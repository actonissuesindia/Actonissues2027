import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Shared by every page that has Page Builder-editable sections (Home, About,
// Founder's Message): the admin panel's eye/preview button links to
// `<path>?preview=1#section-<key>` (see SectionPreviewModal in
// PageBuilderPanel.jsx) and expects the target page to scroll to that
// section and call it out with the .section-preview-outline/
// .section-preview-badge styling (src/styles/app.css). `deps` should list
// whatever async state gates the section actually existing in the DOM
// (page-block fetches, live-data fetches) so the scroll retries once it
// does.
export default function useSectionPreview(deps = []) {
  const location = useLocation();
  const isPreview = new URLSearchParams(location.search).get('preview') === '1';
  const previewTargetKey = isPreview && location.hash.startsWith('#section-')
    ? location.hash.slice('#section-'.length)
    : null;

  useEffect(() => {
    if (!location.hash.startsWith('#section-')) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, ...deps]);

  return { isPreview, previewTargetKey };
}
