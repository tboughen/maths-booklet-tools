# Cover lesson requests

Tim chose this on 26 Nov 2026 (cover template and Cover library 27 Nov, page tidy 28 Nov). A teacher opens **Resource library › Cover**
(the teal button, top right; cover stays inside the Resource library, Tim 28 Nov), which shows the **Create cover booklet** page, describes the lesson in their own words and presses
**Check and build**. A cloud task builds one cover lesson and puts it in the **Cover library** beside the form, usually within 15 minutes. There is no daily cap. Every request is
logged, and Tim gets an email about each one.

## What a teacher does

1. Choose the year group. For Years 9 to 11, also choose Foundation or Higher.
   Give the **Class** (e.g. 10X2), **Room** (e.g. M4) and **Date** of the lesson. All three are required (up to 20
   characters each; the date from today to 30 days ahead, starting on the next weekday). They print at the top right of
   the booklet's first side: "Class 10X2" over "Room M4 · Fri 28 Nov".
2. Describe the lesson. Four suggestions fill the box for them to complete: "Revise our unit up to a
   lesson", "Mock revision", "Sparx codes" and "Use the file I've attached". Sparx codes (U449) in the
   text are named in the check sentence. Longer help sits behind small (i) tips (hover, focus or tap),
   so the form stays short. Don't call these "starters", because a
   starter is something else in teaching.
3. Optionally, attach a PowerPoint, Word or PDF file. Only its words are read, on the teacher's own
   device, and sent with the request (up to 20,000 characters). Its pictures are not sent.
4. Read the check sentence under the box, which updates as they type. If the text names a unit from the
   year's list (NP17, lesson 3, or NP17.03), it lists the objectives from the first lesson up to that one. If
   only the unit is named, an **Up to and including** list appears for the lesson the class is on. So nothing
   later than that lesson is revised. If no unit is named, the build follows the description.
5. Tick "This is cover work for myself or a colleague." and press **Check and build**. That sends the
   request; there is no second confirm step (Tim, 28 Nov).

## Safeguards

- Only staff who are signed in can use it (Cloudflare Access). The request records their sign-in email.
- Every request is an issue in `tboughen/mathsdock-bank`, labelled `cover-request` and assigned to Tim,
  so GitHub emails him. The issue is also the log. The page shows the 30 most recent requests, with
  names but never email addresses.
- **Stop:** Tim closes the issue. The task checks that the issue is still open before it builds and
  again before it publishes.
- A request can only build a single lesson. Every page says **Cover lesson** where the lesson number
  usually goes (`lessonNumbered: false`, `lessonName: "Cover lesson"`). The end band says "End of cover
  lesson". The files are PDF only, so the booklet can't pass as a lesson of a unit.
- Builds are stored as Waiting on the year's `REVIEW` shelf, but the page shows them only in the Cover library.
- The description and the attached file's words are written by staff and passed to a task that can
  publish to the library. The task treats them as data, never instructions, and every build lands as
  Waiting, so Tim's check is the last safeguard.
- No Opus reviewers (Tim, 26 and 28 Nov), to save tokens and time. The script checks in `build-booklet.mjs`
  (including `booklet-checks.mjs`) still run, take seconds, and must pass. The task follows the current booklet
  builder skill and tools on main, so improvements to booklet building reach cover lessons automatically.

## How it runs

| Part | Where |
|---|---|
| Page | `src/library/CoverRequest.tsx`, with its check and file reading in `src/library/cover.ts` |
| Worker route | `/api/library/cover` in `scripts/cloudflare/cover-requests.mjs`. GET returns the log, POST sends a request |
| Alert and log | issues labelled `cover-request` (plus `cover-building` while building and `cover-ready` when done) |
| Build | a saved cloud task named "Build a cover lesson", started by the Worker with the request's issue number |

Worker secrets (`npx wrangler secret put <NAME>`, on production):

