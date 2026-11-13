# Deployment Guide — Plain-English Walkthrough

This is a step-by-step guide to putting Act On Issues live on the internet at
actonissues.com. It's written assuming you have never used git, GitHub, or a
cloud hosting console before — every command explains what it does and why.

We'll fill in each section with full detail as we complete it, so this file
becomes a complete record of exactly what was done, in case you (or anyone
else) needs to repeat it later.

---

## Some words explained first

- **Terminal** — a text window where you type commands instead of clicking.
  In VS Code: menu **Terminal → New Terminal** (or press `` Ctrl+` ``). It
  opens already sitting in your project folder, so you don't need to
  navigate anywhere first.
- **git** — a program that keeps a history of every change made to your
  project's files, like an infinitely detailed "undo" log. It runs entirely
  on your own computer.
- **GitHub** — a website that stores a copy of that git history online, so
  it's backed up and other tools (like the cloud hosting service) can read
  your code from there.
- **Repository ("repo")** — the name for one project's worth of code tracked
  by git. Your project folder becomes a repo once we run `git init` (already
  done for you).
- **Commit** — one saved snapshot of your code at a point in time, with a
  short message describing what changed.
- **Push** — sending your saved commits from your computer up to GitHub.

---

## STEP 1 — Save your code with git, then upload it to GitHub

### Why this step exists
Later, the cloud hosting service (Google Cloud Run) will be told "build and
run whatever code is in this GitHub repository." So the code has to live on
GitHub before hosting can happen. This step just gets it there.

You already have **GitHub Desktop** installed and signed in (as
`actonissuesindia`), so we'll use its buttons instead of typing commands —
it does the same things as the git commands, just by clicking.

### 1a. Open GitHub Desktop and add this project
1. Open the **GitHub Desktop** app (search for it in the Windows Start menu).
2. Top-left menu: **File → Add local repository**.
3. Click **Choose...** and browse to `d:\Act-On-Issues-new-version`, then
   confirm.
4. GitHub Desktop will recognize it as a git project (we already ran
   `git init` on it) and switch to showing its "Changes" view — a list of
   every file in the project, each with a checkbox, all checked by default.

### 1b. Check the file list, then commit
Skim the list on the left. It should **not** contain `.env`,
`node_modules`, `dist`, or `uploads` — those are deliberately excluded
because `.env` holds secret passwords/keys and the others are either
rebuilt automatically or just huge and unnecessary to store. (Already
confirmed excluded — just a sanity glance, not something you need to fix.)

At the bottom-left, there's a text box labeled **Summary**. Type
`Initial commit`, then click the blue **Commit to main** button.

**What this does:** saves a permanent snapshot of your project into git's
history. This is still entirely local — nothing has left your computer yet.

### 1c. Publish it to GitHub
After committing, a button appears at the top labeled **Publish repository**.
Click it. A small dialog appears:
- **Name:** `act-on-issues` (or anything you like)
- **Keep this code private** — leave this **checked**
- Click **Publish repository**

**What this does:** creates a brand-new repository on your GitHub account
*and* uploads (pushes) your committed code to it, in one step. Because
you're already signed into GitHub Desktop, there's no login popup — it just
works.

### 1d. Verify it worked
In GitHub Desktop, top menu **Repository → View on GitHub** opens the repo
in your browser. You should see all your project's folders and files
listed there. If `.env` or `node_modules` show up in that list, stop and
let me know before continuing — but based on what I already checked, they
won't.

---

<details>
<summary>Alternative: doing this from the terminal instead (not needed if you're using GitHub Desktop above)</summary>

```
git add .
git status
git commit -m "Initial commit"
```
Then create an empty repo at github.com (New repository → don't tick any of
the README/.gitignore/license boxes → Create), copy the `.git` URL it
gives you, and:
```
git remote add origin https://github.com/YOUR-USERNAME/act-on-issues.git
git branch -M main
git push -u origin main
```
The first push opens a browser login popup once, then uploads everything.

</details>

---

## STEP 2 — Set up the production database (MongoDB Atlas)

### Why this step exists
Your app stores everything — every issue, comment, user account — in a
MongoDB database. Right now it's using a copy of MongoDB running on your own
computer, which only your computer can reach. Once the site is live on the
internet, it needs a database that's *also* reachable from the internet.
MongoDB Atlas is a free, official hosting service for exactly this — Google
Cloud doesn't offer its own MongoDB service, so this is a separate signup.

### 2a. Create your Atlas account
1. Go to **mongodb.com/cloud/atlas/register** and sign up (you can use your
   Google account to skip typing a password).
2. When asked what you're building, any answer is fine — you can skip or
   pick the closest option.

### 2b. Create a free cluster
1. On the "Deploy your database" screen, choose the **M0 Free** tier.
2. **Provider:** Google Cloud (matches where you're hosting the app —
   keeps things simple, though it's not strictly required to match).
3. **Region:** pick one close to your users (e.g. Mumbai `asia-south1` if
   most visitors are in India).
4. Click **Create**. It takes a minute or two to provision.

### 2c. Create a database user (separate from your Atlas login)
This is a username/password that your *app* uses to connect — different
from the account you just signed up with.
1. You'll be prompted for this automatically right after cluster creation
   (or find it later under **Database Access** in the left sidebar).
2. Choose **Password** authentication.
3. Pick a username (e.g. `aoi-app`) and click **Autogenerate Secure
   Password** — then **copy that password somewhere safe immediately**,
   like a notes file. Atlas will not show it to you again.
4. Under database privileges, **Read and write to any database** is fine.
5. Click **Create User**.

### 2d. Allow your app to connect
1. In the left sidebar, click **Network Access**.
2. Click **Add IP Address**.
3. Click **Allow Access from Anywhere** (adds `0.0.0.0/0`).

**Why "anywhere" is OK here:** Google Cloud Run doesn't hand out a fixed,
predictable address the way a normal server does, so we can't list a
specific IP. The connection itself is still password-protected and
encrypted — this setting only controls *which computers are allowed to try
to log in*, not who can log in without the password.

### 2e. Get your connection string
1. Go back to **Database** (left sidebar) → click **Connect** on your
   cluster.
2. Choose **Drivers**.
3. You'll see a string like:
   `mongodb+srv://aoi-app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
4. Copy it, then replace `<password>` with the real password you saved in
   step 2c. Also add a database name right after `.net/` and before the
   `?`, e.g. `.../actonissue?retryWrites=true...` — this becomes your
   `MONGO_URI` value, used later when we set up production settings (Step
   6).

Keep this final string somewhere safe alongside the database password —
we'll need it again soon, but not typed anywhere public (not in GitHub, not
in chat here either — just note it down for yourself).

---

## STEP 3 — Set up real email sending (SMTP)

### Why this step exists
Your app emails people a 6-digit code (OTP) to log in or verify their
account, and sends notifications (e.g. "your issue was approved"). Right
now `.env.example` has placeholder settings (`smtp.example.com`) that don't
actually send anything. We need a real service that will actually deliver
these emails.

**Recommended: Brevo** (formerly called Sendinblue) — free for up to 300
emails/day, no credit card needed, and simpler to set up than most
alternatives.

### 3a. Sign up
1. Go to **brevo.com** → **Sign up free**.
2. Use your `actonissuesindia@gmail.com` address (or whichever you prefer)
   and complete their verification steps (they'll email you a confirmation
   link — click it).

### 3b. Get your SMTP credentials
1. Once logged in, look for **SMTP & API** — usually under a section named
   **Senders, Domains & Dedicated IPs** or directly under your account menu
   (click your name/avatar top-right → **SMTP & API**).
2. Click the **SMTP** tab (not "API Keys" — we want SMTP specifically).
3. You'll see:
   - **SMTP Server:** something like `smtp-relay.brevo.com`
   - **Port:** `587`
   - **Login:** your Brevo account email
   - **Password / SMTP key:** click **Generate a new SMTP key** if one
     isn't already shown — copy it immediately and save it somewhere
     private, same as the database password earlier.

These four values map directly onto your project's env vars:
- `SMTP_HOST` = the SMTP Server value
- `SMTP_PORT` = `587`
- `SMTP_USER` = the Login value
- `SMTP_PASS` = the SMTP key you generated
- `SMTP_FROM` = the address you want emails to appear "from" — e.g.
  `no-reply@actonissues.com` (see note below)

### 3c. About the "from" address
Brevo's free tier will actually let you send using a `@actonissues.com`
from-address once you verify you own the domain (a quick DNS step — we'll
do this alongside the domain setup in Step 8, since it's the same kind of
task). Until then, it's fine to send using the Gmail address you signed up
with as `SMTP_FROM` — emails will still deliver, just show that address as
the sender instead of an `@actonissues.com` one. Not a blocker, just cosmetic
polish for later.

Save all five values from above alongside your `MONGO_URI` from Step 2 —
we'll enter everything together in Step 6.

---

## STEP 4 — Twilio (SMS OTP) — decided: skip for now

Twilio was never actually configured (checked `.env` — the fields exist but
were left blank), and it costs money per SMS after a small trial credit. The
decision: launch with **email OTP + password login only**; SMS OTP can be
added later without any disruption — the app already handles its absence
gracefully.

**Update (Step 13):** phone OTP was later added using Firebase Phone Auth
instead of Twilio — free, no per-SMS billing surprise. All Twilio code,
env vars, and the dependency have been removed from the project entirely,
not just left unconfigured.

