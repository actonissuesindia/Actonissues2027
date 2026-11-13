// Two-level page → region grouping for the Page Builder admin panel's
// selector, plus the frontend's copy of which block types each region
// allows (for the "+ Add block" palette — the backend's
// controllers/pageBlockController.js ALLOWED_TYPES is the authoritative,
// enforced copy; this one is only for not offering a type the API would
// reject anyway).
const FREEFORM_TYPES = ['heading', 'richtext', 'image', 'button', 'cardgrid', 'spacer'];

export const PAGE_GROUPS = [
  {
    label: 'Home',
    regions: [
      { value: 'home-layout', label: 'Section order (drag to reorder the whole page)', hideAdd: true },
      { value: 'home-how-it-works', label: 'How it Works steps', preview: { path: '/', anchor: 'section-howItWorks' } },
      { value: 'home-cta-banner', label: 'CTA banner', preview: { path: '/', anchor: 'section-ctaBanner' } }
    ]
  },
  {
    label: 'About',
    regions: [
      { value: 'about-hero', label: 'Hero', preview: { path: '/about', anchor: 'section-about-hero' } },
      { value: 'about-what-we-do', label: 'What We Do', preview: { path: '/about', anchor: 'section-about-what-we-do' } },
      { value: 'about-how-it-works', label: 'How It Works', preview: { path: '/about', anchor: 'section-about-how-it-works' } },
      { value: 'about-values', label: 'Our Values', preview: { path: '/about', anchor: 'section-about-values' } },
      { value: 'about-mission-vision', label: 'Mission & Vision', preview: { path: '/about', anchor: 'section-about-mission-vision' } },
      // Not wired up to a live section yet — About.jsx's "Neutrality & legal"
      // block is still hardcoded, so there's nothing on the live site for a
      // preview to point at (see the 'Real impact' fix this same session for
      // the same kind of gap on Home).
      { value: 'about-neutrality-legal', label: 'Neutrality & Legal' },
      // Formerly its own standalone "Founder's Message" page/route — merged
      // into this page (see About.jsx). Reuses the same 'founder-message-body'
      // page key its content was already seeded under (scripts/seedPageBlocks/
      // seedFounder.js), so existing DB content carries over with no
      // migration. The old page's separate Mission & Vision region
      // ('founder-mission-vision') isn't reused here — About already has its
      // own equivalent Mission & Vision section above.
      { value: 'founder-message-body', label: "Founder's Message", preview: { path: '/about', anchor: 'section-founder-message-body' } }
    ]
  },
  {
    label: 'Footer',
    regions: [
      { value: 'footer-platform', label: 'Platform column' },
      { value: 'footer-account', label: 'Account column' },
      { value: 'footer-legal', label: 'Legal column' }
    ]
  },
  {
    label: 'TopNav',
    regions: [{ value: 'topnav-links', label: 'Nav links' }]
  },
  {
    label: 'Feed',
    regions: [{ value: 'feed-toggles', label: 'Feed toggles', isToggles: true }]
  },
  // Not a fixed region — this tab renders CustomPagesPanel instead of a
  // RegionEditor list (see the `special` check in PageBuilderPanel.jsx).
  // Lets Super Admin create/publish whole new standalone pages (their own
  // URL, built from blocks) rather than just editing a fixed region.
  {
    label: 'Pages',
    special: 'custom-pages',
    regions: []
  }
];

export const ALLOWED_TYPES = {
  'home-layout': ['toggle'],
  'home-how-it-works': FREEFORM_TYPES,
  'home-cta-banner': FREEFORM_TYPES,
  'about-hero': FREEFORM_TYPES,
  'about-what-we-do': FREEFORM_TYPES,
  'about-how-it-works': FREEFORM_TYPES,
  'about-values': FREEFORM_TYPES,
  'about-mission-vision': FREEFORM_TYPES,
  'about-neutrality-legal': FREEFORM_TYPES,
  'founder-message-body': FREEFORM_TYPES,
  'footer-platform': ['link'],
  'footer-account': ['link'],
  'footer-legal': ['link'],
  'topnav-links': ['link'],
  'feed-toggles': ['toggle'],
  test: [...FREEFORM_TYPES, 'link', 'toggle']
};

// Mirrors controllers/pageBlockController.js's allowedTypesFor — a Super
// Admin-created custom page (page: `custom-<CustomPage _id>`) isn't a fixed
// ALLOWED_TYPES entry since it's created dynamically at runtime, but it gets
// the same freeform palette as About.
export function allowedTypesFor(page) {
  return page?.startsWith('custom-') ? FREEFORM_TYPES : ALLOWED_TYPES[page];
};

export const TYPE_LABELS = {
  heading: 'Heading', richtext: 'Rich Text', image: 'Image', button: 'Button',
  cardgrid: 'Card Grid', spacer: 'Spacer', link: 'Link', toggle: 'Toggle'
};
