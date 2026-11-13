# Act On Issues

A civic issue-reporting platform. Citizens report local problems (roads, drainage,
water, etc.) and follow their progress. Authorities and administrators sort and
escalate them, then resolve them.

Features include issue reporting with photos and location, a public feed with location
search, comments and activity history, escalation emails to government departments with
reply capture, RTI request drafting, a lawyer/legal-help directory, articles and custom
pages built in an admin page builder, notifications (in-app, web push, email, WhatsApp),
phone OTP and Google sign-in, 8 UI languages, and an installable PWA.

## Architecture

One deployable app with two tiers:

- **Frontend**: React 18 SPA built with Vite (`src/`, `index.html`).
- **Backend**: Express JSON REST API on MongoDB/Mongoose (`server.js`, `routes/`,
  `controllers/`, `models/`, `middleware/`, `services/`).

In development, Vite serves the SPA on port 5173 and proxies `/api` to Express on 3001.
In production, `npm run build` bundles the SPA into `dist/` and Express serves it next
to the API, so the whole app runs as one process on one port. The production deployment
target is Google Cloud Run (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

## Prerequisites

- Node.js 20+
- MongoDB 7 (local or hosted). `docker/docker-compose.yml` can run one for you.

## Quick start

```bash
cp .env.example .env      # edit at least MONGO_URI and SESSION_SECRET
npm install
npm run seed              # optional: demo users + sample issues (WIPES the database)
npm run dev               # SPA → http://localhost:5173, API → http://localhost:3001
```

Demo accounts created by `npm run seed`:

| Role      | Login                   | Password       |
|-----------|-------------------------|----------------|
| Admin     | admin@acton.dev         | admin123       |
| Authority | authority@acton.dev     | authority123   |
| Citizen   | citizen@acton.dev       | citizen123     |
| Citizen   | rohan@acton.dev         | citizen123     |
| Citizen   | +919876543210 (phone)   | citizen123     |

> `npm run seed` deletes existing data. **Never run it against production.** To create
> the first admin on a live database, use `scripts/seedAdmin.js`, which only adds
> accounts that don't already exist.

## npm scripts

| Command              | What it does                                                   |
|----------------------|----------------------------------------------------------------|
| `npm run dev`        | API (nodemon) + Vite dev server together                       |
| `npm run build`      | Checks imports, then builds the SPA into `dist/`               |
| `npm start`          | Production server (serves `dist/` + API)                       |
| `npm run seed`       | Reset the database with demo data                              |
| `npm test`           | Run the server and UI test suites once                         |
| `npm run test:watch` | Re-run tests on file save                                      |
| `npm run check`      | Catch helpers that a file calls but never imports (a blank page at runtime) |

## Configuration

All configuration is through environment variables. [.env.example](.env.example)
lists every one with comments. Only the core group is required, and every optional
integration turns itself off when its key is blank.

| Group            | Variables                                              | Required? |
|------------------|--------------------------------------------------------|-----------|
| Core             | `MONGO_URI`, `SESSION_SECRET`, `PORT`, `SITE_URL`, `CLIENT_ORIGIN` | Yes |
| Email (SMTP)     | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | For email |
| File storage     | `GCS_BUCKET`, `GCS_PROJECT_ID`, `GCS_KEY_FILE` (blank = local `uploads/`) | No |
| Phone sign-in    | `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_KEY_FILE` | For OTP |
| Web push         | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | No |
| WhatsApp         | `WHATSAPP_*`                                           | No |
| Inbound replies  | `WEBHOOK_INBOUND_SECRET`, `INBOUND_REPLY_DOMAIN`       | No |
| Auto-translation | `GOOGLE_TRANSLATE_API_KEY`                             | No |
| Address/places   | `VITE_GEOAPIFY_API_KEY`, `VITE_GOOGLE_PLACES_API_KEY`  | No |
| Analytics        | `VITE_GTM_ID`, `VITE_GA_ID`, `VITE_CLARITY_ID`         | No |

`VITE_*` variables are compiled into the frontend at **build** time, so they must be set
before `npm run build`, not only at runtime.

### Maintenance mode

Set `MAINTENANCE_MODE=true` to replace every page with a "back soon" page
([templates/maintenance.html](templates/maintenance.html)) and make every `/api` call
return 503. The server sends `Retry-After`, so search engines treat the outage as
temporary. No data is touched; unset the variable to bring the site back.

Optional: `MAINTENANCE_MESSAGE`, `MAINTENANCE_CONTACT_EMAIL`, and `MAINTENANCE_START`
(ISO time that anchors the page's looping 1-hour countdown).

### Error pages

Browsers that hit an error get a friendly page with the status code, a next step, and
the Bunny Bubbles mini-game. The template is [templates/error.html](templates/error.html),
the wording for each code is in [services/errorPages.js](services/errorPages.js), and the
game is shared with the maintenance page through `templates/partials/`. Requests to `/api`
still get JSON errors.

URLs the React app doesn't know now return a real **404** instead of redirecting to the
homepage. If you add a route to `src/routes/AppRoutes.jsx`, add it to `SPA_ROUTES` in
`services/errorPages.js` too. `npm test` fails if you forget.

Preview every page locally (not available in production): http://localhost:3001/__errors

## Docker

```bash
cp .env.example .env
docker compose -f docker/docker-compose.yml up --build
```

This builds the root `Dockerfile` and runs it on http://localhost:3001 alongside a
`mongo:7` container.

## Testing

```bash
npm test
```

Two suites run:

- **server**: real HTTP requests against a throwaway `actonissue_test` database. Needs
  MongoDB running locally (or set `TEST_MONGO_URI`). It refuses to run against any
  database whose name lacks "test".
- **ui**: React components rendered in jsdom. No database needed.

See [tests/README.md](tests/README.md) for details and
[tests/smoke-checklist.md](tests/smoke-checklist.md) for the manual pre-release check.

## API

The REST API is mounted under `/api`.

- Swagger UI: `/api-docs`
- Health probe: `/api/health`
- Full reference: [docs/API.md](docs/API.md)

## Data fixes and admin scripts

One-off data migrations live in [services/maintenanceService.js](services/maintenanceService.js).
They can be run from the **Maintenance** tab in the admin Control Panel (easiest) or
from a terminal:

```powershell
$env:MONGO_URI = "<connection string>"
node scripts/maintenance.js               # list jobs
node scripts/maintenance.js <job-id>      # dry run: show what would change
node scripts/maintenance.js <job-id> --apply
```

Other scripts in `scripts/` seed content (page blocks, articles, SEO and legal pages)
or backfill fields. Each script starts with a comment that explains what it does and
how to run it.

> On Windows PowerShell, set variables on their own line (`$env:X = "..."`). The
> Unix `X=... node script.js` form does not work there.

## Project layout

```
server.js            Express entry point: middleware, routes, serves dist/ in production
config/              logger, health check, GCS config
routes/              /api route definitions
controllers/         request handlers (return JSON)
models/              Mongoose schemas
middleware/          auth, security headers/rate limits, uploads, issue visibility, errors
services/            email, push, WhatsApp, OTP, translation, storage, OG images, maintenance jobs
utils/               small shared helpers (phone normalisation, slugs, geo checks…)
swagger/             OpenAPI spec for /api-docs
templates/           server-rendered HTML (maintenance page, email templates)
scripts/             seeders, migrations, maintenance CLI
public/              static files copied as-is (PWA manifest, service worker, icons)
src/                 React SPA
  pages/             route-level screens (Feed, Issues, RTI, Lawyer, Admin, Games…)
  components/        shared UI, feed, page-builder blocks, layout
  context/ hooks/    app state and reusable hooks
  i18n/              translations: en, hi, kn, ml, mr, or, ta, te
  services/          API client
tests/               Vitest server + UI suites
docs/                deployment, security, monitoring, SEO, monetization, test plan
docker/              docker-compose.yml
```

## Further documentation

| Doc | Covers |
|-----|--------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Cloud Run deployment and setup for each integration (Firebase, WhatsApp, Brevo, Translate, Geoapify, Places) |
| [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) | Pre-launch checklist |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model and hardening |
| [docs/MONITORING.md](docs/MONITORING.md) | Logging, health checks, alerting |
| [docs/SEO.md](docs/SEO.md) | SEO setup and analytics tags |
| [docs/API.md](docs/API.md) | Endpoint reference |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md) | Test plan |
| [docs/MONETIZATION.md](docs/MONETIZATION.md) | Ads and monetization |
