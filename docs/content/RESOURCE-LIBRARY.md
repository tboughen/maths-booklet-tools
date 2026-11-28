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
| Edits saved from the Booklet builder | `/api/library/edit` (`library-edits.mjs`), R2 `library/edits/` and `library/edits.json` |
| Cover requests | `/api/library/cover` (`cover-requests.mjs`) and the Request cover view: see `COVER-REQUESTS.md` |

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

- `type`: `unit-booklet`, `lesson-booklet`, `revision-lesson` or `one-off` (below). A unit booklet for one
  part names it in `part`.
- `version`: `Main` unless named (`Foundation`, `Higher`, `Easier (9X)`). Every version other than Main is an
  adaptation (below). A new one is a new entry with the same unit and lesson and its own `id`; its tab and
  pill appear by themselves.
- `adaptation` (optional): `{ "kind": "easier" | "harder" | "different", "from": "2026-11-25" }`, the kind a
  teacher asked for and the date of the Main booklet it was built from.
- `status`: `ready` once Tim has passed it, otherwise `waiting`.
- `role`: `pupil` or `answers` (shown in pink), `format`: `pdf` or `docx`; or `role` `source` with `format`
  `json`, the lesson source the build wrote, which shows as **Edit** (see "Editing a booklet on the site").
- Replacing a booklet: give the new files new names, move the old `files`, `updated` and `note` into
  the front of `history`, and set `status` to `waiting`. Never overwrite or delete an old file: staff
  can open every earlier version, and "Make current again" brings one back.
- Never add pupil data (class lists, names, marks).

## One-offs

Tim chose this on 28 Nov 2026. Material that is not a unit lesson (mock revision, assessment follow-up
sheets, silent starters, new non-lesson resources from lesson adaptations) is a `one-off` on its year's
**One-offs** shelf (unit `ONEOFFS`, in the "Also for Year N" section). Cover lessons are not one-offs:
they stay in the Cover library (`COVER-REQUESTS.md`).

```json
{ "id": "y11-p1-revision-one-off", "year": 11, "unit": "ONEOFFS", "type": "one-off", "title": "Paper 1 revision",
  "class": "11X2", "used": "2026-11-30", "askedBy": "Ann Lee", "owner": "ann.lee@school.example",
  "status": "waiting", "updated": "2026-11-28", "files": [{ "role": "pupil", "format": "pdf", "path": "y11/ONEOFFS/y11-p1-revision_pupil.pdf" }] }
```

- `used` (the day it is taught) is required unless `kept` is `true`. `class`, `askedBy` (a name) and `owner`
  (the asker's lower-case sign-in email) are optional. No lesson code, part or version.
- The shelf shows the coming ones first; each folds into **Past one-offs** 7 days after `used` (or `updated`
  when there is no date). `kept: true` never folds (silent starters).
- Files may sit in any folder of the year (`y11/ONEOFFS/`, or where they were first filed), so nothing moves.
- **Delete**: the `owner` or a library editor. It goes on the same deleted list as cover lessons
  (`library/cover-removed.json` in R2); the files stay in the private store.
- **Keep as booklet** (editors): comments on the one-off's feedback thread (keyed by its id as `booklet`).
  Queue it and the nightly run rebuilds it as a real booklet in the unit the comments name, with versions.
- The status switch and comments work as for a unit booklet.

## Adaptations

Tim, 28 Nov 2026 (mock-up https://claude.ai/artifact/Qh2r2AWPkQnwf3YWQyeZQ8, option A). A teacher asks for a
different version of one lesson, or a whole unit, because it is too hard or too easy for a class or simply to
teach it another way. Adaptations are the library's versions: tabs beside Main, each checked on its own, with
feedback and history as usual.

- **Asking:** "Adapt" on any made lesson row, or "Adapt whole unit" (scheme units only). The form asks what
  kind (Easier, Harder, Different approach), for which class (optional), and what should change. It can add
  the lesson to an adaptation the unit already has; on an adaptation's tab that is the default.
- **Naming:** kind and class, as "Easier (9X)"; a different approach may use the teacher's own short name
  ("Bar models first (9X)"). Names follow the version rule: up to 40 letters, digits and spaces.
- **Sending:** `POST /api/library/adapt` (`scripts/cloudflare/adapt-requests.mjs`) opens an issue in the bank
  repository, labelled `adapt-request` and assigned to Tim, with a hidden marker giving year, unit, lesson
  (null for the whole unit), kind and name. GitHub emails Tim. Nothing builds by itself: Tim starts the build.
  `GET /api/library/adapt?year=9&unit=A7` lists the unit's open requests under "Adaptations asked for".
- **Building:** build from the current Main booklet with the booklet builder, keep the lesson structure,
  change what the request says, and add it to the bank list under the request's `version` name with
  `adaptation` set and `status` `waiting` (no teacher notes). Then close the issue with a comment.
- **Showing:** on an adaptation's tab, lessons it leaves as they are show Main's booklet greyed ("Same as
  Main"), so the whole unit reads in one list. Squares, rings and summaries count only its own lessons.
- A brand-new resource that is not a version of a lesson belongs with the one-off materials, not here.

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

## Editing a booklet on the site

Tim, 28 Nov 2026 (plan https://claude.ai/artifact/99nTtHAKFEhdDexwLSeZMw). A booklet whose files include its
lesson source shows **Edit** beside its downloads. Edit opens it in the Booklet builder (`/booklets?open=…`),
where a colleague clicks a card on the page to change it and sees the build's own checks live. **Save to
library** asks what they changed and sends the lesson source to `/api/library/edit` (`library-edits.mjs`):

- The Worker keeps it in R2 at `library/edits/<sha256>/<resource id>.json` (never replaced), adds it to
  `library/edits.json` (who, when, note, version, the issue) and opens an issue in the bank repository
  labelled `library-edit`, assigned to Tim. The library list itself does not change.
- To take an edit: download the saved source (`/library-data/edits/…`, or R2), build it with
  `build-booklet.mjs` and its checks, add the files to the library as a new version of that resource
  (`status: "waiting"`, note naming who edited it) with its `source` file, publish, comment and close the
  issue. Close it without building to turn it down. Nothing is shared as ready until Tim checks it.

Builds add the lesson source to each library entry as a file with `"role": "source", "format": "json"`
(for example `y9/A7/y9-a7-03-lesson-booklet_source.json`). It is never offered as a download or put in a
unit's zip; older entries without one simply have no Edit button.

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
