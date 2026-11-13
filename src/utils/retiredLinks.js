// Menu links pointing at pages that no longer exist.
//
// Nav and footer links live in the database (Page Builder), so removing a page
// in code leaves any link an admin already saved sitting in the menu, pointing
// at a redirect. scripts/removeFounderNavLinks.js deletes those rows properly
// — but it has to be run against production by hand, and until somebody does,
// visitors keep seeing a menu item for a page that was merged away months ago.
//
// This is the belt to that script's braces: a link to a retired address is
// hidden wherever menus are rendered, so a deploy is enough to make it
// disappear. The stale row still wants cleaning up, and the script still does
// that; this just stops the wait being visible to visitors.
//
// Add an entry here only when the destination genuinely no longer exists —
// this hides menu items, and hiding one an admin deliberately added would be
// its own bug.
const RETIRED_HREFS = [
  // The Founder's Message page was merged into /about; the route now just
  // redirects there (see src/routes/AppRoutes.jsx).
  '/founders-message'
];

export function isRetiredLink(href) {
  if (!href) return false;
  // Compared without the query string so '/founders-message?from=nav' is
  // caught too.
  return RETIRED_HREFS.includes(String(href).split('?')[0]);
}

// Convenience for the two places that render a list of stored link blocks.
export function withoutRetiredLinks(blocks) {
  return (blocks || []).filter(block => !isRetiredLink(block?.config?.href));
}

export default RETIRED_HREFS;
