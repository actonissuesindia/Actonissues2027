const geoip = require('geoip-lite');

// India is UTC+5:30 year-round (no DST) — 'Asia/Kolkata' is the current
// IANA name, 'Asia/Calcutta' the older alias some devices/browsers still
// report. Checking both instead of only the offset avoids false negatives
// from browsers that report a slightly different but still-India zone name.
const INDIA_TIMEZONES = ['Asia/Kolkata', 'Asia/Calcutta'];

// Only a confident signal blocks a submission — an inconclusive one (no
// timezone sent, or the IP is private/unresolvable, e.g. every request in
// local dev) fails open rather than blocking everyone. This still satisfies
// a hard block for the real case (a genuine non-India visitor) without
// bricking local testing or breaking behind a misconfigured proxy.
function isAllowedIndia({ ip, timezone }) {
  if (timezone && !INDIA_TIMEZONES.includes(timezone)) {
    return false;
  }
  const geo = ip ? geoip.lookup(ip) : null;
  if (geo && geo.country && geo.country !== 'IN') {
    return false;
  }
  return true;
}

module.exports = { isAllowedIndia, INDIA_TIMEZONES };
