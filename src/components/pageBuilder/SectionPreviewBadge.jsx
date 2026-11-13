// Pinned corner label shown only on the one section a Page Builder preview
// (?preview=1#section-<key>) is pointing at — paired with the
// .section-preview-outline ring (src/styles/app.css) so it's unmistakable
// even where two sections share the same card layout.
export default function SectionPreviewBadge({ active }) {
  if (!active) return null;
  return <span className="section-preview-badge"><i className="bi bi-eye-fill me-1"></i>Previewing</span>;
}
