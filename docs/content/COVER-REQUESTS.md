# Cover lesson requests

Tim chose this on 26 Nov 2026 (cover template and Cover library 27 Nov). A teacher opens **Resource library › Request cover booklet**
(the teal button, top right), which shows the **Create cover booklet** page, describes the lesson in their own words and presses
**Check and build**. A cloud task builds one cover lesson and puts it in the **Cover library** beside the form, usually within 15 minutes. There is no daily cap. Every request is
logged, and Tim gets an email about each one.

## What a teacher does

1. Choose the year group. For Years 9 to 11, also choose Foundation or Higher.
   Give the **Class** (e.g. 10X2), **Room** (e.g. M4) and **Date** of the lesson. All three are required (up to 20
   characters each; the date from today to 30 days ahead, starting on the next weekday). They print at the top right of
   the booklet's first side: "Class 10X2" over "Room M4 · Fri 28 Nov".
2. Describe the lesson. Three suggestions fill the box for them to complete: "Revise our unit up to a
   lesson", "Mock revision" and "Use the file I've attached". Don't call these "starters", because a
   starter is something else in teaching.
3. Optionally, attach a PowerPoint, Word or PDF file. Only its words are read, on the teacher's own
   device, and sent with the request (up to 20,000 characters). Its pictures are not sent.
4. Tick "This is cover work for myself or a colleague." The page says only "Requests are logged."
   (Tim, 26 Nov: keep it gentle).
5. **Check and build** shows one check sentence. If the text names a unit from the year's list (NP17,
   lesson 3, or NP17.03), the sentence lists the objectives from the first lesson up to that one. If only
   the unit is named, the teacher chooses the lesson the class is on. So nothing later than that lesson is
   revised. If no unit is named, the build follows the description. **Yes, build it** sends the request.

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
- No five-reviewer round (Tim, 26 Nov). Speed matters, and Tim checks each one in Waiting.

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
  line, then the year and tier, who asked and the state (Saved, Building, Ready, Stopped). A Ready entry has its pupil
  and answers PDF links. Entries are ordered by lesson date, most recent first.
- Entries whose lesson date is more than 7 days ago fold into **Older cover booklets**.
- A library editor (`LIBRARY_EDITORS`) sees **Delete cover booklet** on each built one, then **Yes, delete it**.
  POST `/api/library/cover` with `{ action: "remove", id }` adds the id to `library/cover-removed.json`
  in R2 and the page stops listing it. The page reads that list with GET `/api/library/cover?only=removed`,
  which needs only R2, so a GitHub outage never brings deleted lessons back. The files stay in the private store, so a deletion can be undone
  by taking the id out of that file.
