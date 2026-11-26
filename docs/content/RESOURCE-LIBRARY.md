# Resource library

The Resource library page (`/library`) lists every booklet and silent starter we have made, at its
newest version, by year and unit, so colleagues can find and share them. Tim chose the first design on
24 Nov 2026 (year shelves, a search bar above, a Map view) and the second the same night: booklets
only (no A3 worksheets, teacher notes or bespoke skill sheets), lesson states as rings on the unit
cards and squares inside, versions, parts, history, and staff feedback closed by a nightly run.

## Where things live

| What | Where |
|---|---|
| Source list | `library/library.json` in the private `tboughen/mathsdock-bank` repository |
| Files | `library/files/y<year>/<unit>/<name>.<pdf or docx>` beside it |
| Served list | R2 bucket `maths-booklet-assets`, key `library/library.json` |
| Served files | the same bucket, `library/files/<sha256>/<name>` (never replaced) |
| Feedback | open issues labelled `library-feedback` in `tboughen/mathsdock-bank` |
| Page | `src/library/` |
| Worker routes | `/library-data/*` and `/api/library/feedback` in `scripts/cloudflare/site-worker.mjs` (feedback in `library-feedback.mjs`), behind Cloudflare Access like `/bank/assets/*` |

The site never holds the files, so new booklets and new versions need no website release. The page
reads the served list and the open feedback each visit.

## What the page shows

- Each lesson has one of four states: grey, not made; amber, waiting for Tim's check; violet, open
  feedback to act on (whatever the lesson's own state); green, ready.
- A unit card has a ring with one segment per lesson of its Main version, a break where each later part
  starts, a pill for each other version, and "Now" on the unit the year group is on (an estimate).
- The unit panel has version tabs (each version is checked on its own), part downloads with their
  squares, and one row per lesson with its files, history and feedback. The Map shows every unit as
  squares, one row per version.
- Term headings marked "(estimate)" come from class pace on 24 Nov 2026 (Y7 about 3 lessons a week,
  Y8 2.4, Y9 3.3, Y10 2.9). The scheme's thick lines are assessment points, not term ends. Year 11
  follows the legacy Stage 11 scheme this year, so it has one list with no terms.

## The source list

`schema` is `mathsdock-library/2`. `years` gives each year's units in teaching order, in named sections
(terms with `"estimate": true`, then "Also for Year N" for starters, mock revision and similar shelves),
and `now`, the unit the year group is on. A scheme unit lists its planned `lessons` (from
`schemes/school.json`) and may split into `parts`:

```json
{ "code": "A7", "title": "Algebraic proficiency: visualising",
  "lessons": [{ "code": "A7.01", "title": "Plot graphs of functions of the form y = mx + c" }],
  "parts": [{ "name": "Part 1", "from": "A7.01", "to": "A7.07" }, { "name": "Part 2", "from": "A7.08", "to": "A7.13" }] }
```

Each entry in `resources` is one booklet:

```json
{ "id": "y9-a7-03-lesson-booklet", "year": 9, "unit": "A7", "lesson": "A7.03", "version": "Main",
  "title": "Find the gradient of a straight line (positive)", "type": "lesson-booklet",
  "status": "waiting", "updated": "2026-11-22", "note": "Rebuilt with three stages",
  "files": [{ "role": "pupil", "format": "pdf", "path": "y9/A7/y9-a7-03-lesson-booklet_pupil.pdf" }],
  "history": [{ "updated": "2026-11-18", "note": "First booklet version",
    "files": [{ "role": "pupil", "format": "pdf", "path": "y9/A7/y9-a7-03-lesson-booklet-2026-11-18_pupil.pdf" }] }] }
```

- `type`: `unit-booklet`, `lesson-booklet`, `revision-lesson` or `starter`. A unit booklet for one part
  names it in `part`.
- `version`: `Main` unless named (`Foundation`, `Higher`, `Extra challenge (9X)`). A new version is a new
  entry with the same unit and lesson and its own `id`; its tab and pill appear by themselves.
- `status`: `ready` once Tim has passed it, otherwise `waiting`.
- `role`: `pupil` or `answers` (shown in pink); `format`: `pdf` or `docx`.
- Replacing a booklet: give the new files new names, move the old `files`, `updated` and `note` into
  the front of `history`, and set `status` to `waiting`. Never overwrite or delete an old file: staff
  can open every earlier version, and "Make current again" brings one back.
- Never add pupil data (class lists, names, marks).

## Feedback

Anyone signed in can read and add comments on a lesson (per version) or on a whole unit's structure.
The Worker keeps each thread as one issue labelled `library-feedback` (plus `lesson` or `unit`) with a
hidden marker naming the year, unit, version and lesson; comments carry the sender's sign-in email in
a hidden marker and show only their name. It uses the `REPORT_GITHUB_TOKEN` Worker secret
(`docs/release/STAFF-SIGN-IN.md`); without it the page says feedback isn't switched on yet.

- **The status switch** (Tim, 25 Nov): every made lesson and every unit booklet has **Waiting ·
  Feedback · Checked**, the lit part in the row's colour, with a line saying who set it. Colleagues who
  are not editors see only the lit part. **Checked** turns that version green at once and closes its
  open comments (on a queued lesson it asks first, then cancels the rebuild). The Worker keeps checks in
  `library/checks.json` in R2 (`{ id: { updated, by, at } }`); the page shows a booklet ready when its
  check names its current `updated` date, so a rebuilt booklet goes back to amber by itself. Publishing
  never touches this file. **Feedback** lights at once and opens the comment box; **Cancel** (or
  closing the box) before sending puts it back. A sent comment keeps it (and takes any check off). **Waiting** is the undo: it removes the check, or,
  after asking, closes the comments. On screens under 600 px only the lit part keeps its word.
- **Unit booklets** have their own row above their lessons, keyed by part name (`booklet`: "Part 1",
  or "Unit booklet" for a unit in one booklet). Their comments are about the booklet's own pages (cover,
  contents, topic introduction, Know it, Do it) and how the lessons are put together; issues carry the
  label `booklet`. Comments on the unit's structure stay separate.
