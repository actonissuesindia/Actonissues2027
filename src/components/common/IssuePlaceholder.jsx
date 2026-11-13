// A relevant-looking stand-in for issues posted without a photo, shown
// wherever attachment images normally render. Icon is picked per category;
// the background color is derived from the category name itself so any
// category (including free-typed "Other" custom categories) always gets a
// distinct, consistent color rather than needing every possible value
// hand-mapped.
export const CATEGORY_ICONS = {
  'Roads & Infrastructure': 'bi-signpost-split-fill',
  'Water Supply': 'bi-droplet-fill',
  'Drainage & Sewage': 'bi-water',
  Electricity: 'bi-lightning-charge-fill',
  'Street Lighting': 'bi-lightbulb-fill',
  'Garbage & Sanitation': 'bi-trash3-fill',
  'Traffic & Transportation': 'bi-car-front-fill',
  Environment: 'bi-tree-fill',
  'Public Health': 'bi-heart-pulse-fill',
  Education: 'bi-mortarboard-fill',
  'Government Services': 'bi-bank2',
  'Law & Order': 'bi-shield-fill-exclamation',
  'Housing & Land': 'bi-house-door-fill',
  'Women, Children & Social Welfare': 'bi-people-fill',
  Animals: 'bi-feather',
  'Markets & Consumer Issues': 'bi-shop',
  'Agriculture & Rural Development': 'bi-flower1',
  'Disaster & Emergency': 'bi-cloud-lightning-rain-fill',
  'Digital & Telecom': 'bi-wifi',
  'Public Places & Recreation': 'bi-trophy-fill',
  'Employment & Labour': 'bi-briefcase-fill',
  'Finance & Banking': 'bi-cash-coin',
  'Public Awareness & Suggestions': 'bi-megaphone-fill',
  Other: 'bi-question-circle-fill'
};

export function hueFor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash % 360;
}

export default function IssuePlaceholder({ category }) {
  const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.Other;
  const hue = hueFor(category || 'Other');
  const style = {
    background: `linear-gradient(135deg, hsl(${hue} 68% 48%), hsl(${(hue + 40) % 360} 60% 28%))`
  };
  return (
    <div className="issue-placeholder" style={style} title={category}>
      <i className={`bi ${icon}`}></i>
    </div>
  );
}
