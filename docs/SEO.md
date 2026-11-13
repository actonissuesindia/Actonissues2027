# SEO & Analytics Guide — Plain-English Walkthrough

This doc covers everything from the SEO push started 2026-08-04: search
engine tools, analytics, the new service/location pages, and a first-pass
keyword plan. Written the same way as [DEPLOYMENT.md](DEPLOYMENT.md) — no
assumed technical background, exact clicks, and the reasoning behind each
one.

## Where things stand today (before you do anything below)

- **Already built, no action needed from you:** the site already injects a
  proper page title, description, and preview image into every issue,
  article, custom page, and reporter profile page — that part of "better
  titles and descriptions" was already done. Twelve in-depth blog articles
  already exist at `/articles/*` covering how the platform works,
  escalation, tracking status, and more.
- **New, waiting on your review:** 14 new "service" pages (one per issue
  category with real reported activity) and 1 "location" page (Nellore —
  currently the only city with real reported issues) were created as
  **Draft** pages. Go to **Admin → Custom Pages** to read each one and hit
  **Publish** on the ones you're happy with — nothing above went live on
  its own.
- **Not started yet — needs your own account/login:** Google Search
  Console, Google Tag Manager, Google Analytics, Microsoft Clarity, Bing
  Webmaster Tools. These all require verifying that *you* own the site
  through *your own* Google/Microsoft login — something only you can do.
  The steps below walk through exactly what to click. Once you have the
  IDs they give you, send them over and it's a few small edits to wire in
  — not a new build.

---

## STEP 1 — Google Search Console

### Why this step exists
Search Console is how you see whether Google is actually indexing your
pages, what people search to find you, and any crawl errors — without it,
you're flying blind on how the site performs in Google search.

### 1a. Verify your site — already done
Confirmed 2026-08-04: `actonissues.com` is already verified in Search
Console as a **domain property** (not URL-prefix), via the DNS-level
verification record from the earlier domain setup (see
[DEPLOYMENT.md](DEPLOYMENT.md) and [deployment-log.html](deployment-log.html)).
It's already showing real data (search clicks, indexed pages) — nothing
further to do here, no HTML tag needed.

### 1b. Submit your sitemap
1. In Search Console, left sidebar → **Sitemaps**.
2. Enter `sitemap.xml` and click **Submit**.
3. The site already serves a live, auto-updating sitemap at
   `https://actonissues.com/sitemap.xml` (built fresh from the database on
   every request — no manual updates needed as new issues/articles/pages
   get published).

---

## STEP 2 — Google Tag Manager (GTM)

### Why this step exists
GTM is a container that lets you add/manage tracking scripts (like
Analytics) from a web dashboard, without needing a code change every time.
Optional if you'd rather just use Analytics directly (Step 3) — GTM is
mainly useful once you want to add more tracking tools later without
asking for a code change each time.

### 2a. Create a container — done (2026-08-04)
Container ID `GTM-WWFFV3DJ`, account "Act On Issues", container
`actonissues.com`.

### 2b. Wired in
Added to local `.env` as `VITE_GTM_ID=GTM-WWFFV3DJ` — confirmed loaded via
[src/utils/analytics.js](../src/utils/analytics.js) (called from
`src/main.jsx` on startup). **Still needs adding to Cloud Run's Variables &
Secrets screen before it's live on the actual site** (same as every other
key in [DEPLOYMENT.md](DEPLOYMENT.md) Step 6).

Note: in the current GTM UI, the tag type is called **"Google Tag"**, not
"GA4 Configuration" (that name is gone/merged) — pick that one, not "GA4
Event" (which is for custom events sent *after* a base tag already exists).

---

## STEP 3 — Google Analytics 4 (GA4)

### Why this step exists
This is what actually shows you visitor counts, which pages people view,
where they drop off, and so on.

### 3a. Create a property — done (2026-08-04)
Property "Act On Issues", industry "Law & Government", web stream
`https://actonissues.com`, Measurement ID `G-G3MZTCN9RP`.

### 3b. Wired in — through GTM, not the direct snippet
Went with the GTM path (Step 2 was already set up), per the "pick one, not
both" rule below. Added a **Google Tag** type tag named "GA4 Config" in the
`actonissues.com` GTM container, Tag ID `G-G3MZTCN9RP`, trigger
Initialization - All Pages, published as "Version 2 - Add GA4"
(2026-08-04, 11:14 AM). Since it's flowing through GTM,
`VITE_GA_ID` in `.env` stays blank — setting it too would double-count
pageviews.

**Pick one path, not both:** if you set up GTM, add GA4 *through* GTM
rather than also using the direct `VITE_GA_ID` snippet — otherwise every
pageview gets counted twice.

---

## STEP 4 — Microsoft Clarity

### Why this step exists
Clarity is free and shows you session recordings and heatmaps — literally
watching (anonymized) how real visitors move through your pages, which is
useful for spotting confusing UI in a way raw numbers don't show.

### 4a. Create a project — done (2026-08-04)
Project "Act On Issues", category "Community, Social, & Charitable
Groups", URL `https://actonissues.com`, Project ID `xwyvhz4ky7` (read off
the "Install manually" tracking snippet rather than the tour).

### 4b. Wired in
Added to local `.env` as `VITE_CLARITY_ID=xwyvhz4ky7` — picked up
automatically by [src/utils/analytics.js](../src/utils/analytics.js).
**Still needs adding to Cloud Run's Variables & Secrets screen** before
it's live on the actual site, same as `VITE_GTM_ID`.