---

## STEP 5 — Google Cloud Storage bucket for uploaded photos

### Why this step exists
When someone attaches a photo to an issue, the app has to store that file
somewhere. The cloud hosting service (Cloud Run) doesn't keep a permanent
local hard drive — anything saved to local disk can vanish when the app
restarts or when traffic is spread across more than one running copy. A
Cloud Storage bucket is a permanent, shared place for those files instead.

### What we found already set up
Your Google Cloud project (`actonissue-9009`) already had this built from an
earlier attempt:
- A bucket named **`actonissue-images`** (Mumbai region), already set to
  allow public read access — meaning uploaded photos can be viewed by
  anyone with the link, which is what a public issue-reporting feed needs.
- A dedicated identity, **`storage-uploader@actonissue-9009.iam.gserviceaccount.com`**,
  already granted the **Storage Object Admin** permission on that bucket —
  exactly what's needed to let the app upload/delete files.

So instead of creating anything new, we're reusing both.

### The code fix
The project's upload feature was actually still saving photos to local disk
regardless — the Cloud Storage wiring existed in the code but nothing
called it for issue attachments. This has now been fixed:
- `middleware/upload.js` — now keeps uploaded files in memory instead of
  writing them to disk, whenever a bucket is configured.
- `services/gcsService.js` — now actually uploads that in-memory file to the
  bucket and returns its public web address.
- `controllers/attachmentController.js` — now saves that Cloud Storage
  address on the issue instead of a local `/uploads/...` path, whenever a
  bucket is configured; falls back to local disk automatically when it
  isn't (so local development on your own computer, without any Google
  Cloud setup, still works exactly as before).

### Values to save for Step 6
- `GCS_PROJECT_ID` = `actonissue-9009`
- `GCS_BUCKET` = `actonissue-images`
- `GCS_KEY_FILE` = leave this blank — no downloaded key file needed, because
  the app will run *inside* Google Cloud and can use the identity assigned
  to it directly (see the note below).

### One thing to remember for Step 7 (deployment)
When we deploy to Cloud Run, we need to set that Cloud Run service's
**runtime service account** to `storage-uploader@actonissue-9009.iam.gserviceaccount.com`
(a dropdown during deployment) — that's what lets the app authenticate to
the bucket without any key file or password. Noted here so it isn't missed.

---

## STEP 6 — The full list of production settings

### Why this step exists
Everything gathered in Steps 2, 3, and 5 needs to end up as a set of named
values ("environment variables") that the running app reads on startup —
not hard-coded into the code itself, and never committed to GitHub, even a
private repo. This keeps secrets (passwords, keys) out of the project's
history entirely; they live only inside Cloud Run's own settings.

### Where these actually live, and how to find the screen again
There's no separate `.env` file involved in production at all — that file
only exists for running the app on your own computer during development
(and it's explicitly excluded from what gets uploaded to GitHub, via
`.gitignore`). In production, every one of these values is typed directly
into Cloud Run's own settings screen instead:

**Cloud Run → your service → "Edit & deploy new revision" → Containers
tab → "Variables & Secrets" section.**

That screen has a row of `Name` / `Value` boxes, and one convenient
shortcut: **pasting a whole multi-line block of `NAME=value` pairs into
the first `Name` box automatically splits it into separate rows** — this
is exactly how all 11 values get entered in one paste instead of typing
each one individually, every time a new service/region needed the exact
same settings again (Step 8 needed this three times over, once per
region tried).

<div align="center">

*(This is what that screen looks like once filled in — the same 11 rows every
time: NODE_ENV, SESSION_SECRET, COOKIE_SECURE, MONGO_URI, SMTP_HOST,
SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, GCS_PROJECT_ID, GCS_BUCKET.)*

</div>

### Where each value actually came from

| Name | Where it came from | How to find/regenerate it again |
|---|---|---|
| `NODE_ENV` | Fixed value, not from anywhere external | Always literally `production` |
| `SESSION_SECRET` | A random string generated once, purely for this project — not tied to any account or external service | Doesn't need to be "looked up" anywhere; it just needs to **stay the same** across deployments (changing it logs every signed-in user out at once). Kept in your private notes. |
| `COOKIE_SECURE` | Fixed value | Always literally `true` in production — without it, login cookies aren't marked secure even over HTTPS |
| `MONGO_URI` | Built from your MongoDB Atlas connection details | Atlas → **Database → Clusters → Connect → Drivers** gives the template string; the actual password comes from **Database Access → (your user) → Edit → Edit Password**; the database name (`actonissue`) has to be typed in by hand into the middle of the string — Atlas's own template doesn't include it |
| `SMTP_HOST` / `SMTP_PORT` | Fixed values for Brevo | Shown on Brevo's own **SMTP & API** page, but they never change: `smtp-relay.brevo.com` / `587` |
| `SMTP_USER` | Your Brevo account's SMTP login | Brevo → **SMTP & API → SMTP** tab |
| `SMTP_PASS` | A generated SMTP key, separate from your Brevo account password | Brevo → **SMTP & API → SMTP** tab → "Generate a new SMTP key" (only shown once at creation — copy it immediately) |
| `SMTP_FROM` | The address emails appear to come "from" | Currently a personal Gmail address — see Step 10 for why this needs to change to a domain-based address |
| `GCS_PROJECT_ID` / `GCS_BUCKET` | Already-existing Google Cloud resources from an earlier attempt, reused rather than recreated | Google Cloud Console → **Cloud Storage → Buckets** |
| `GCS_KEY_FILE` | Intentionally left blank | Not needed — the app authenticates using the identity Cloud Run itself runs as (see the service account note in Step 5), not a downloaded key file |
| `TWILIO_*` | Left blank | SMS OTP was decided against for launch (Step 4) |

### The one gotcha worth remembering
**A brand-new Cloud Run service — even one running the exact same code, for
the exact same app — starts with zero environment variables of its own.**
Nothing carries over automatically from an existing service, even one in
a different region for the same project. Every time a new service was
created during the Step 8 saga (three separate times, across three
regions), this entire 11-row block had to be pasted in again from
scratch. Forgetting this step is exactly what a "successfully deployed"
service with no working login or database access looks like.

---

## STEP 7 — Deploy to Google Cloud Run

### Why this step exists
This is the actual "go live" step — telling Google Cloud to build your code
into a running, internet-reachable service.

### A decision made first
Your Google Cloud project already had two older Cloud Run services
(`actonissues-july24-git`) from a previous attempt, built from a
**different, older codebase**. Decision: leave those alone for now and
create a **brand-new Cloud Run service** connected to today's GitHub repo
(`Act-On-Issues-new-version`). The old ones can be deleted later once the
new one is confirmed working — no rush, they don't interfere with a new,
separately-named service.

### 7a. Start the connection
In the Cloud Run **Services** page (where you saw the two existing
services earlier), click **Connect repo** at the top (not "Deploy
container" — that button expects an already-built image; "Connect repo"
builds directly from your GitHub code and automatically rebuilds every time
you push new changes, same as how the two older services were set up).

We'll go screen by screen from here — screenshot each step.

### What actually happened (kept here for future reference)
- The Dockerfile had to be **moved from `docker/Dockerfile` to the repo
  root** — Cloud Run's "Connect repo" flow uses the Dockerfile's own folder
  as the build context, which didn't match this project's original layout.
  `docker/docker-compose.yml` was updated to match (still works locally).
- The service was created as **`act-on-issues`**, region **`asia-south1`**,
  with all Step 6 environment variables pasted in via the bulk `.env` paste
  box, and the **service account** set to
  `storage-uploader@actonissue-9009.iam.gserviceaccount.com` so uploads
  work without a key file.
- **Authentication** must be set to **"Allow public access"** — this is a
  public website, not an internal tool.
- The Atlas password copied earlier turned out to have a transcription
  error (easy to happen with a screenshot). It was regenerated in Atlas
  (Database Access → Edit → Edit Password → Autogenerate → Copy directly,
  never retyped) and updated in both the local admin-seeding step and the
  live Cloud Run environment variables.
- The initial admin account was created directly on the production
  database with `scripts/seedAdmin.js` — unlike `scripts/seed.js`, this
  script never deletes existing data, so it's safe to keep in the project
  for creating additional accounts later if ever needed. It was run once,
  against the live database, from a local terminal — not through the
  website itself.
- Confirmed working end-to-end: logging in as Admin on the live site shows
  the Control Panel with real data from the production database (Users: 1),
  proving the database connection, session cookies, and login flow all work
  correctly on the deployed service.

---

## STEP 8 — Connect a custom domain to the live app

### Why this step exists
Right now the site is only reachable at the auto-generated `....run.app`
address. This step points a real domain at it instead. This turned out to
be the single longest, most twisty part of the whole deployment — the full
story is kept below in detail, because almost every dead end taught us
something worth remembering.

### Decisions made along the way
- The domain actually used ended up being **`actonissues.blog`**, not
  `actonissues.com` — a second domain, also registered at **GoDaddy**,
  switched to partway through this process.
- Both domains are managed through the same GoDaddy account, so the DNS
  steps below apply the same way to either one.
- **Update, a week later:** `actonissues.com` got its own working domain
  mapping too (same recipe as below, same `europe-west1` service) — with
  both live, `.com` was made the canonical one and `.blog` now redirects to
  it in-app (`server.js`) rather than removing the `.blog` mapping. See the
  "Current live configuration" snapshot near the bottom of this file.