- `REPORT_GITHUB_TOKEN`, which is already set for feedback. It needs issues read and write.
- `COVER_TASK_URL` and `COVER_TASK_TOKEN`: the saved task's API trigger address and key, from its
  settings page on claude.ai. Without them, requests are saved and Tim is still emailed, and the page
  says the lesson will be built shortly. Tim starts it by pressing Run on the task with nothing typed:
  the task then builds the oldest open request that is not building or ready.
- `COVER_TASK_BETA` is optional. It overrides the API's beta header if that ever changes.

Each build uses about 12 to 15 minutes of Claude work from Tim's plan. It costs no extra money.

## What the task does

1. Reads the issue. It stops if the issue is closed or not labelled `cover-request`.
2. Fetches `maths-booklet-tools` main and follows the booklet builder skill and handbook for one
   8-side lesson, with `lessonName: "Cover lesson"` and `lessonNumbered: false`, using the cover template below. It uses the year's
   scheme and tier, the teacher's description and the confirmed check sentence, and the attached file's
   text when there is one. It never teaches objectives after the lesson the class is on. It runs no
   reviewers, but the build checks must pass and it checks every answer itself.
3. Builds with `PDF_ONLY=1` (pupil and answers PDFs).
4. Checks the issue is still open, then adds the lesson to the library as in `RESOURCE-LIBRARY.md`:
   type `revision-lesson`, unit `REVIEW`, a new id, status `waiting`, and the note
   `Cover request #N. Class 10X2, room M4, 2026-11-28.` (the Cover library reads the class, room and date from it
   when the request has left the log).
   It then dispatches **Publish the Resource library**.
5. Comments the library link on the issue, adds `cover-ready` and closes it.

## Cover template (Tim, 27 Nov)

A cover lesson is the normal 8-side lesson booklet with these changes:

- The lesson sets `cover: { className, room, date }` (date `YYYY-MM-DD`) from the request's hidden marker. Older requests
  without them are built without `cover`, with the normal template.
- The check-in prints as the **Silent starter**: "Silent starter START" and "End of silent starter STOP". Its questions are
  numbered **1 to 8** (`numbering: "restart"`, never `letters`). The stage questions restart at 1 too.
- **No We do.** After each worked example (I do) the questions carry straight on. `build-booklet.mjs` fails a cover lesson
  with any We do card (B11).
- The start block's top right shows "Class 10X2" over "Room M4 · Fri 28 Nov". A long room moves the date to a third line;
  type is never shrunk, and a name too long to fit is a build error.

## Cover library (Tim, 27 Nov)

Cover work never appears on the shelves, in search or on the Map. It is listed only in the **Cover library**, to the right
of the form on the Create cover booklet page:

- Cover work is a library resource on the `REVIEW` shelf whose note starts `Cover request #N` (built from request N) or
  `Cover lesson` (made by hand, such as the two Year 9 A7 cover lessons of 26 and 27 Nov). Nothing else is ever treated as one.
- The list merges the request log with these resources. Each entry shows the class, room and lesson date on its first
  line ("Cover for Fri 28 Nov · Class 10X2 · Room M4"), then the year and tier, who asked and when, and the state
  (Saved, Building, Ready, Stopped). A Ready entry has its pupil and answers PDF links.
- Entries are grouped by the date the cover is for: **Today**, **Coming up** (soonest first), **Last 7 days**
  (most recent first), and **Older cover (n)**, folded.
- While a lesson builds, a bar fills to 90% over 16 minutes ("About 12 minutes left"), counted from when the
  request was sent (the Worker starts the build then); after that it says "Taking longer than usual, nearly there". It completes when
  the PDFs are ready.
- A library editor (`LIBRARY_EDITORS`) sees **Delete cover booklet** on each built one, then **Yes, delete it**.
  POST `/api/library/cover` with `{ action: "remove", id }` adds the id to `library/cover-removed.json`
  in R2 and the page stops listing it. The page reads that list with GET `/api/library/cover?only=removed`,
  which needs only R2, so a GitHub outage never brings deleted lessons back. The files stay in the private store, so a deletion can be undone
  by taking the id out of that file.
