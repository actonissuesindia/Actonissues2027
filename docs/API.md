# Act On Issues — API Reference

A complete, current reference to every HTTP endpoint the backend exposes —
written both for future work on this project and for anyone building an
external integration (a bot, a dashboard, a data export job, a Zapier-style
automation) against this API.

**Base URL:** `https://actonissues.com/api` in production, `http://localhost:3001/api`
in local development. An interactive, in-browser version of this same
reference — with a "Try it out" button per endpoint — is served at
`/api-docs` (e.g. `https://actonissues.com/api-docs`).

---

## Before you integrate

### Authentication is a session cookie, not an API key
There is no separate API-key or bearer-token system. Logging in
(`POST /api/auth/login`, or one of the other sign-in endpoints below) sets a
`connect.sid` session cookie, exactly the same one the web app itself uses —
every authenticated request after that just needs to send that cookie back.
For a script or server-side integration, that means: log in once, keep the
cookie jar from that response, and reuse it on every subsequent request
(`curl -c cookies.txt`, `requests.Session()` in Python, `axios` with
`withCredentials: true` + a shared cookie jar, etc.). Sessions last 7 days
from last use (`cookie.maxAge`) and are stored server-side in MongoDB, not
encoded in the cookie itself.

### CORS — this matters if your integration runs in a browser
In production, the server does **not** send `Access-Control-Allow-Origin`
headers at all — cross-origin requests initiated from another website's
JavaScript will be blocked by the browser itself, regardless of
authentication. This is intentional (it's what keeps a malicious site from
riding a visitor's session cookie). It does **not** affect:
- Server-to-server calls (a Node/Python/PHP backend, a cron job, `curl`,
  Postman, n8n/Zapier/Make-style automation platforms) — CORS is a browser
  concept and simply doesn't apply to those.
- The official web app itself, which is same-origin in production.

If you need a browser-based third-party integration, proxy the request
through your own backend rather than calling `actonissues.com/api` directly
from client-side JS.

### Roles — stored value vs. what's shown on screen
Accounts have one of three stored roles: `Citizen`, `Authority`, `Admin`.
**The UI deliberately displays different labels than the stored value**:

| Stored role | Shown to users as | What it can do |
|---|---|---|
| `Citizen` | "Member" | Create/manage own issues, comment, view approved issues |
| `Authority` | "Admin" | Everything below, plus moderate any issue and manage **Citizen** accounts only |
| `Admin` | "Super Admin" | Full reach — every account (any role), site settings, audit log, hero headline/quotes |

Every endpoint below that mentions a required role is naming the **stored**
value (what you'd send/compare in code), not the on-screen label. If you're
scripting account creation or role checks, use `Citizen` / `Authority` /
`Admin` — not "Member" / "Admin" / "Super Admin".

### Response envelope
Every response is JSON with a `success` boolean. On success, the rest of the
body carries whatever data that endpoint returns (documented per-endpoint
below). On failure:
```json
{ "success": false, "message": "Human-readable reason" }
```
with an appropriate HTTP status code (400 validation, 401 not logged in, 403
forbidden, 404 not found, 409 conflict, 503 a dependent service like SMTP is
down, 500 unexpected). A 500 with no specific cause masks the real error
behind `"Something went wrong. Please try again in a moment."` — the actual
error is only in the server's own logs, never leaked to the client.

### Rate limits
| Limiter | Window | Max | Applies to |
|---|---|---|---|
| General | 15 min | 600/IP (prod) | Everything under `/api/*` except the two rows below and `/api/health` |
| Login | 15 min | 20/IP | `POST /api/auth/login` |
| OTP request | 10 min | 5/IP | `POST /api/auth/otp/request`, `POST /api/auth/forgot-password` |
| Ludo game | 60 sec | 60/user | Everything under `/api/games/ludo/*` (exempt from the general limiter) |

A limit hit returns `429` with `{ success: false, message }`.

### Pagination
Most list endpoints return everything matching the filter in one response —
there is no `page`/`pageSize` query param on the API itself (the admin UI's
page-size selector does the slicing client-side, after fetching the full
filtered set). If you're pulling a large dataset, filter by the query params
documented per-endpoint to keep responses manageable.

---

## Auth — `/api/auth`

No auth-related endpoint here is scoped by role; everyone starts as `Citizen`.
Every endpoint that succeeds in creating a session returns the same `user`
shape (called `sessionUser` below):
```json
{
  "_id": "...", "name": "...", "email": "...", "phone": "...",
  "userId": "...", "userIdChangeCount": 0, "role": "Citizen",
  "avatar": "...", "banner": "...", "isDisabled": false,
  "hasPassword": true, "mustChangePassword": false
}
```

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/check-availability` | — | Query: exactly one of `email`, `phone`, `userId` |
| POST | `/register-with-phone` | — | The only self-registration path — see below |
| POST | `/login` | — | Rate-limited: 20/15min/IP |
| POST | `/google` | — | Sign in / register via a Google ID token |
| POST | `/firebase-phone` | — | Sign in / register via a verified Firebase phone token |
| POST | `/logout` | session | Clears the session cookie |
| GET | `/me` | — | 200 if logged in, 401 otherwise |
| PATCH | `/me` | session | Change display name |
| PATCH | `/me/user-id` | session | Change User ID — capped at 3 uses ever |
| POST | `/me/avatar` | session | Multipart `avatar` field, 5MB max, png/jpg/jpeg |
| POST | `/me/banner` | session | Multipart `banner` field, 5MB max, png/jpg/jpeg |
| POST | `/change-password` | session | |
| POST | `/otp/request` | — | Email OTP only — rate-limited 5/10min/IP |
| POST | `/otp/verify` | — | |
| POST | `/forgot-password` | — | Always returns the same message whether or not the account exists |
| POST | `/reset-password` | — | |

**Registration is phone-verification-only.** There is no plain
email/password signup endpoint — every new account is created through
`POST /api/auth/register-with-phone`, which requires a Firebase phone-auth
ID token (obtained client-side via Firebase's SMS flow) alongside the
account details:

```
POST /api/auth/register-with-phone
{
  "idToken": "<Firebase phone-auth ID token>",
  "firstName": "Asha", "lastName": "Rao",
  "userId": "asharao",              // 3-30 chars: a-z 0-9 . _ @ -
  "password": "Str0ng!Pass",        // 8-16 chars, upper+lower+digit+special
  "email": "asha@example.com",
  "acceptedTerms": true
}
→ 201 { "success": true, "user": { ...sessionUser } }
```
Conflicts return `409` with `"Email already registered"`, `"Phone number
already registered"`, or `"That User ID is already taken"`.

**Logging in** accepts any of email, phone, or User ID as `identifier`:
```
POST /api/auth/login
{ "identifier": "asharao", "password": "Str0ng!Pass" }
→ 200 { "success": true, "user": { ...sessionUser } }
→ 401 { "success": false, "message": "Invalid credentials" }
→ 403 { "success": false, "message": "This account has been disabled" }
```

**Email OTP** is a two-step flow: `POST /otp/request { "identifier": "<email>" }`
sends a code, then `POST /otp/verify { "identifier", "code", "name"? }` — `name`
is required only the first time (creating a brand-new account); an existing
account logs straight in.

**Phone OTP login** (`POST /firebase-phone`) works the same way but keyed on
a Firebase-verified phone number instead of a server-generated code —
`{ "idToken": "<Firebase token>", "name"? }`.

---

## Issues — `/api/issues`

The core resource. Every issue has a moderation lifecycle
(`Pending → Approved`/`Rejected`, auto-approved after a configurable delay if
nobody reviews it — see `SystemSetting` under Admin below) separate from its
real-world resolution `status`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | optional | The main list/search/filter endpoint |
| GET | `/meta` | — | Full category/topic/status/priority enum reference |
| GET | `/stats` | — | `{ total, open, inProgress, resolved, pending }` |
| GET | `/category-counts` | — | Approved issues, grouped by category |
| GET | `/top-reporters` | — | Top 5 reporters by approved-issue count |
| GET | `/featured` | — | "Hot" issues (max 15) |
| GET | `/locations?q=` | — | Autocomplete over state/district/mandal/city |
| GET | `/:id` | session | 404s (not 403) if you can't see it — existence is masked |
| POST | `/` | session | Create an issue |
| PATCH | `/:id` | session | Owner or staff — see field rules below |
| DELETE | `/:id` | session | Owner or staff |
| POST | `/:id/support` | session | Toggle upvote (mutually exclusive with disagree) |
| POST | `/:id/disagree` | session | Toggle disagree (mutually exclusive with support) |

### GET /api/issues — query params (all optional)
| Param | Effect |
|---|---|
| `status` | Exact match on `Open / In Progress / Escalated / Resolved / Rejected` |
| `category` | Exact match on the top-level topic |
| `priority` | Exact match on `Low / Medium / High` |
| `city` | Case-insensitive exact match on `location.city` |
| `q` | Case-insensitive substring match against `title` or `description` |
| `location` | Case-insensitive substring match against state/district/mandal/city |
| `mine` | `true` — only the caller's own issues, any moderation state (requires login) |
| `moderation` | `all` — skip the Approved-only filter (staff only, for the moderation queue) |

Without `mine`/`moderation=all`, only `moderationStatus: 'Approved'` issues
are ever returned — this is the one endpoint the public feed and any
external "what's currently reported" integration should use.

### GET /api/issues/meta
The full enum reference in one call — use this instead of hardcoding
category/topic lists, since the taxonomy can change:
```json
{
  "success": true,
  "categories": ["Roads & Infrastructure", "Water Supply", "...", "Other"],
  "topicHierarchy": { "Roads & Infrastructure": ["Potholes", "...", "Other"], "...": [] },
  "statuses": ["Open", "In Progress", "Escalated", "Resolved", "Rejected"],
  "priorities": ["Low", "Medium", "High"],
  "moderationStatuses": ["Pending", "Approved", "Rejected"],
  "states": ["Andhra Pradesh", "...", "Puducherry"],
  "autoApprovalEnabled": true,
  "autoApprovalDays": 1, "autoApprovalHours": 0, "autoApprovalMinutes": 0,
  "autoApprovalLabel": "1 day"
}
```
24 top-level categories in `topicHierarchy`, each with its own sub-topic
list ending in `"Other"`.

### POST /api/issues — create
```json
{
  "title": "Pothole on MG Road",
  "description": "Deep pothole near the bus stop, been there 2 weeks.",
  "topic": "Roads & Infrastructure",
  "subTopic": "Potholes",
  "customCategory": "",                  // required only if topic or subTopic is "Other" — 4-30 chars
  "priority": "Medium",                  // optional, defaults to Medium
  "location": {
    "address": "MG Road, near City Bus Stand",  // OR state+district+city all three
    "city": "Hyderabad", "district": "Hyderabad", "state": "Telangana",
    "lat": 17.385, "lng": 78.4867
  }
}
→ 201 { "success": true, "issue": { ...moderationStatus: "Pending" } }
```

### PATCH /api/issues/:id — update
The owner can change `title`, `description`, `category` (any subset).
Staff (`Admin`/`Authority`) can additionally change `priority`, `assignee`,
`status`, `featured`, `commentsLocked`, `moderationStatus`. A non-owner,
non-staff caller gets `403`. Setting `status` to `Resolved`/`Rejected`
automatically un-features the issue and locks its comments. Marking
`featured: true` requires the issue to already be `Approved` and not
`Resolved`/`Rejected` (`400` otherwise).

### POST /api/issues/:id/support and /disagree
```json
→ 200 { "success": true, "supportCount": 4, "supported": true, "disagreeCount": 0, "disagreed": false }
```

---

## Comments — `/api/comments`

One level of nesting: replying to a reply attaches to the original
top-level comment instead of nesting further.

| Method | Path | Auth |
|---|---|---|
| GET | `/:issueId` | — |
| POST | `/:issueId` | session |
| DELETE | `/:issueId/:commentId` | session (author or staff) |

```json
POST /api/comments/<issueId>
{ "text": "Reported this to the ward office too.", "parentComment": null }
→ 201 { "success": true, "comment": { "text": "...", "user": {...}, "parentComment": null, ... } }
```
Deleting a top-level comment cascades to delete its replies. Commenting on
an issue with `commentsLocked: true` returns `403` unless you're staff.

---

## Activity — `/api/activity`

Read-only audit trail per issue (who did what, when) — separate from the
admin-only `AuditLog` below, which covers account/moderation actions
specifically.

| Method | Path | Auth |
|---|---|---|
| GET | `/:issueId` | — |

```json
→ 200 { "success": true, "activities": [{ "user": {...}, "action": "status", "details": "...", "createdAt": "..." }] }
```

---

## Notifications — `/api/notifications`

Always scoped to the logged-in caller — there's no way to read anyone
else's.

| Method | Path | Auth |
|---|---|---|
| GET | `/` | session |
| POST | `/:id/read` | session |
| POST | `/read-all` | session |

```json
GET /api/notifications
→ 200 { "success": true, "notifications": [{ "title","message","link","read","createdAt" }], "unread": 3 }
```

---

## Push notifications — `/api/push`

Web Push subscriptions (VAPID). Pair with `GET /vapid-public-key` to get the
public key for `PushManager.subscribe()` client-side.

| Method | Path | Auth |
|---|---|---|
| GET | `/vapid-public-key` | — | 503 if push isn't configured on this deployment |
| POST | `/subscribe` | session | `{ endpoint, keys: { p256dh, auth } }` |
| POST | `/unsubscribe` | session | `{ endpoint }` |

---

## Attachments — `/api/attachments`

Photos/videos attached to an existing issue (separate from any files sent
inline with issue creation — this app doesn't support that; attach after
creating).

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/:issueId` | session (owner or staff) | Multipart `attachments`, up to 6 files |
| DELETE | `/:issueId/:attachmentId` | session (owner or staff) | |

File limits (also apply to `POST /api/gcs/upload` and avatar/banner
uploads, with their own field-specific caps noted where they differ): 10MB
per file, `.png .jpg .jpeg .mp4 .mov` only. A file failing the type check is
silently dropped, not a hard error.

---

## Ludo (in-app game) — `/api/games/ludo`

Not part of the civic-issue domain — a bundled multiplayer board game. Every
route here requires a session and shares a dedicated 60-requests/minute/user
rate limit (exempt from the general API limiter, since this is a
poll-every-2-seconds kind of endpoint by design).

| Method | Path | Notes |
|---|---|---|
| GET | `/active` | Caller's current in-progress/waiting room, or `null` |
| POST | `/rooms` | `{ "targetPlayers": 2\|3\|4 }` — creates + auto-joins as host |
| GET | `/rooms/:code` | Poll for state — `403` if you're not a member |
| POST | `/rooms/:code/join` | Idempotent if already a member |
| PATCH | `/rooms/:code` | Push a move — optimistic concurrency via `expectedVersion` |
| POST | `/rooms/:code/leave` | Only before the game starts |

Rooms auto-expire (`waiting`: 30 min, `active`: 2h, `finished`: 10 min) via a
MongoDB TTL index — no cleanup job needed.

---

## Announcements — public: `/api/announcements`, admin: `/api/admin/announcements`

Site-wide banner shown on the Home page, cycling through however many are
currently active. `mood` is one of `announce`, `celebrate`, `warning`,
`sad`, `love`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/announcements` | — | Only ones inside their `[startAt, endAt]` window right now |
| GET | `/api/admin/announcements` | staff | Every announcement, regardless of schedule |
| POST | `/api/admin/announcements` | staff | |
| PATCH | `/api/admin/announcements/:id` | staff | |
| DELETE | `/api/admin/announcements/:id` | staff | |

```json
POST /api/admin/announcements
{ "text": "Scheduled maintenance tonight 11pm-12am.", "mood": "warning",
  "startAt": "2026-08-01T22:00", "endAt": "2026-08-02T00:00" }
```
`startAt`/`endAt` are both optional — omit either for "no lower/upper
bound." `400` if both are set and `startAt >= endAt`.

---

## Hero headline & quotes — public: `/api/hero-quotes`, admin: `/api/admin/hero-quotes`

Lets the site owner (stored role `Admin` only — **not** `Authority`)
override the Home page's big headline, the small eyebrow line above it, and
the paragraph below it.

| Method | Path | Auth |
|---|---|---|
| GET | `/api/hero-quotes` | — |
| GET | `/api/admin/hero-quotes` | `Admin` only |
| POST | `/api/admin/hero-quotes` | `Admin` only |
| PATCH | `/api/admin/hero-quotes/:id` | `Admin` only |
| DELETE | `/api/admin/hero-quotes/:id` | `Admin` only |

```json
GET /api/hero-quotes
→ 200 {
  "success": true,
  "quotes": [{ "_id": "...", "text": "Your city. Your voice. Out loud." }],
  "eyebrowText": "",       // '' = using the site default
  "descriptionText": ""    // '' = using the site default
}
```
With zero quotes, the Home page shows its original hardcoded headline. With
2+, it auto-cycles between them every 5 seconds. `eyebrowText`/
`descriptionText` are separate optional single-value overrides, edited via
`PUT /api/admin/settings` (see below) under the keys `HERO_EYEBROW_TEXT` /
`HERO_DESCRIPTION_TEXT` — blank means "use the default."

---

## Admin — `/api/admin`

Every route below requires a session; most additionally require staff
(`Admin` or `Authority`), and some require `Admin` specifically. Where a
route is open to `Authority` too, that account's reach is scoped to
**Citizen accounts only** — see the table.

| Method | Path | Required role | Citizen-scoped for `Authority`? |
|---|---|---|---|
| GET | `/reports` | staff | — |
| GET | `/users` | staff | List filtered to Citizen accounts |
| GET | `/roles` | staff | — |
| POST | `/users` | staff | Can only create Citizen accounts (unless individually granted, see `canCreateCitizens`) |
| PATCH | `/users/:id` | staff | `role`/`canCreateCitizens`/`canAccessHomeFeed` are Admin-only fields regardless; `userId`/`phone` edits scoped to Citizen targets |
| POST | `/users/:id/reset-password` | staff | Scoped to Citizen targets |
| PATCH | `/users/:id/status` | staff | Scoped to Citizen targets |
| DELETE | `/users/:id` | staff | Scoped to Citizen targets |
| GET/POST/PATCH/DELETE | `/announcements`, `/announcements/:id` | staff | Not scoped — either staff role can manage any announcement |
| GET/POST/PATCH/DELETE | `/hero-quotes`, `/hero-quotes/:id` | **`Admin` only** | `Authority` gets `403` |
| GET | `/audit` | **`Admin` only** | |
| GET/PUT | `/settings` | **`Admin` only** | |

### GET /api/admin/reports
```json
→ 200 {
  "success": true,
  "summary": { "totalIssues", "openIssues", "inProgress", "resolvedIssues", "pendingReview", "users", "canCreateCitizens" },
  "byCategory": [{ "_id": "Roads & Infrastructure", "count": 41 }]
}
```

### POST /api/admin/users — create an account directly (staff-created, not self-registered)
```json
{ "name": "Ward Officer", "email": "officer@example.com", "role": "Authority" }
→ 201 { "success": true, "user": {...}, "generatedPassword": "Xk9#mQ2pLw7z" }
```
`generatedPassword` is returned exactly once, in plaintext — the account is
created with `mustChangePassword: true`, so this is meant to be handed to
that person to log in and immediately change.

### PATCH /api/admin/users/:id
Body is a sparse patch — send only the fields you're changing: `role`,
`canCreateCitizens`, `canAccessHomeFeed` (all three Admin-only), `userId`,
`phone` (empty string removes it, rejected if the account would then have
no email either).

### GET /api/admin/audit
```json
→ 200 { "success": true, "logs": [{ "user": {...}, "action": "role_change", "entity": "User", "entityId": "...", "details": "...", "createdAt": "..." }] }
```
Max 200 most recent entries. `action` values in use: `moderate_issue`,
`delete_issue`, `user_create`, `role_change`, `permission_change`,
`userid_change`, `phone_change`, `account_disable`, `account_enable`,
`account_delete`, `password_reset`.

### GET/PUT /api/admin/settings
Generic key/value site config. `GET` seeds any missing default key on read.
```json
→ 200 { "success": true, "settings": [{ "key": "AUTO_APPROVAL_DAYS", "value": "1", "description": "..." }] }
```
```json
PUT /api/admin/settings
{ "settings": [{ "key": "AUTO_APPROVAL_DAYS", "value": "2" }] }
```
`PUT` accepts a partial list — only the keys you send are touched. Current
keys: `APP_NAME`, `SMTP_ENABLED`, `GCS_ENABLED`, `AUTO_APPROVAL_ENABLED`,
`AUTO_APPROVAL_DAYS`/`HOURS`/`MINUTES`, `GAMES_ENABLED`, `HERO_EYEBROW_TEXT`,
`HERO_DESCRIPTION_TEXT`.

`GAMES_ENABLED` (`'true'`/`'false'`) is also readable unauthenticated-but-
logged-in via `GET /api/games/ludo/enabled` → `{ success, enabled }` — the
Games tab/page uses that instead of the admin-only settings list. When
`'false'`, `GET /api/games/ludo/enabled` returns `enabled: false` and every
other `/api/games/ludo/*` route 403s.

---

## Uploads via Google Cloud Storage — `/api/gcs`

Only mounted at all when the deployment has `GCS_BUCKET` configured
(local dev without it: this whole path 404s). When present, avatar/banner/
attachment uploads transparently go to GCS instead of local disk — this
route is a generic one-off upload endpoint outside that flow.

| Method | Path | Auth |
|---|---|---|
| POST | `/upload` | session — multipart `file` field |

```json
→ 200 { "success": true, "url": "https://storage.googleapis.com/..." }
```

---

## Health check — `/api/health`

No auth, no rate limit (mounted before the general limiter). Use this for
uptime monitoring.
```json
→ 200 { "status": "UP", "timestamp": "2026-07-25T09:00:00.000Z", "uptime": 128453.2 }
```

---

## Quick start: a script that logs in and lists open issues

```bash
# 1. Log in, saving the session cookie
curl -c cookies.txt -X POST https://actonissues.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"you@example.com","password":"yourpassword"}'

# 2. Reuse that cookie on every subsequent request
curl -b cookies.txt "https://actonissues.com/api/issues?status=Open"
```

```python
import requests
s = requests.Session()
s.post("https://actonissues.com/api/auth/login", json={
    "identifier": "you@example.com", "password": "yourpassword"
})
resp = s.get("https://actonissues.com/api/issues", params={"status": "Open"})
print(resp.json()["issues"])
```
