# Cover lesson requests

Tim chose this on 26 Nov 2026. When a teacher is absent, they open **Resource library › Request cover**,
describe the lesson in their own words and press **Check and build**. A cloud task builds one cover lesson
and puts it in the library as Waiting, usually within 15 minutes. There is no daily cap. Instead, Tim is
told about every request.

## What a teacher does

1. Choose the year group. For Years 9 to 11, also choose Foundation or Higher.
2. Describe the lesson. Three suggestions fill the box for them to complete: "Revise our unit up to a
   lesson", "Mock revision" and "Use the file I've attached". Don't call these "starters", because a
   starter is something else in teaching.
3. Optionally, attach a PowerPoint, Word or PDF file. Only its words are read, on the teacher's own
   device, and sent with the request (up to 20,000 characters). Its pictures are not sent.
4. Tick "I confirm I'm absent and this is cover for my own class."
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
- Builds go into the library as Waiting, on the year's "Review and cover" shelf.
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
  says Tim will start the build. He can start it from the task page, pasting in the issue number.
- `COVER_TASK_BETA` is optional. It overrides the API's beta header if that ever changes.

Each build uses about 12 to 15 minutes of Claude work from Tim's plan. It costs no extra money.

## What the task does

1. Reads the issue. It stops if the issue is closed or not labelled `cover-request`.
2. Fetches `maths-booklet-tools` main and follows the booklet builder skill and handbook for one
   8-side lesson, with `lessonName: "Cover lesson"` and `lessonNumbered: false`. It uses the year's
   scheme and tier, the teacher's description and the confirmed check sentence, and the attached file's
   text when there is one. It never teaches objectives after the lesson the class is on. It runs no
   reviewers, but the build checks must pass and it checks every answer itself.
3. Builds with `PDF_ONLY=1` (pupil and answers PDFs).
4. Checks the issue is still open, then adds the lesson to the library as in `RESOURCE-LIBRARY.md`:
   type `revision-lesson`, unit `REVIEW`, a new id, status `waiting`, and a note naming the request.
   It then dispatches **Publish the Resource library**.
5. Comments the library link on the issue, adds `cover-ready` and closes it.