---

## STEP 5 — Bing Webmaster Tools

### Why this step exists
Bing (and Yahoo, which uses Bing's index) is a meaningfully smaller slice
of search traffic than Google in most cases, but verifying costs a few
minutes and there's no downside.

### 5a. Verify your site — done (2026-08-04)
Used the **Import from Google Search Console** path — both
`actonissues.com` and `actonissues.blog` imported instantly, no manual
meta tag needed.

### 5b. Submit your sitemap — done (2026-08-04)
Submitted `https://actonissues.com/sitemap.xml` from Bing Webmaster
Tools' **Sitemaps** section — note Bing's submit box wants the **full
URL**, not the relative `sitemap.xml` path Google's box wanted. Showed
status "Processing" right after submitting; expect it to flip to
"Success" within a day once Bing actually crawls it.

---

## The new service & location pages

14 category pages (Roads & Infrastructure, Water Supply, Street Lighting,
Drainage & Sewage, Garbage & Sanitation, Environment, Traffic &
Transportation, Animals, Housing & Land, Government Services, Public
Places & Recreation, Electricity, Law & Order, Public Health) and 1 city
page (Nellore) were created as **Draft** pages in Admin → Custom Pages.

**Why only these 14 categories, and only Nellore:** the database currently
has 16 approved issues total, spread across exactly these 14 categories,
and every single one is in Nellore. Building pages for categories or
cities with zero real activity yet would look like empty, thin "doorway
pages" to Google — which actively hurts rankings rather than helping. As
more categories and cities pick up real reported issues, more pages should
get added the same way (ask me, and I'll check the data and generate the
next batch — `scripts/seedSeoPages.js` is written so re-running it later
just adds whatever's new, without duplicating or disturbing anything
already published).

**What to do:** open each Draft page in Admin → Custom Pages, read it, edit
anything you'd word differently, and hit Publish when you're happy. Each
one links out to the matching in-depth article (e.g. the Water Supply page
links to the existing "How to Report a Water Supply Issue Online" article)
rather than repeating it — so publishing all 15 shouldn't create duplicate
or competing content with what's already live.

---

## Keyword clusters (first pass, directional)

I don't have access to a live keyword-volume tool (Google Keyword Planner,
Ahrefs, SEMrush, etc.), so treat this as an informed starting point to
refine once Search Console starts showing real query data (Step 1) —
not a data-verified plan yet.

**Cluster 1 — Already covered by existing articles** (don't re-target
these with new pages; they'd compete with your own content):
- "how does [civic complaint app] work", "how to escalate a complaint to
  government", "how to track a complaint status", "civic complaint app vs
  government portal"

**Cluster 2 — Category + action intent** (the new service pages target
these):
- "report [pothole / water supply / street light] issue online"
- "[category] complaint online India"
- "how to report [category] problem"

**Cluster 3 — Category + location intent** (the real growth opportunity
once more cities have activity):
- "report [category] issue in [city]"
- "civic complaints [city]"
- "[city] municipal complaint online"
This is the cluster to expand into as soon as a new city shows real
reported activity — each new city page should target its own name plus
its most common local categories, the same pattern used for Nellore.

**Cluster 4 — Comparison / consideration intent** (also already covered):
- "best civic complaint app India", "alternative to government grievance
  portal"

**Suggested near-term action:** once Search Console has a few weeks of
data (Step 1), check **Performance → Queries** for anything already
getting impressions with a low click-through rate — that's usually the
fastest, highest-confidence signal for what to write next, ahead of any
guesswork here.

---

## Checklist

- [x] Google Search Console verified (domain property, via DNS)
- [x] Sitemap submitted in Search Console (2026-08-04) — status showed
      "Couldn't fetch" with a stale "Last read: Dec 28, 2023" immediately
      after submitting; that's leftover data from before this domain
      pointed here (it used to sit on GoDaddy's placeholder page — see
      DEPLOYMENT.md Step 8g). robots.txt and a Googlebot-UA fetch both
      confirmed the sitemap itself is reachable and unblocked, so this
      should clear to "Success" once Google actually re-crawls — check
      back in a few hours.
- [x] Google Tag Manager container created (`GTM-WWFFV3DJ`)
- [x] Google Analytics 4 property created (`G-G3MZTCN9RP`, wired through GTM)
- [x] Microsoft Clarity project created (`xwyvhz4ky7`)
- [x] Bing Webmaster Tools verified (imported from GSC), sitemap submitted
- [x] `VITE_GTM_ID` / `VITE_CLARITY_ID` added to production (Cloud Run) —
      confirmed live 2026-08-04 (`VITE_GA_ID` intentionally blank, GA4 flows
      through GTM instead — see Step 3). Note: these had to be fixed to
      inject server-side (`server.js`) rather than as Vite build-time
      vars, since Cloud Run env vars aren't visible during the Docker
      build step — see [MONETIZATION.md](MONETIZATION.md) Step 1b for the
      same fix applied to AdSense.
- [ ] Google/Bing verification meta tag(s) added to `index.html`
- [x] Server-side title/description/preview-image injection for issues, articles, custom pages, reporters (already done, no action needed)
- [ ] 14 service pages + 1 location page reviewed and published in Admin → Custom Pages
- [ ] Revisit location pages once a second city shows real reported activity
