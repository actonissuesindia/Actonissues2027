# Automated tests

## Running them

```powershell
cd D:\Act-On-Issues-new-version
npm test
```

That's it. About 20 seconds, and it ends with either

```
Test Files  3 passed (3)
     Tests  35 passed (35)
```

or a list of what broke, naming the test and what it expected. **Run it before
pushing anything.** If something is red, that thing is broken on the live site
once you push it.

`npm run test:watch` keeps running and re-checks whenever a file is saved —
useful while changing code, not needed otherwise.

### What it needs

MongoDB running locally (the same one `npm run dev` uses). The tests use a
**separate database called `actonissue_test`** and wipe it between tests, so
they never touch development or production data. `tests/setup.js` refuses to
start if pointed at a database whose name doesn't contain "test".

If your MongoDB lives elsewhere, set `TEST_MONGO_URI` before running.

## Two suites

`npm test` runs both:

- **server** — real HTTP requests through the real app against a throwaway
  database. Needs MongoDB running.
- **ui** — React components rendered in a simulated browser. **Needs no
  database**, because a render test that only runs when MongoDB happens to be
  up is a render test nobody runs.

Run one on its own with `npx vitest run --project ui`.

## What's covered, and why these areas

Each of these areas broke in production during August 2026. The tests exist so
the same failures can't come back unnoticed.

### `posting.test.js` — filing a report
The bug: a failed submission filed the report anyway while telling the reporter
it had failed, so they pressed the button again. Four copies of one report
reached the live site.

Every test checks **both** what the reporter was told and how many reports
actually exist — either alone would have passed while the bug was live. Covers
the normal case, photos, each way a submission can be refused (and that a
refusal files nothing), pressing the button repeatedly, two neighbours
reporting the same thing, and the notification system being down.

### `auth.test.js` — signing in
The bug: phone sign-in tidied up an old-format phone number as part of logging
in, and when that tidying failed it took the sign-in down with it — locking
someone out of an account they demonstrably owned, on every attempt.

Covers password sign-in and its refusals, and the three shapes of phone record
that used to fail: old format, the same number on two accounts, and a record
that can't be saved at all.

### `ui/chrome.test.jsx` and `ui/pages.test.jsx` — does it render at all
The bug: TopNav and Footer both called a helper neither imported. A bundler
treats an unknown name as a global rather than an error, so the build passed
and every visitor got a blank page. Every test was backend; not one rendered a
component.

These render the header, the footer and every public page and assert they come
up. Deliberately shallow — the claim that turned out to be false was simply
"this renders".

**Read this before adding more.** The first version of these tests passed
against the exact bug they were written for. They waited for "any link", which
the logo satisfies on the first paint — before the menu data arrived and the
broken code ever ran. So: wait for something that only exists *after* the page
has loaded its data, and always confirm a new test can fail by breaking the
thing it covers.

### `visibility.test.js` — who can see what
The bug: reports awaiting review were correctly hidden, but their comment
threads and moderation timelines were served to anyone who asked, with no
sign-in — staff names and rejection decisions included.

Covers every route that hangs off a report, for every kind of viewer:
anonymous, an unrelated signed-in person, the author, and staff.

## Writing more

`tests/helpers.js` has the pieces: `createUser`, `createIssue`, `signIn` (a
real sign-in through the API, keeping the session cookie), `postIssue`.

Two habits worth keeping:

- **Test what a person experiences**, not what a function returns — these go
  through real HTTP requests, real sessions and the real database, so they fail
  when the app's actual behaviour changes.
- **Check a new test can fail.** Break the code it covers on purpose and
  confirm the test goes red, then undo it. A test that passes either way is
  worse than no test, because it looks like cover.
