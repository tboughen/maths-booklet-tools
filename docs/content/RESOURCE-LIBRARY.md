# Resource library

The Resource library page (`/library`) lists every booklet, A3 worksheet, silent starter and skill sheet
we have made, at its newest version, by year and unit, so colleagues can find and share them. Tim chose
the design on 24 Nov 2026: year shelves by default, a search bar above, and a Map view of the whole
scheme as the alternative view.

## Where things live

| What | Where |
|---|---|
| Source list | `library/library.json` in the private `tboughen/mathsdock-bank` repository |
| Files | `library/files/y<year>/<unit>/<id>_<role>.<pdf or docx>` beside it |
| Served list | R2 bucket `maths-booklet-assets`, key `library/library.json` |
| Served files | the same bucket, `library/files/<sha256>/<name>` (never replaced) |
| Page | `src/library/` |
| Worker route | `/library-data/*` in `scripts/cloudflare/site-worker.mjs`, behind Cloudflare Access like `/bank/assets/*` |

The site never holds the files, so new resources need no website release. The page reads the served
list each visit.

## The source list

`schema` is `mathsdock-library/1`. `years` gives each year's units in teaching order, in named sections
(terms, then "Also for Year N" for starters, mock revision and similar shelves). Each entry in
`resources` is one resource:

```json
{ "id": "y9-a7-03-lesson-booklet", "year": 9, "unit": "A7", "lesson": "A7.03",
  "title": "Find the gradient of a straight line (positive)", "type": "lesson-booklet",
  "status": "waiting", "updated": "2026-11-22",
  "files": [{ "role": "pupil", "format": "pdf", "path": "y9/A7/y9-a7-03-lesson-booklet_pupil.pdf" }] }
```

- `type`: `unit-booklet`, `lesson-booklet`, `a3-worksheet`, `revision-lesson`, `starter` or `skill-sheet`.
- `status`: `ready` once Tim has passed it, otherwise `waiting` (shown as "Waiting for check" with an amber mark).
- `role`: `pupil`, `answers` (shown in pink) or `teacher-notes`; `format`: `pdf` or `docx`.
- One entry per resource: a new version replaces the files and the `updated` date. Older versions stay
  in the project folder only.
- Never add pupil data (class lists, names, marks).

## Adding or updating a resource

1. Copy the pupil, answers and teacher-notes files into `library/files/y<year>/<unit>/` with lower-case names.
2. Add or update the entry in `library/library.json`.
3. Check it: `node scripts/library/publish.mjs <bank>/library --dry-run`.
4. Commit to the bank repository and merge to its `main`.
5. Run the **Publish the Resource library** workflow (Actions, on `main`). It uploads only new files, then
   replaces the served list. Use its dry-run box to check without uploading.

The workflow runs in the `mathsdock-production` environment, which holds the R2 keys. It is never
dispatched by the autonomous loop (`scripts/loop/config.json`).