### 8a. First attempt: `asia-south1` doesn't support domain mapping
Trying to add the mapping on the original `act-on-issues` service (in
`asia-south1`, Mumbai — the region from Step 7) showed this error
straight away:

> Domain mappings are not available in the region of the selected service.

This is a real, permanent Google Cloud limitation on that specific
feature — Cloud Run's built-in "Domain Mappings" simply isn't offered in
every region, and `asia-south1` is one of the ones missing it. Nothing to
fix here, just a region we can't use for this particular feature.

### 8b. Second attempt: a Google Cloud quota block
The plan was to redeploy a copy of the app to `asia-southeast1`
(Singapore) — the nearest region that *does* support domain mappings.
Creating that new service failed with:

> Project failed to initialize in this region due to quota exceeded.

Every Google Cloud project has a limit on **how many different regions**
it's allowed to use Cloud Run in, based on its billing history — this
project's limit was 3, already used up by regions tried in earlier
attempts (including some from before this session). Requesting a manual
increase was tried directly in the Cloud Console (**IAM & Admin → Quotas →
Cloud Run Admin API → "Number of regions that Cloud Run has been used
in"**) and Google declined it outright:

> Based on your service usage history, you are not eligible for a quota
> increase at this time.

A second brand-new region (`asia-east1`) was tried for the same reason and
hit the identical wall.

**The workaround:** instead of requesting a *new* region, reuse one the
project had *already* used before (so it doesn't count against the
limit). Checking the existing Cloud Run services list showed
`europe-west1` (Belgium) had been used previously by an old, unrelated
service from an earlier attempt — and confirming via the "Add mapping"
screen showed `europe-west1` **does** support domain mappings. Decision
made: deploy the real app there.

### 8c. Deploying a second copy of the app to `europe-west1`
Same steps as Step 7 — Connect repo → same GitHub repo/branch → service
name `act-on-issues` → region `europe-west1` → Authentication "Allow
public access" → service account `storage-uploader@...` → the same
environment variables from Step 6, pasted in again (a brand-new service
doesn't inherit anything from the old one). It built and deployed
successfully — but then a new, much harder problem appeared.

### 8d. The MongoDB connection mystery
The new `europe-west1` service came up looking healthy in the Cloud Run
console, but any page that needed the database failed with:

```
MongoServerSelectionError: connection <monitor> to <ip>:27017 closed
```
or, once a request had been waiting a while:
```
MongooseError: Operation `issues.find()` buffering timed out after 10000ms
```

This took a long, methodical process of elimination to solve. In order,
here's what was checked and ruled out:

1. **Wrong/expired password** — regenerated the Atlas database user's
   password twice (once via Atlas's autogenerate button, once as a custom
   alphanumeric-only password to rule out special characters breaking the
   connection string) and updated `MONGO_URI` on Cloud Run both times.
   Same error both times.
2. **IP not allow-listed** — checked Atlas's **Network Access → IP Access
   List**: `0.0.0.0/0` ("allow from anywhere") was already present and
   active. Not the cause.
3. **Atlas cluster actually down** — checked Atlas's own **Data Explorer**
   (Browse Collections): it loaded the real data instantly. The database
   itself was completely healthy.
4. **A Cloud Run networking/VPC misconfiguration** — checked the
   service's **Networking** tab: no VPC connector attached, ingress set
   to "All" (open). Nothing unusual there.
5. **A genuine MongoDB Atlas outage** — checked
   [status.mongodb.com](https://status.mongodb.com): no incidents
   affecting this region.
6. **Raw network reachability** — opened **Google Cloud Shell** (a
   built-in browser terminal, no install needed) and ran a plain TCP
   connectivity test against the database's three actual server addresses:
   ```
   for host in $(dig +short SRV _mongodb._tcp.cluster0.pfoylnk.mongodb.net | awk '{print $4}'); do
     echo "Testing ${host%.}:27017 ..."; timeout 5 bash -c "echo > /dev/tcp/${host%.}/27017" && echo OPEN || echo BLOCKED
   done
   ```
   All three came back `OPEN` — so the network path itself was fine.
7. **Testing from a completely different machine** — installed **MongoDB
   Compass** on a personal Windows PC and connected using the exact same
   connection string. It connected instantly. This proved the credentials
   and connection string format were correct, and the problem was
   specific to something about Cloud Run's `europe-west1` environment
   itself.

**Root cause, part 1 — Cloud Run's execution environment.** Cloud Run
services default to an older sandbox technology ("Gen 1" / gVisor) that
has known compatibility issues with MongoDB's persistent background
connections. Fix: **Cloud Run service → Edit & deploy new revision →
Containers tab → General → Execution environment → change from "Default"
to "Second generation"**, then redeploy.

**Root cause, part 2 — a connection timeout set too aggressively for the
extra distance.** Even after switching to "Second generation," the same
error kept happening. The final answer was hiding in the app's own code
(`server.js`): the database connection was deliberately set to give up
after only **5 seconds**, a setting originally chosen (correctly, at the
time) to make the Mumbai-region deployment fail fast if the database was
ever genuinely down. But Belgium is much farther from the database
(which — a useful side-discovery — turned out to be hosted on Google
Cloud in `asia-south1`, visible in its internal server hostname,
`mtm-gcp-ass1-...`) than Mumbai is, and establishing that first
connection across that distance genuinely took longer than 5 seconds —
it wasn't broken, just too slow for the timeout allowed. Fixed by raising
the timeout in `server.js` from `5000` to `20000` milliseconds:

```js
mongoose.set('bufferTimeoutMS', 20000);
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 20000 });
```

Confirmed fixed: the very first request afterward succeeded in 7.4
seconds (would have failed under the old 5-second limit), and every
request after that took only 1.1–1.5 seconds, same as any other region,
once the connection was established and being reused.

### 8e. A region tried and ruled out along the way: `asia-south2`
While debugging the above, a third copy of the app was deployed to
`asia-south2` (Delhi) — another region the project had already "used"
before, so no quota request needed. It connected to the database
instantly (being geographically close to `asia-south1`, where the
database actually lives), which helped confirm the distance theory above.
However, `asia-south2` turned out to **also** not support Domain
Mappings, so it couldn't be used for the actual goal — it was useful
purely as a diagnostic, not as the final answer. That service can be
deleted later; it costs nothing sitting idle.

### 8f. Adding the domain mapping
With `europe-west1` fully working, the mapping was finally added:
**Cloud Run → Domain mappings → Add mapping → Select a service:
`act-on-issues (europe-west1)` → Base domain: `actonissues.blog` →
Continue.** This produced 8 DNS records to add at the domain's registrar:

| Type | Value |
|---|---|
| A | 216.239.32.21 |
| A | 216.239.34.21 |
| A | 216.239.36.21 |
| A | 216.239.38.21 |
| AAAA | 2001:4860:4802:32::15 |
| AAAA | 2001:4860:4802:34::15 |
| AAAA | 2001:4860:4802:36::15 |
| AAAA | 2001:4860:4802:38::15 |

*(These specific IP addresses are Google's own, fixed, and the same for
every Cloud Run domain mapping — safe to reuse if this ever needs
redoing.)*

### 8g. Updating DNS at GoDaddy
On `actonissues.blog`'s **DNS Records** page at GoDaddy:
- **Deleted** the one existing `A` record for `@` (it pointed to
  GoDaddy's own placeholder "Website Builder" page — not something in
  use).
- **Added** all 8 records above, each with Host/Name `@`.
- **Left alone**: the `www` CNAME (already pointed at the root domain, so
  it keeps working automatically), the Google site-verification `TXT`
  record, and the `_dmarc` `TXT` record — none of those were related to
  where the website itself lives.

### 8h. Waiting for the SSL certificate
DNS started resolving to Google's servers almost immediately (checked
with `nslookup actonissues.blog`), but the site still wasn't reachable in
a browser for a while afterward — a "site can't be reached" /
certificate error is expected during this window. Google has to issue a
security certificate for the new domain before HTTPS will work, which
normally finishes well under an hour after DNS is correctly pointed.
Cloud Run's **Domain mappings** list shows a small spinning icon next to
the domain while this is in progress.

---

## STEP 9 — A lesson learned: never edit a password directly in the database

### What happened
While trying to get back into the Admin account, its password was typed
directly into the `password` field using Atlas's **Data Explorer** (the
built-in database viewer), instead of through the website itself.

### Why that broke login
The app never stores a typed password as-is — it always runs it through a
one-way scrambling process ("hashing") first, and login only works by
comparing that same scrambled form. Typing a password straight into the
database bypasses that scrambling entirely, storing it as plain, readable
text — which will never match what the login screen compares it to,
no matter how many times the same password is typed in correctly at
login.

### The fix
Reset the password again, this time through a path that actually goes
through the app's own code:
- The website's own **"Forgot password?"** link (once the database
  connection itself was working correctly), or
- The **Admin "reset password" button** next to a user in the Control
  Panel (Users table → key icon).

As an immediate unblock before the "Forgot password" email was working,
a one-off script was also run once in Google Cloud Shell, using the same
password-scrambling library (`bcryptjs`) the app itself uses, to fix the
one broken account directly and correctly.

### Rule going forward
**Never type a password directly into Atlas's Data Explorer.** Always go
through the website — Forgot Password, or the Admin's reset-password
tool. Both of those correctly scramble the password the same way normal
sign-up does.