- **Ask for this** on a lesson not made yet opens a thread on it; requests show under "Asked for" in
  Feedback to act on.
- **Delete** (anyone, on their own comments): the comment hides at once with Undo, and is deleted after
  five seconds. A thread left with no comments closes.
- **Queue for tonight** adds the label `queued`.
- **Make current again** comments with the date of the earlier version and adds `queued`.
- Unit comments: **Agree: plan the change** adds `agreed`; **Keep as it is** closes. Unit comments are
  never queued: they wait for Tim's decision in a planning thread.
- Only the people named in the Worker secret `LIBRARY_EDITORS` (comma-separated emails, set with
  `npx wrangler secret put LIBRARY_EDITORS`) can queue, restore and close; without it nobody can.
  Everyone signed in can comment.

### The nightly run

Nothing runs on its own (Tim, 25 Nov 2026). At about 10 PM UK time Claude checks for open issues
labelled `library-feedback` and `queued` and, only if there are some, asks Tim on a card. If he says
run, for each one it rebuilds the lesson from the comments to the booklet standard (or, for "Make current
again", copies the earlier files forward as the newest version), updates the bank list as above with
`status: "waiting"`, publishes, comments what changed on the issue and closes it. It posts a summary in
its thread and the project chat. Nothing is shared as ready until Tim checks it.

## Adding or updating a booklet

1. Copy the pupil and answers files into `library/files/y<year>/<unit>/` with lower-case names.
2. Add or update the entry in `library/library.json`.
3. Check it: `node scripts/library/publish.mjs <bank>/library --dry-run`.
4. Commit to the bank repository and merge to its `main`.
5. Run the **Publish the Resource library** workflow (Actions, on `main`). It uploads only new files, then
   replaces the served list. Use its dry-run box to check without uploading.

The workflow runs in the `mathsdock-production` environment, which holds the R2 keys. It is never
dispatched by the autonomous loop (`scripts/loop/config.json`). The served list's schema must match the
live page: publish a list of a new schema only after the website release that reads it. (The page
still reads a schema 1 list, so the release can go first.)
