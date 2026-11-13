# Monetization Guide — Plain-English Walkthrough

How Act On Issues can earn money. Written the same way as
[DEPLOYMENT.md](DEPLOYMENT.md) and [SEO.md](SEO.md) — no assumed technical
background, exact clicks, and the reasoning behind each one.

## Where things stand today

- **Traffic reality check:** as of 2026-08-04, Search Console shows only 15
  total search clicks over the last two weeks and 2 indexed pages (see
  [SEO.md](SEO.md)). Ad revenue will be minimal until SEO traffic grows —
  the point of setting AdSense up now is so it's earning once that happens,
  not immediate income.
- **In progress:** Google AdSense — account created, site connected, code
  live, awaiting Google's review.
- **Not started:** a donation button, sponsorships, B2G (government
  dashboard access), premium citizen features.

---

## STEP 1 — Google AdSense (display ads)

### Why this step exists
Automatic ads that pay per impression/click, no need to find advertisers
yourself. The standard "default" way a content site earns from traffic.

### 1a. Sign up — done (2026-08-04)
Account created at adsense.google.com, site `actonissues.com`, payment
country **India** (locked in — can't be changed later, but correct since
the business/bank/users are all India-based).

### 1b. Connect the site — done (2026-08-04)
Publisher ID: `ca-pub-4435518382239676`. Wired in two places:
- **The script tag** — injected server-side into every page's `<head>`
  via `ADSENSE_CLIENT_ID` in `server.js` (`ANALYTICS_HEAD`), same pattern
  used for GTM/Clarity — necessary because, like those, Cloud Run's env
  vars only exist at container *runtime*, not during the `vite build`
  step in the Dockerfile, so this can't be a build-time Vite variable.
- **`ads.txt`** — added at [public/ads.txt](../public/ads.txt) (served
  automatically at `https://actonissues.com/ads.txt`, same static-file
  mechanism as `robots.txt`). Required by AdSense to confirm you're an
  authorized seller of ad space on this domain — content:
  `google.com, pub-4435518382239676, DIRECT, f08c47fec0942fa0`.

### 1c. Production env var — done (2026-08-04)
Added to Cloud Run's Variables & Secrets alongside `VITE_GTM_ID` and
`VITE_CLARITY_ID`. Confirmed live by curling the production HTML and
`ads.txt` directly — all three IDs present in the served page.

### 1d. Verify site ownership in AdSense — done (2026-08-04)
"Your site is verified" confirmed in the AdSense dashboard.

### 1e. Consent message (EEA/UK/Switzerland) — done (2026-08-04)
Chose the 3-choice option (**Consent / Do not consent / Manage
options**) over the 2-choice one — the safer, more compliant pick, since
regulators generally expect an equally clear reject option, not just an
accept button with a buried settings link. Only actually matters for
visitors from Europe/UK/Switzerland, but it's now configured either way.

### 1f. Google's review — waiting (requested 2026-08-04)
Review requested — status now shows "Getting ready" in the AdSense
dashboard. Google reviews the site for content quality, working
navigation, and policy compliance before approving ads to actually start
showing. Can take anywhere from a few days to a few weeks — nothing to do
but wait. No ads will actually display until this review passes, even
though the code is live.

### 1g. Once approved — ad placement (not done yet)
After approval, decide where ads actually go (e.g. sidebar on the feed
page, in-article on blog posts) and create **Ad units** in the AdSense
dashboard (Ads → By ad unit → Display ads), then drop the given
`<ins class="adsbygoogle">` snippet into the relevant React
component(s). Revisit this once approval comes through — no point
placing ad slots that won't show anything yet.

---

## STEP 2 — Donations (not started)

### Why this option fits this site
For a civic platform, donations are often a more natural fit than ads —
people who got real help from the platform (their pothole actually got
fixed) may want to support it directly, and there's no minimum-traffic
approval process like AdSense.

### Recommended approach
A **Razorpay Payment Button** — created directly from the Razorpay
dashboard (razorpay.com), no backend integration needed. Generates an
embeddable button/link that can go in the site footer or a dedicated
"Support Us" page. Requires Razorpay business KYC (PAN, bank account) to
receive payouts — same kind of setup as any Indian payment gateway.

*(Not started — revisit once AdSense is fully live, or sooner if you'd
rather prioritize this first.)*

---

## Other options (not started, for later)

- **Sponsorships / local business ads** — sell a banner slot directly,
  no ad-network cut. Requires actually finding a sponsor first; nothing
  to configure until then.
- **B2G (business-to-government)** — sell municipal authorities a
  dashboard/analytics view of issues in their jurisdiction. Highest
  ceiling for a civic platform specifically, but a sales relationship,
  not a code change.
- **Premium citizen features** — e.g. priority escalation, verified
  badge. Needs product decisions (what's worth paying for) before any
  setup work.

---

## Checklist

- [x] Google AdSense account created, site connected (`ca-pub-4435518382239676`)
- [x] `ads.txt` added
- [x] `ADSENSE_CLIENT_ID` added to production Cloud Run environment — confirmed live 2026-08-04
- [x] Site ownership verified in AdSense (2026-08-04)
- [ ] AdSense review passed (Google-side, no action once submitted — click "Request review" next)
- [ ] Ad units created and placed in the app (after approval)
- [ ] Donation button (Razorpay Payment Button) set up