---

## STEP 10 — Email deliverability: a known limitation, not yet fixed

### What happened
Password-reset emails (and any other automated email — OTP codes,
notifications) appear to send successfully from the app's side (no error
shown), but never actually arrive in the inbox.

### Root cause
The email "from" address currently configured (`SMTP_FROM`) is a personal
`@gmail.com` address. Since 2024, Google (and Yahoo/Microsoft) enforce
strict rules about which mail servers are allowed to send email that
claims to be "from" an `@gmail.com` address — a third-party sending
service like Brevo isn't one of them, no matter how correctly it's
configured. Brevo's own **Senders, Domains & Dedicated IPs** page
confirms this directly, flagging the sender as: *"not compliant with
Google, Yahoo, and Microsoft's new requirements for senders."*

### Status: not yet fixed
Email sending should be considered unreliable until this is addressed —
don't rely on OTP-by-email or password-reset emails actually arriving yet.
This also now applies to the issue-notification emails added in Step 12
(submitted/approved/status changed/commented) — they go out through the
exact same SMTP setup, so they'll hit the same wall until this is fixed.
The in-app bell icon and push notifications (Step 11) aren't affected —
this limitation is specific to email.

### The real fix (for later)
Set up a sending address on an owned domain instead — e.g.
`noreply@actonissues.blog` — and verify/authenticate that domain inside
Brevo (**Senders, Domains & Dedicated IPs → Domains → Add a domain**),
which adds a handful of DNS records (SPF/DKIM/DMARC) at GoDaddy, the same
kind of step as Step 8 above. Worth doing the next time DNS is being
touched, since it's the same kind of work.

---

## STEP 11 — Push notifications (real phone/browser alerts)

### Why this step exists
The app now sends a real push notification — the kind that pops up on your
phone's lock screen or your computer's notification tray, even if the
Act On Issues tab/app isn't open — whenever: your issue is submitted,
approved/rejected, its status changes, or someone comments on it. This is
separate from (and in addition to) the bell icon inside the app.

### What this needed, in plain terms
Browsers require a site to prove its identity before it's allowed to send
push notifications to someone's device — done with a matching pair of long
random codes called a **VAPID key pair** (one "public", one "private", like
a lock and its key). One pair was already generated for you and is sitting
in your local `.env` file as `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
`VAPID_SUBJECT` — nothing further to do for testing on your own computer.

### What you need to do before this works on the live site
Same situation as every other setting in Step 6: your local `.env` file is
never uploaded anywhere, and a brand-new Cloud Run environment variable
list doesn't inherit anything automatically. So the three values below need
to be added to Cloud Run's **Variables & Secrets** screen (the same screen
from Step 6), alongside the existing ones:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (already set to `mailto:no-reply@example.com` — fine to
  reuse as-is, or change to a real inbox you'd want Google/Apple to contact
  if a device ever reports abuse; purely informational, users never see it)

You can copy the exact values straight out of your local `.env` file — this
is not a "regenerate for production" situation like `SESSION_SECRET`; the
same key pair works fine in both places.

### How someone turns it on
There's a bell icon in the notifications dropdown (top-right, once signed
in) with a new line: **"Turn on push notifications."** Clicking it asks the
browser for permission (the normal "Site wants to send notifications?"
popup) — nothing happens automatically or silently. This has to be done
once per device/browser someone uses.

### A real limitation worth knowing: iPhone/iPad
On iPhones and iPads, Safari only allows push notifications for a site that
has been **"Added to Home Screen"** first (Share button → Add to Home
Screen) — opening it in a normal Safari tab and clicking the button won't
work there, that's an Apple restriction on all websites, not something
specific to this app. Android (Chrome) and desktop browsers work directly,
no install step needed.

---

## STEP 12 — Email notifications for issue updates

### Why this step exists
The same events that trigger a push notification and a bell-icon
notification (issue submitted/approved/rejected, status changed,
commented on) now also send an email, using the same SMTP setup already
in place for OTP codes (Step 3). This is a plain addition to the existing
`notify()` helper — no new account or service needed.

### The one new setting: `SITE_URL`
The email includes a clickable "View on Act On Issues" link, which needs
to know the site's real address to build a working URL (an email can't
use a relative link the way a page on the site itself can). Add this to
Cloud Run's environment variables alongside the others from Step 6:

- `SITE_URL` = `https://actonissues.com` (no trailing slash) — confirmed
  as of this step that `actonissues.com` is live and reachable, alongside
  `actonissues.blog` from Step 8. If that ever changes, this is the one
  setting that needs updating to match.

Locally this is already set to `http://localhost:5173` in your `.env`
file — nothing to do there.

### Important: inherits the Step 10 email problem
These emails go out through the exact same SMTP setup flagged as unreliable
in Step 10 (personal Gmail sender address blocked by Google/Yahoo/
Microsoft's sending rules) — so until that's fixed, treat these
notification emails the same way: they may not actually arrive, even
though the app shows no error. The bell icon and push notification for the
same event aren't affected — only the email copy is at risk.

---

## STEP 13 — Phone number login/signup with a one-time code (Firebase)

### Why this step exists
There's now a **Phone OTP** option on both Login and Register (alongside
Password and Email OTP) — type a phone number, get a text with a 6-digit
code, and that logs you in (or creates an account, the first time). This
replaces the Twilio SMS option that was never actually turned on
(Step 4) — Twilio charges per text; Firebase's phone verification is free
up to a generous monthly quota.

### What was set up
- A Firebase project was added on top of the same Google Cloud project
  already used for photo storage (`actonissue-9009`) — Firebase projects
  *are* Google Cloud projects, so this didn't create anything separate.
- **Phone** sign-in was enabled under Firebase Console → Authentication →
  Sign-in method.
- A **Blaze (pay-as-you-go)** billing plan was linked — Google requires
  this to enable phone verification at all, as an anti-abuse measure, even
  though real usage stays within the free quota.
- A **Web app** was registered in Firebase to get a `firebaseConfig`
  object — already placed in `src/config.js` (`FIREBASE_CONFIG`). This is
  safe to be public, unlike your other keys — it identifies the project,
  it doesn't grant access to it.

### How it actually works (so the pieces make sense)
Unlike the OTP for email, the server never generates or checks the SMS
code itself. Firebase handles sending and checking the code directly from
the visitor's browser. Once that succeeds, the browser gets a signed
"ID token" proving the phone number is verified, and sends *that* to the
app's own server (`POST /api/auth/firebase-phone`), which checks it's
genuine (`services/firebaseAdminService.js`) before creating a session —
same as how "Sign in with Google" already worked.

### What you need to do before this works on the live site
Two new settings, added to Cloud Run's environment variables alongside
the others from Step 6:

- `FIREBASE_PROJECT_ID` = `actonissue-9009`
- `FIREBASE_SERVICE_ACCOUNT_KEY_FILE` — **leave this blank in production**,
  same reasoning as `GCS_KEY_FILE` in Step 5: Cloud Run can prove its
  identity to Firebase directly through the service account it's already
  running as (`storage-uploader@actonissue-9009.iam.gserviceaccount.com`),
  no downloaded key file needed.

One more thing to check in Google Cloud Console, the same kind of step as
Step 5's storage permission: that same service account needs the
**"Firebase Authentication Admin"** role added (**IAM & Admin → IAM →
find `storage-uploader@...` → Edit principal → Add another role →
Firebase Authentication Admin**), so it's allowed to verify phone
sign-ins on the live site.

### Testing locally
Your own `.env` already has `FIREBASE_PROJECT_ID` filled in and
`FIREBASE_SERVICE_ACCOUNT_KEY_FILE` left blank, which worked during
testing without any extra setup on this machine. If phone sign-in ever
stops working locally, download a service account key (Firebase Console
→ Project settings → Service accounts → Generate new private key), save
it somewhere **outside git** (already covered by `.gitignore` if named
`firebase-service-account.json`), and point
`FIREBASE_SERVICE_ACCOUNT_KEY_FILE` at it.

### A real limitation worth knowing
Every phone sign-in shows Google's reCAPTCHA check in the browser — this
is required by Firebase to stop bots from running up SMS costs on your
account, not something this app added. Most real users won't see more
than a brief flash of it; it can occasionally ask someone to click a
checkbox if Google's automated risk check isn't confident, especially the
first time from a new device/browser.

---

## STEP 14 — User ID: a third way to log in

### Why this step exists
Every account now also has a **User ID** (e.g. `chaithanyassi@aoi`) —
shown on Profile Settings, usable interchangeably with email/phone on the
Password login tab. New accounts get one automatically the moment
they're created (built from their name, e.g. "Test User" →
`testuser@aoi`, with a number appended on a collision — `testuser2@aoi`).
Anyone can change theirs from Profile Settings, up to **3 times ever**
— after that it's permanently locked, so it can't be used to keep
rebranding/impersonating.

### One-time step for the live database
Accounts created *before* this feature don't have a User ID yet. A
migration script fills them in — same safe, non-destructive pattern as
`scripts/seedAdmin.js` (only touches accounts missing a User ID, never
deletes or overwrites anything, safe to run more than once). Run it once
against the live database from a local terminal:

```powershell
cd D:\Act-On-Issues-new-version
$env:MONGO_URI = "<your production connection string>"
node scripts/backfillUserIds.js
```

See **"Running a migration script on Windows"** at the bottom of this file
for why it's two lines, and what to do when you're finished.

Nothing to add to Cloud Run's environment variables for this one — it's
just a database migration, not a new service.

---

## STEP 15 — Phone number format fix (needed for Phone OTP login to work)

### What happened
Discovered while testing Phone OTP live: some accounts have their phone
number stored without a country code (e.g. `7842456778` instead of
`+917842456778`). Firebase Phone Auth always verifies to the full
`+91...` form, so a stored number missing the country code never
matches — Phone OTP login says "no account found" even though the
account is real.

### The fix
Every new save now normalizes automatically (`models/User.js` adds
`+91` to a bare 10-digit number before saving), and password login by
phone now also checks the normalized form, so this can't recur going
forward. Accounts created *before* this fix still have the broken
format in the database and need a one-time migration, same pattern as
Step 14's User ID backfill:

```powershell
cd D:\Act-On-Issues-new-version
$env:MONGO_URI = "<your production connection string>"
node scripts/normalizePhoneNumbers.js
```

See **"Running a migration script on Windows"** at the bottom of this file
if the terminal answers with `CommandNotFoundException`.

Safe to run more than once — already-correct numbers (starting with
`+`) are skipped. Prints exactly what it changes for each account, so
you can see the before/after.

### A follow-up problem this uncovered (fixed 2026-08-19)

Both the migration above and the sign-in code repaired a record with a
bare `await user.save()`, with nothing to catch a failure. Two things
make that save fail, and neither has anything to do with the person
signing in:

- **A second account already holds the `+91...` version of the number.**
  The same person registered twice — once before the fix, once after —
  so writing the normalized number onto the old record collides with the
  new one (phone numbers are unique).
- **The record is old enough to be missing a field that has since become
  required** (a name, for instance).

In the migration script, one such account aborted the entire run, so
every account listed after it stayed broken — which is why numbers can
still be in the old format even though this step was completed. In
sign-in, it surfaced as **"Something went wrong. Please try again in a
moment."** on the Phone OTP tab: Firebase had accepted the SMS code, the
person owned the number, and they were still locked out on every attempt.

Now: sign-in treats the repair as optional (it logs you in either way),
sign-in prefers the already-normalized record when a number exists twice,
and the migration script keeps going, ending with a list of the accounts
it couldn't fix and why. If it names two records for one person, they
need merging by hand — decide which account keeps the history, then
clear the phone number off the other one from the Admin panel.

---

## STEP 16 — WhatsApp notifications for issue updates

### Why this step exists
The same events that already trigger a push notification, bell-icon
notification, and email (issue submitted/approved/rejected, status
changed) now also send a WhatsApp text to the citizen who reported the
issue, if they have a phone number on file. This uses Meta's official
**WhatsApp Business Cloud API** — a different, separate service from
the Twilio SMS OTP that was skipped back in Step 4.

### An important limitation, before you set this up
Meta does not allow a business to send free-form WhatsApp text out of
the blue. Every message like this must use a **pre-approved message
template**, and the free WhatsApp test number Meta gives new developers
can only message phone numbers you've manually added to an "allowed
recipients" list — until your WhatsApp Business Account passes
verification, real citizens (numbers you haven't added yourself) will
not receive anything, even though the app shows no error. Treat this
the same way as Step 10's email deliverability problem: the code is
ready, but the account setup determines whether it actually arrives.

### 16a. Create the Meta app and get your credentials
1. Go to [developers.facebook.com](https://developers.facebook.com) and
   log in with (or create) a Facebook account, then click **My Apps →
   Create App**. Choose the **"Other"** type, then **"Business"**.
2. Once the app is created, on its dashboard click **Add Product** and
   find **WhatsApp → Set up**.
3. Under **WhatsApp → API Setup** you'll see:
   - A **temporary access token** (expires in 24 hours — only useful
     for a quick test, not for the live site).
   - A **test phone number** already provided by Meta, with its
     **Phone number ID** shown underneath.
4. For anything beyond a quick local test, generate a **permanent**
   token instead of using the temporary one: **Business Settings →
   Users → System Users → Add** → create a system user → **Add Assets**
   → select your app with `whatsapp_business_messaging` permission →
   **Generate New Token** (no expiry). Use this one for
   `WHATSAPP_ACCESS_TOKEN` in production.
5. Note down two values from this screen:
   - `WHATSAPP_PHONE_NUMBER_ID` — the "Phone number ID" from step 3.
   - `WHATSAPP_ACCESS_TOKEN` — the permanent token from step 4 (or the
     temporary one, just for local testing).

### 16b. Add test recipients (needed until business verification)
Still on the **API Setup** page, under "To", click **Manage phone
number list** and add the phone numbers of anyone who should actually
receive test messages (e.g. your own number, a tester's number) —
Meta requires each one to accept a WhatsApp invite it sends them once.
Numbers not on this list simply never receive anything while the
account is in this unverified state.

### 16c. Create and submit the message template
Go to **WhatsApp Manager → Message Templates → Create Template** and
submit exactly this (approval typically takes minutes, sometimes up to
a day):

- **Name:** `issue_update` (must match `WHATSAPP_TEMPLATE_NAME` below)
- **Category:** Utility
- **Language:** English
- **Body:**
  ```
  {{1}}

  {{2}}

  {{3}}
  ```
  (Placeholder 1 = notification title, 2 = the message text, 3 = the
  link to the issue — WhatsApp automatically turns a URL in the body
  into a tappable link, so no separate button is needed. When Meta asks
  for sample values to review the template, use something like "Your
  issue status was updated" / "\"Pothole on Main St\" is now marked
  Resolved." / "https://actonissues.com/issues/123".)

### 16d. Add the settings to Cloud Run
Same as every other integration in this guide — your local `.env` file
never uploads anywhere, so add these to Cloud Run's **Variables &
Secrets** screen (Step 6) once everything above is approved:

- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN` (the permanent system-user token, not the
  24-hour one)
- `WHATSAPP_API_VERSION` — `v21.0` is fine unless Meta has deprecated
  it by the time you read this
- `WHATSAPP_TEMPLATE_NAME` — `issue_update`, matching what you
  submitted in 16c

Leaving `WHATSAPP_ACCESS_TOKEN` blank anywhere (local or production)
simply disables WhatsApp messages — the bell icon, push, and email
notifications are completely unaffected either way.

---

## STEP 17 — Escalating issues to authorities, and receiving their replies

### Why this step exists
Admin/Authority now have an **"Escalate to Authority"** button on an
issue's page — it emails a government authority the full details of the
issue plus a personal note, and any reply that authority sends back is
captured automatically and shown right on that issue's page, instead of
landing in someone's personal inbox and getting lost. This uses Brevo's
**Inbound Parsing** feature — the same email service already sending
outbound mail (Step 3) — so no new mailbox needs to be created or checked
by hand.

### 17a. Verify actonissues.com as a sender domain in Brevo
This is worth doing regardless of this feature — it's also the fix for the
Step 10 problem (emails currently sent from a personal Gmail address,
which Google/Yahoo/Microsoft can silently block).
1. In Brevo, go to **Senders, Domains & Dedicated IPs → Domains → Add a
   domain**, enter `actonissues.com`.
2. Brevo shows a handful of DNS records (usually a few TXT records for
   DKIM/SPF verification) — add each one exactly as shown to GoDaddy's
   DNS management page for `actonissues.com` (same screen used for the
   domain mapping in Step 8).
3. Back in Brevo, click **Verify** — this can take anywhere from a few
   minutes to a few hours to pass, since DNS changes take time to spread.
4. Once verified, update `SMTP_FROM` (Step 3) to a real address at your
   own domain, e.g. `no-reply@actonissues.com`, instead of the personal
   Gmail address — this is what actually fixes Step 10's deliverability
   problem.

### 17b. Set up Inbound Parsing for a reply subdomain
1. Still in Brevo, find **Inbound Parsing** (under Transactional or
   Settings, depending on Brevo's current menu layout) and add a new
   inbound domain: `reply.actonissues.com` — a **subdomain**, deliberately
   different from the sending domain.
2. Brevo shows an MX record to add — add it to GoDaddy's DNS page for
   `actonissues.com`, as a record for the `reply` subdomain.
3. Set the **webhook URL** Brevo will call for every inbound email to:
   `https://actonissues.com/api/webhooks/brevo-inbound/<WEBHOOK_INBOUND_SECRET>`
   — replace `<WEBHOOK_INBOUND_SECRET>` with a random string you make up
   yourself (treat it like a password; it's what stops a stranger from
   posting fake "replies" to your site).

### 17c. Add the settings to Cloud Run
- `WEBHOOK_INBOUND_SECRET` — the same random string used in the webhook
  URL above.
- `INBOUND_REPLY_DOMAIN` — `reply.actonissues.com`.

### A known unknown, worth watching the first time
Brevo's exact inbound webhook payload format is documented, but the code
was written without a live test email to confirm every field name matches
exactly. The webhook logs the full raw payload it receives (**Cloud Run →
Logs**, search "Inbound email webhook payload") — so if a real authority's
reply doesn't show up on the issue page after this setup is live, that log
line is the first place to check, and the field-name matching in
`controllers/webhookController.js` may need a small adjustment to match
what Brevo actually sends.

### Why replies show only what the authority typed
When someone hits Reply in Gmail or Outlook, their mail app pastes the
entire original escalation email underneath their answer — the `>` lines,
the report details, even the tracking link. Saving that as-is buried a
one-line reply under a screenful of our own email, so incoming replies are
split before they're stored (`utils/quotedReply.js`): the typed answer is
what's shown on the issue page, and the quoted original sits behind a
**Show quoted email** link on the same reply. Nothing is discarded — if a
reply ever looks like it's missing something, click that link to see the
full email as it arrived.

---

## STEP 18 — Auto-translating Articles, Page Builder content, and Issues

### Why this step exists
The site now supports 8 languages (English, Hindi, Telugu, Tamil, Marathi,
Odia, Malayalam, Kannada) — the buttons/menus/labels were hand-translated
directly in the code, but your own written content (blog Articles, the
Home/About/Founder's Message text you edit in the Control Panel's Page
Builder, and citizen-submitted Issues) can't be hand-translated the same
way — there's no way to predict what you or your users will write. Instead,
the moment you **publish** an article, save a Page Builder block, or a
citizen **posts (or edits) an issue**, the app automatically
machine-translates it using Google's Cloud Translation API, and serves the
matching language version to a visitor who has that language selected.

Issues work a little differently from Articles/Page Builder, since those
are always written in English by you, while an issue can be posted in any
of the 8 languages — the reporter's original text isn't assumed to be
English, it's auto-detected, and translated into every *other* supported
language (including English, so an English-language visitor still sees an
English version of a Tamil-written post). One thing stays constant
regardless of ?lang=: the reporter always sees their own post exactly as
they wrote it. Everyone else — including Admin/Authority reviewing the
moderation queue — sees the translated version like any other viewer, since
the Control Panel itself has no language switcher (stays English-only), so
staff reads every issue in English regardless of what language it was
actually posted in.

### 18a. Get an API key
1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   select the same project already used for photo storage (`actonissue-9009`).
2. Search for **"Cloud Translation API"** in the top search bar, open it,
   and click **Enable** (only needs doing once).
3. Go to **APIs & Services → Credentials → Create Credentials → API key**.
4. Click the new key, and under **API restrictions**, choose **Restrict
   key** and select only **Cloud Translation API** — this limits what the
   key can be used for if it were ever leaked.
5. Copy the key value.

### 18b. Add the setting
- Local: paste it into `.env` as `GOOGLE_TRANSLATE_API_KEY`.
- Production: add `GOOGLE_TRANSLATE_API_KEY` to Cloud Run's **Variables &
  Secrets** screen (Step 6), same as every other integration in this guide.

Leaving this blank anywhere simply disables auto-translation — Articles and
Page Builder content just stay in whatever language you wrote them in
(normally English, or whatever a citizen posted an issue in), with no
errors. The hand-translated buttons/menus are a completely separate system
and are unaffected either way.

### 18c. Catching up content that already existed before this was set up
Only brand-new (or freshly edited) content gets translated automatically —
anything published/posted *before* this key was added stays untranslated
until you run a one-time catch-up:
- **Issues**: Control Panel → Moderate Issues → **"Translate existing
  issues"** button (top right of that panel). Safe to click more than
  once — it just re-translates and overwrites with the same result.
- **Articles / Page Builder**: `node scripts/translateExistingContent.js`,
  run once from a terminal against the production database (same style as
  `scripts/seedAdmin.js` in Step 7) — there's no admin-panel button for
  this one yet.

### What this costs
Billed per character translated, only when you publish/edit — a normal
blog post (a few hundred words × 7 languages) costs a small fraction of a
cent. There's no monthly fee and no cost at all while this key is unset.

### A note on quality
Machine translation is good enough to make content genuinely readable and
useful in each language, but it isn't a substitute for a native speaker's
review — treat it the same way as the hand-translated UI text elsewhere in
this app: a strong starting point, worth a spot-check before treating it as
final, especially for anything sensitive or legally important.

---

## STEP 19 — Fixing "Access blocked: Authorization Error" (origin_mismatch) on Google Sign-In

### Why this step exists
"Sign in with Google" is already fully wired up in the code — the button
(`src/components/common/GoogleSignInButton.jsx`), the backend verification
and user auto-creation (`controllers/authController.js`'s `googleSignIn`),
and the `User` model's `googleId` field. When someone signs in with Google
for the first time, the backend automatically creates a row for them in
the `users` table (matched first by Google account ID, then by email if
they'd already signed up another way, and only creates a brand-new
account if neither match) — no code change is needed for that part.

The `Error 400: origin_mismatch` screen happens for a completely
different reason: Google won't let *any* code hand back a sign-in token
unless the exact web address the page was loaded from is on an allow-list
you maintain yourself in Google Cloud Console. This is a console setting,
not something stored in this repo, so it has to be set by hand and kept
up to date whenever a new domain is added.

### The fix
1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Under **OAuth 2.0 Client IDs**, click the client named for this app —
   its ID starts with `458645747669-30fvbrdm54kj18gl437n51ung4rak1er`
   (this exact ID is hard-coded in both `src/config.js` and
   `controllers/authController.js`, so it must be this one).
3. Under **Authorized JavaScript origins**, click **+ Add URI** and add
   every address people might actually load the site from, one at a time
   (no trailing slash, no path — just the scheme + domain):
   - `https://actonissues.com`
   - `https://actonissues.blog`
   - `https://act-on-issues-458645747669.europe-west1.run.app`
   - `http://localhost:5173` (for testing on your own machine)
4. Click **Save**. Google's side can take a few minutes to a couple of
   hours to apply — if it still fails immediately after saving, wait a
   bit and try again before assuming it didn't work.
5. There's no **Authorized redirect URI** to add for this — Google Sign-In
   here uses the newer "Google Identity Services" button, which returns
   the sign-in token straight to the page via JavaScript instead of
   redirecting through a separate callback URL.

### A note for next time
If the app ever gets a new domain, add it to this same Authorized
JavaScript origins list right away — otherwise Google Sign-In will fail
on that domain with this exact error, even though everything else about
the site works fine. `www.actonissues.com` specifically no longer needs
its own origin entry — `server.js` now redirects it to the bare domain
server-side (same as the two `actonissues.blog` redirects already there),
so a visitor whose browser autocompletes the `www.` variant never actually
loads a page there in the first place.

### A second, separate problem this can uncover: a blank Google popup window
Once the Console origin is fixed, "Sign in with Google" can still get
stuck — a popup titled "Sign In - Google Accounts" opens to
`accounts.google.com/gsi/transform` and just stays blank forever. That's
unrelated to the Console setting: it's `helmet`'s default
`Cross-Origin-Opener-Policy: same-origin` header cutting off the popup
from reporting its result back to the page that opened it. Fixed in
`server.js` by setting `crossOriginOpenerPolicy: { policy:
'same-origin-allow-popups' }` in the `helmet(...)` call — this keeps the
isolation `helmet` is for, but still lets a popup the page itself opened
(like Google's sign-in popup) talk back to it. Requires a redeploy to
take effect on the live site.

---

## STEP 20 — Address autocomplete (Geoapify, reverse-geocoding only)

### Why this step exists
The address box on the Raise an Issue form used to run on OpenStreetMap's
free Nominatim service, then Geoapify (typo-tolerant, landmark-aware).
**Update:** the typed-address search box itself now runs on Google Places
instead (see Step 21A below) — Geoapify's role here is now narrower: it
only powers **reverse-geocoding**, turning a lat/lng from "Use my location"
or the map pin back into address fields
(`src/components/create/AddressAutocomplete.jsx`'s `reverseGeocode`).

### Getting a key
1. Go to [myprojects.geoapify.com](https://myprojects.geoapify.com) and
   sign up (no credit card required).
2. Create a project — it hands you an API key immediately.
3. Free tier: 3,000 requests/day (~90,000/month), usable commercially.
   That comfortably covers this app's traffic; there's nothing else to
   configure to stay on the free tier.
4. Optional but recommended: in the project's settings, restrict the key
   to your production domain(s) (`actonissues.com`, the Cloud Run URL) plus
   `localhost` for dev. This stops anyone who copies the key out of the
   public JS bundle from spending your daily quota on their own site.

### Wiring it up
- **Local dev**: paste the key into `.env` as `VITE_GEOAPIFY_API_KEY=...`
  — Vite reads it live, no rebuild needed.
- **Production (Cloud Run)**: add `VITE_GEOAPIFY_API_KEY` as an environment
  variable on the service (Step 6 checklist). This works differently from
  local dev: the key can't be baked into the frontend bundle the way
  `VITE_*` vars normally work, because the Dockerfile runs `vite build`
  during the image build — before Cloud Run's env vars exist (same root
  cause as the analytics IDs, see the `ANALYTICS_HEAD` comment in
  `server.js`). Instead, `server.js` reads `process.env.VITE_GEOAPIFY_API_KEY`
  at request time and injects it as `window.__GEOAPIFY_KEY__`, which
  `src/components/create/AddressAutocomplete.jsx` reads as a fallback.
- Leaving the key unset anywhere just means "Use my location" / the map pin
  can't auto-fill the address fields (you'd type them in manually) — typing
  an address in the search box above them is unaffected, since that's
  Google Places now.

### A separate limitation this doesn't fix
If "Use my location" drops the pin in the wrong spot (rather than the
typed-address suggestions being wrong), that's the visitor's own device
GPS — desktop browsers in particular estimate location from Wi-Fi/IP and
can be off by a whole neighborhood. No address-lookup provider changes
that.

---

## STEP 21A — Address search on the Raise an Issue form (Google Places)

### Why this step exists
The typed-address search box on the Raise an Issue form now runs on the
same Google Places setup as Step 21 below (Feed search) — reusing the
same `VITE_GOOGLE_PLACES_API_KEY` and the same
`src/utils/loadGooglePlaces.js` loader, no separate key needed. Picking a
suggestion fills address/city/district/mandal/state/lat/lng the same way
Geoapify used to (`parseGooglePlace()` in
`src/components/create/AddressAutocomplete.jsx`).

### Nothing extra to configure
If you've already done Step 21 for the Feed's location search, this form
works automatically — same key, same enabled APIs. Leaving
`VITE_GOOGLE_PLACES_API_KEY` unset makes this box show "Address search
unavailable — type it below" instead of suggestions; the State/District/City
fields further down the form still work as a manual fallback either way.

---

## STEP 21 — Precise location search on the Feed page (Google Places)

### Why this step exists
The location box on the Feed page used to only match address *text* — so
searching "MG Road" only found issues whose stored address literally
contains those words, wherever in the country that happens to be. Picking a
suggestion from Google Places instead gives an exact point on the map, so
the Feed can show issues actually *near* that point (within a chosen
radius), the way Google Maps search itself behaves. This is a different,
paid alternative to the free Geoapify autocomplete from Step 20 — it's used
here specifically because Google's suggestions are noticeably more complete
in some areas; Geoapify still powers the Raise an Issue form unchanged.

### Getting a key
1. Go to [console.cloud.google.com](https://console.cloud.google.com). If
   you already did Step 19 (Google Sign-In) or use Google Cloud Storage for
   uploads, you already have a project here — reuse it rather than creating
   a new one.
2. Left menu → **APIs & Services → Library**. Search for and **Enable**
   both **"Places API (New)"** and **"Maps JavaScript API"**.
3. Unlike Geoapify, Google requires a billing account on the project even to
   use its free monthly credit (Billing → Link a billing account, needs a
   card on file). Usage this app generates (Feed location searches only)
   comfortably stays inside that free credit at normal traffic — nothing
   else to configure to stay covered.
4. **APIs & Services → Credentials → Create Credentials → API key.** Copy
   the key, then click into it and set **Application restrictions → Websites**,
   adding `localhost` (for dev) and your production domain(s)
   (`actonissues.com`, the Cloud Run URL). This stops anyone who copies the
   key out of the public JS bundle from spending your billing quota
   elsewhere. Under **API restrictions**, limit the key to the two APIs
   enabled in step 2.

### Wiring it up
- **Local dev**: paste the key into `.env` as
  `VITE_GOOGLE_PLACES_API_KEY=...` — Vite reads it live, no rebuild needed.
- **Production (Cloud Run)**: add `VITE_GOOGLE_PLACES_API_KEY` as an
  environment variable on the service (Step 6 checklist). Same build-time
  vs. request-time split as Geoapify (Step 20): `server.js` reads
  `process.env.VITE_GOOGLE_PLACES_API_KEY` at request time and injects it as
  `window.__GOOGLE_PLACES_KEY__`, which
  `src/components/feed/GooglePlacesLocationSearch.jsx` reads as a fallback.
- Leaving the key unset anywhere just disables suggestions in the Feed's
  location box (it shows "Location search unavailable") — everything else
  on the site keeps working.

### One-time data migration
Existing issues were created before this feature and don't yet have the
`location.geo` field the radius search relies on. After deploying this
change, run once (locally against production `MONGO_URI`, or via a Cloud
Run job/shell):
```
node scripts/backfillLocationGeo.js
```
New issues get `location.geo` set automatically going forward — this only
needs to run once, for the backlog that predates it.

---

## STEP 22 — Making every shared link preview look the same

### Why this step exists
Pasting a link to the site into WhatsApp produced a different-looking card
almost every time: sometimes the post's photo, sometimes the app logo in a
small square, sometimes a plain grey box with nothing in it but
`actonissues.com`. Three separate causes, all now fixed:

1. **The photo was the phone's original.** `og:image` pointed straight at
   the uploaded file, which can be a 10MB camera photo of any shape.
   WhatsApp gives up on a download that big and shows a text-only card
   instead — and when it does succeed, a portrait photo and a landscape one
   produce differently shaped previews.
2. **A video post had no picture at all.** Posts allow `.mp4`/`.mov`
   attachments, and the code used the *first* attachment whatever it was, so
   a video-first post advertised a video file as its preview image. Nothing
   can render that, so nothing appeared.
3. **Some links had no card defined at all** — a post still awaiting
   review, a custom page, any in-app screen. Those fell back to whatever the
   messaging app invented on its own, which is the bare domain name.

### What it does now
Every shareable URL advertises the same three things: a title, a
description, and one **1200×630 JPEG**, about 60–150KB. The image is built
on the fly by `services/ogImageService.js` and served from `/og/...`:

| Link | Preview image |
|---|---|
| A post with a photo | the photo, cropped to fill the card, with the logo stamped in the corner |
| A post with only video, or no attachment | the branded card (logo on a white gradient) |
| An article | its cover image, same treatment |
| A reporter profile | their picture, centred whole (not cropped to a band) on the branded card |
| Everything else — home, About, custom pages, any app screen | the branded card |

Rendering happens once per photo and is then cached in memory, so repeat
shares of the same post are instant.

### Nothing to configure
No new API key, account, or environment variable. It adds one npm package
(`jimp`, a pure-JavaScript image resizer — no system libraries to install),
which the Docker build picks up automatically from `package.json`. To
confirm it's live after a deploy, open
`https://actonissues.com/og/default.jpg` in a browser — you should see the
branded card.

### If a shared link shows no preview card at all

Different problem from the one above, and the more likely one now. The tags
and the image are correct — you can prove it in a few seconds:

```powershell
curl.exe https://actonissues.com/og/default.jpg --output test.jpg   # should be the branded card
curl.exe -s https://actonissues.com/issues/<id> | Select-String "og:image"
```

If those look right and WhatsApp still shows a plain blue link, the crawler
never waited long enough. Measured on the live site (19 Aug 2026):

| Request | Time |
|---|---|
| First request after the service has been idle (cold start) | **6.2s** |
| Page for a post, container already awake | 1.5–4.0s |
| First render of a card from a real phone photo | **7.5s** |
| Same card once built | ~0.2s + network |

A link-preview crawler waits a couple of seconds at most. Two changes
address the rendering half: finished cards are now saved into the same
Cloud Storage bucket as the photos (so a card is built once for the life of
the photo, not once per container), and the card is built at **approval
time**, before the post can be shared at all.

The cold start is a **Cloud Run setting, not code**. With the service asleep,
the very first request pays several seconds no matter how fast the code is:

> Cloud Console → **Cloud Run** → your service → **Edit & deploy new
> revision** → under **Revision autoscaling**, set **Minimum number of
> instances** to `1`. On the **Containers** tab, set **CPU allocation** to
> *CPU is always allocated*.

That keeps one container awake permanently. It is the single biggest
improvement available for previews, and it also removes the 6-second wait
real visitors get on the first page load of the day. It costs roughly a few
dollars a month — one always-on small instance instead of zero.

### A WhatsApp behaviour that isn't ours to fix

WhatsApp builds the preview **while you type, before you press send**. Paste
a long block of text with the link at the end and send it immediately and it
often attaches no preview at all — there was no time. Paste the link, wait
for the card to appear in the compose box, *then* send. A forwarded message
carries the preview the original already had, which is why forwards can look
right when the original didn't.

### If an old link still previews the old way
WhatsApp, Facebook and the rest cache a preview per URL for weeks, and they
will keep showing the version they cached before this deploy. That's them,
not the site. Options:
- Share the link in a **new** chat/message rather than re-sending the old
  one, or wait for their cache to expire.
- Force a refresh with Facebook's
  [Sharing Debugger](https://developers.facebook.com/tools/debug/) — paste
  the URL, click **Scrape Again**. WhatsApp shares Facebook's cache, so this
  usually fixes WhatsApp too.
- Check what crawlers actually see for a given post by opening its
  `/og/issues/<id>.jpg` URL directly.

### One thing this deliberately doesn't do
The preview image carries no text of its own — no title burnt into the
picture. The messaging app already prints the title and description beside
the image, and posts here are written in several languages (Telugu, Hindi,
English); the image renderer can only draw plain Latin letters, so a Telugu
title would have come out as boxes.

---

## Running a migration script on Windows

Several steps above end with "run this once against the live database".
Every one of them needs the database address handed to the script, and
**how you do that depends on which terminal you're in** — this is the
single most common thing to trip over, because most instructions on the
internet (and older versions of this file) are written for Mac/Linux.

### The error you get if you use the wrong form

```
+ CategoryInfo : ObjectNotFound: (MONGO_URI=mongo...:String) [],
  CommandNotFoundException
```

`CommandNotFoundException` means PowerShell read the whole
`MONGO_URI=mongodb+srv://...` text as the *name of a program* and couldn't
find one called that. Putting a setting in front of a command on the same
line is Mac/Linux (Bash) syntax; PowerShell has no equivalent.

### The right form in PowerShell (the default terminal in VS Code on Windows)

Three lines — go to the project folder, set it, then run:

```powershell
cd D:\Act-On-Issues-new-version
$env:MONGO_URI = "<your production connection string>"
node scripts/normalizePhoneNumbers.js
```

Keep the quotes: a connection string contains characters PowerShell would
otherwise treat as its own punctuation.

### "Cannot find module 'D:\scripts\...'"

```
Error: Cannot find module 'D:\scripts\seedPageBlocks\seedFeedToggles.js'
  code: 'MODULE_NOT_FOUND'
```

Nothing wrong with the script — the terminal was in the wrong folder.
`scripts/...` is a path *relative to wherever you currently are*, so from
`D:\` it looks for `D:\scripts\...`. The `cd` line above fixes it. To check
where you are at any time:

```powershell
Get-Location
```

It should print `D:\Act-On-Issues-new-version`. A fresh terminal window
starts wherever it likes, so this is worth checking every time rather than
assuming the last one's folder carried over.

### When you're finished, clear it

`$env:MONGO_URI` stays set for as long as that terminal window is open, so
anything else you run in that same window — `npm run dev`, another script —
would also point at the **live** database. Either close the window, or run:

```powershell
Remove-Item Env:\MONGO_URI
```

### Two things that commonly block the connection

- **Your internet address isn't allowed in.** MongoDB Atlas only accepts
  connections from addresses on its list, and yours changes from time to
  time. Atlas → **Network Access** → **Add Current IP Address**. Without
  it the script hangs, then fails with a server-selection error.
- **The connection string has no database name.** It must read
  `.../actonissue?retryWrites=...`, not `.../?retryWrites=...` — otherwise
  the script connects successfully to an empty database and cheerfully
  reports it found nothing to fix.

Treat the connection string like a password — it contains one. Don't paste
it into a screenshot, an email, or a chat.

---

## Troubleshooting quick reference

A lookup table for anything that looks familiar from the saga above, if
it ever happens again (to this deployment or a future one built the same
way):

| Symptom | Likely cause | Fix |
|---|---|---|
| `MongoServerSelectionError` / "connection ... closed" right after deploying to a region | Execution environment set to "Default" (Gen 1) | Cloud Run service → Edit & deploy new revision → Containers → General → Execution environment → **Second generation** |
| Same error, but only in a region far from the database, even after switching to Gen 2 | Connection timeout too short for the extra distance | Already fixed in code (20s timeout in `server.js`) — shouldn't recur unless a new far-away region is added |
| `MongooseError: ... buffering timed out` | The app couldn't reach MongoDB at all (see the two rows above) | Check **Cloud Run → Logs** for the specific underlying error line for more detail |
| Login says "Invalid credentials" even with the right password | Password was stored as plain text (typed directly into Atlas) instead of through the app | Reset it again via the website's own Forgot Password, or the Admin reset-password tool |
| "No account found with that email" unexpectedly, even though the account exists | `MONGO_URI` is missing the database name — connecting to the wrong (empty) database | Check the value ends in `.../actonissue?retryWrites=...`, not `.../?retryWrites=...` |
| Emails never arrive, despite the app showing no error | Sender address is a personal Gmail address, blocked by Google's sender policy | Use a domain-based sender address, verified in Brevo (see Step 10) |
| "Domain mappings are not available in the region of the selected service" | Cloud Run's Domain Mappings feature isn't supported in every region (confirmed missing from `asia-south1` and `asia-south2`) | Use a region that does support it (confirmed working: `europe-west1`) |
| "You are not eligible for a quota increase at this time" | New Google Cloud regions require a usage history before Google allows more of them | Reuse a region the project has already used before, instead of requesting a brand-new one |
| A brand-new Cloud Run service shows "0" environment variables after a fresh deploy | Environment variables don't carry over automatically to a service in a new region | Re-paste the full Step 6 checklist as a new service is created |
| "Access blocked: Authorization Error" / `Error 400: origin_mismatch` when clicking "Sign in with Google" | The web address being used isn't on the Authorized JavaScript origins list for the Google OAuth client | See Step 19 — add the missing domain in Google Cloud Console → Credentials |
| Clicking "Sign in with Google" opens a popup to `accounts.google.com/gsi/transform` that stays blank forever | `helmet`'s default `Cross-Origin-Opener-Policy: same-origin` header blocks the popup from reporting back to the page | See Step 19 — already fixed in `server.js` (`crossOriginOpenerPolicy: 'same-origin-allow-popups'`); redeploy if still seen |
| Address box shows no suggestions at all, on any query | `VITE_GEOAPIFY_API_KEY` isn't set (locally or as a Cloud Run env var) | See Step 20 — get a free key at myprojects.geoapify.com |
| Feed's location box shows "Location search unavailable" | `VITE_GOOGLE_PLACES_API_KEY` isn't set (locally or as a Cloud Run env var) | See Step 21 |
| Feed location search picks a suggestion but shows zero/wrong issues | Either the key is missing "Places API (New)"/"Maps JavaScript API", or `scripts/backfillLocationGeo.js` hasn't been run yet against this database | See Step 21 |
| `CommandNotFoundException` on a line starting `MONGO_URI=...` | Mac/Linux syntax typed into PowerShell | See "Running a migration script on Windows" — set `$env:MONGO_URI` on its own line first |

---

## Current live configuration (snapshot)

*(A point-in-time summary — always trust the actual Cloud Console over
this if anything looks different later.)*

- **Live site:** `https://actonissues.com` — once `.com` also got a working
  Cloud Run domain mapping (added a week after `.blog`, both now mapped to
  the same `europe-west1` service and both show a green "Ready" status in
  the console), `.com` became the canonical URL. Visiting `actonissues.blog`
  or `www.actonissues.blog` now 301-redirects to the equivalent `.com` URL
  (see `server.js`) rather than serving a second live copy of the site —
  the `.blog` domain mapping itself is still there in Cloud Run, just no
  longer the one to link people to. The direct address
  `https://act-on-issues-458645747669.europe-west1.run.app` always works
  regardless of domain/certificate status, useful for testing.
- **Cloud Run service:** `act-on-issues`, region `europe-west1`,
  Execution environment: Second generation, Authentication: Allow public
  access, service account: `storage-uploader@actonissue-9009.iam.gserviceaccount.com`.
- **MongoDB Atlas:** cluster `Cluster0` (hosted on Google Cloud,
  `asia-south1`), database `actonissue`, app database user
  `actonissuesindia_db_user`, Network Access: `0.0.0.0/0`.
- **Google Cloud Storage:** bucket `actonissue-images`, same service
  account as above.
- **Email:** Brevo SMTP (`smtp-relay.brevo.com:587`) — see Step 10,
  currently unreliable until a domain-based sender is set up.
- **Domain:** `actonissues.com` (canonical, redirect target), plus
  `actonissues.blog` (still mapped, now just redirects to `.com`) — both
  registered and DNS-managed at GoDaddy.
- **Push notifications:** VAPID keys (Step 11) confirmed live on Cloud
  Run — verified working on the deployed site.
- **Email notifications for issue updates:** `SITE_URL` (Step 12)
  confirmed live on Cloud Run — these emails still inherit the same
  Step 10 deliverability problem as OTP/password-reset emails though.
- **Phone OTP login/signup (Firebase):** code is in place (Step 13), but
  `FIREBASE_PROJECT_ID` and the "Firebase Authentication Admin" IAM role
  are **not yet added to Cloud Run**, so phone sign-in won't work on the
  live site until that's done. Password and Email OTP are unaffected.
- **WhatsApp notifications (Step 16):** code is in place, but no Meta
  WhatsApp Business app has been created yet — `WHATSAPP_ACCESS_TOKEN`
  is unset everywhere, so this channel is currently a no-op. Bell icon,
  push, and email notifications are unaffected.
- **Google Sign-In (Step 19):** code is in place and auto-creates/links a
  `users` row on first sign-in, but the OAuth client's Authorized
  JavaScript origins list in Google Cloud Console needs to include every
  domain the site is actually reached from (see Step 19) — if that list
  is missing the current domain, sign-in fails with `origin_mismatch`.
- **Escalate to Authority + inbound replies (Step 17):** code is in place,
  but `actonissues.com` is not yet verified as a Brevo sending domain and
  Inbound Parsing hasn't been set up — escalation emails will send fine
  today (from the existing unverified `SMTP_FROM`), but replies won't be
  captured until Step 17's DNS/Brevo setup is done and
  `WEBHOOK_INBOUND_SECRET` is set on Cloud Run.

### Loose ends / optional cleanup (no rush, nothing is broken by leaving these as-is)
- The original `act-on-issues` service in `asia-south1` is still running
  and still fully working (just not the one the domain points to
  anymore) — safe to delete once you're confident `europe-west1` is
  stable, or keep as a backup.
- The `asia-south2` test service can be deleted — it was only useful for
  diagnosing the timeout issue above.
- Email sending needs the domain-based sender fix from Step 10 before
  it's fully reliable.

### If you want to add real screenshots to this file later
I wasn't able to save the actual screenshots from our conversation into
this file directly. If it's useful to have visuals for your own
reference, the screens most worth capturing are: the Cloud Run service's
main details page (shows region, URL, and status all in one place), the
**Domain mappings** list (shows the certificate status), and Atlas's
**Database Access** and **Network Access** pages. Save any image into
`docs/screenshots/` in this project and it can be linked into this file
with `![description](screenshots/filename.png)`.
