# Per-question worked solutions

The Question bank supports an optional authored **Worked solution** alongside the
official mark scheme. Questions remain the initial view. Each answer type is
revealed deliberately and replaces the current resource in the same pane. Hiding
it returns to Question. Switching question, filters, crossover identity or reloading
opens Question. Worked-solution visibility also resets on browser/section navigation;
the existing mark-scheme session is retained when returning to the same question
from another section. Ordinary question links never encode an answer role. Display
mode includes the same reveal controls.

Questions without a registration show a disabled **Show worked solution** and
**Not available yet**. This feature does not populate the bank. Existing paper
exports and paper-review previews continue to use questions and official schemes.
Copy image/PNG uses the selected resource; **Whole question** includes all its
pages. The options menu offers its complete **Worked solution PDF** separately
from **Source question PDF**. Existing canvas limits and PDF fallbacks apply.

## Resource contract

`BankQuestion.workedSolution` is optional for compatibility with existing
catalogues. When present it is an atomic object:

```json
{
  "schemaVersion": 1,
  "layout": "individual-question",
  "revision": "immutable-solution-revision",
  "basedOnQuestionRevision": "exact-bank-question-revision",
  "pdf": "bank/assets/worked/QUESTION_ID/REVISION/solution.pdf",
  "pdfSha256": "EXACT_64_CHARACTER_LOWERCASE_SHA256",
  "views": [
    {
      "id": "solution-page-1",
      "label": "Question 12",
      "page": 1,
      "width": 595.28,
      "height": 841.89,
      "preview": "bank/assets/worked/QUESTION_ID/REVISION/solution-1.png",
      "description": "Question 12, all parts and worked solution",
      "sourcePages": [8]
    }
  ]
}
```

This example contains placeholders, not an accepted registration. Use the actual
native PDF dimensions in points. `page` is the one-based page in the derivative
PDF; `sourcePages` contains its one original full-paper page number. Every PDF
page has exactly one view in derivative order. With `layout: "individual-question"`,
each view names one or more positive source page numbers in ascending order;
a source page can occur in multiple views when blocks are composed or continued.
Record purposeful repeated context in `repeatedContext` and bind the full owned
block/transform mapping in the editable recipe. Retained legacy solutions without
`layout` keep their existing one-source-page/strictly-increasing validation.
Continuation pages 8/9 become derivative pages 1/2. Revisions are bounded
nonempty identifiers using letters, digits, `_` and `-`. Hashes use lowercase hex.

Keep the bank question revision and existing question/scheme resources unchanged
when adding an attachment. The solution has its own immutable revision. Changing
question content invalidates the solution's base revision; reconcile and review it
explicitly rather than transferring an old answer to new content. Every crossover
appearance needs its own registration, even if identical file bytes deduplicate
in content-addressed storage. No equivalent-ID fallback is used.

## Prepare the individual resource

Create one whole-question resource containing every target part, required prompt,
figure, context, checked black working and nearby dark-pink TF09 guidance.
Compose owned native source blocks at 1:1, extending prompt-only bounds to include
working and notes. Exclude neighbouring printed questions and their worked
overlays. Include every target continuation in the same question resource/PDF.
Produce physical derivative pages with matching PDF/PNG dimensions; CSS clipping,
white masks or changing only a CropBox/preview do not establish correct output.
Check actual viewer, copy and download routes. Preserve the checked full-paper
master and editable bundle unchanged as source evidence.

Check every final page in colour and greyscale, its original glyphs/positions,
mathematics, mark logic and neighbour-answer isolation under the current method
rulebook. Retain source/checked-paper hashes and a review record tied to the exact
target PDF, PNG hashes and source page mapping. Review flags remain nonblocking
under the rulebook; mathematical defects must be repaired. The registration helper
does not solve questions, inspect mathematical correctness or prove target-only
content automatically. Its review-evidence hashes identify the operator's retained
checks, which must actually exist and refer to these bytes.

## Stage a batch locally

Use Node 24 with the repository's locked dependencies. The command produces a
new directory containing a **catalogue proposal**, new assets and `receipt.json`.
It never edits the input catalogue, uploads objects or deploys a website.

```powershell
node scripts/bank/register-worked-solutions.ts `
  "--catalogue=C:/absolute/current/catalogue.json" `
  "--batch=C:/absolute/task/batch.json" `
  "--public=C:/absolute/asset-input/public" `
  "--output=C:/absolute/task/staged-batch-001"
```

Use the current reviewed **source** catalogue from the candidate checkout, after
reconciling its IDs/revisions with the actual live catalogue. The live catalogue
has content-addressed URLs; it is not a replacement for source paths whose files
are held locally.

The input public directory contains files at the relative paths in the solution.
The batch format is:

```json
{
  "schemaVersion": 1,
  "batchId": "past-paper-batch-001",
  "registrations": [
    {
      "questionId": "EXACT_BANK_QUESTION_ID",
      "expectedQuestionRevision": "EXACT_BANK_QUESTION_REVISION",
      "solution": { "...": "complete workedSolution object above" },
      "files": [
        { "path": "bank/assets/worked/QUESTION_ID/REVISION/solution.pdf", "sha256": "ACTUAL_PDF_SHA256" },
        { "path": "bank/assets/worked/QUESTION_ID/REVISION/solution-1.png", "sha256": "ACTUAL_PNG_SHA256" }
      ],
      "evidence": {
        "sourcePdfSha256": "ACTUAL_ORIGINAL_PAPER_SHA256",
        "checkedPaperPdfSha256": "ACTUAL_CHECKED_ALL_ANSWERS_PAPER_SHA256",
        "reviewRecordSha256": "ACTUAL_TARGET_REVIEW_RECORD_SHA256",
        "targetOnly": true,
        "fullOriginalPages": false,
        "resourceScope": "individual-whole-question",
        "recipeSha256": "ACTUAL_EDITABLE_COMPOSITION_RECIPE_SHA256",
        "allPartsChecked": true,
        "neighbourQuestionsExcluded": true
      }
    }
  ]
}
```

List each unique referenced PDF/PNG exactly once in `files`. The helper validates
IDs/base revisions, complete view metadata, safe contained paths, exact hashes,
actual PDF page count/geometry (unrotated unit-point pages without derivative
CropBox clipping), PNG decoding and preview proportions before
publishing any proposal directory. Individual-question previews also accept
independent upward pixel rounding on each axis only when both dimensions admit
one uniform native render scale; stretched images still fail. Legacy preview
validation is unchanged. Byte snapshots feed the staged files and
receipt. Duplicate IDs, a changed question, differing existing solution, missing
file or failed check leaves no final output. A repeated exact registration is an
`unchanged` no-op; use a new output directory for its receipt. New registrations
must declare individual-question layout and truthful individual review evidence.
Legacy full-page attachments remain readable and can be repeated exactly with
their historical full-page evidence; they cannot be newly added or substituted.
Never overwrite a previous batch or resolve a conflict by changing only its
expected revision.

## Guarded replacement

To correct an existing attachment, include `expectedPreviousSolution` containing
the complete exact previous `workedSolution` object, alongside the new `solution`.
Keep `expectedQuestionRevision` unchanged and freshly reconciled. The helper
compares the entire expected prior object, including views and hashes, with the
current attachment. A different or absent attachment rejects the proposal.

Use a new immutable solution revision and new PDF/preview paths. Do not remove the
old attachment first, edit a retained revision's files, or bypass catalogue-rebuild
guards. The receipt records `replaced` with the old/new objects; `added` and
`unchanged` remain separate. An exact repeat after successful replacement is a
no-op even though the supplied expected-old object is now historical. It must
still be well formed and identify distinct old assets/revision.

All entries and asset bytes are validated before the final proposal directory
appears. A failed batch leaves live/input data untouched. Keep both old and new
manifests for later authorised publication and recovery. This local helper does
not upload, qualify, merge or deploy anything.

The staged catalogue preserves unrelated metadata and appearance identities. Its
version changes when attachments are added. The receipt binds the input catalogue,
batch, proposed catalogue, source/review hashes, per-ID action and all asset hashes.
It records `staged_not_published`; it is not an upload or live-acceptance receipt.

## Preserve attachments during catalogue regeneration

If another importer regenerates question records, use the same staging command
with `--proposed-catalogue=C:/absolute/regenerated/catalogue.json`. The current
catalogue remains `--catalogue`. An empty `registrations` array is valid for a
preservation-only pass. The shared `preserveWorkedSolutions` guard restores omitted
attachments for unchanged IDs/revisions and refuses removed, changed or conflicting
attached questions. Integrate the guarded proposal, never the unguarded rebuild.
No historical/stopped authoring controller is reactivated by this feature.

## Qualification and publication

Integrate reviewed proposals and their assets into an owned current-main candidate.
Reconcile the live catalogue and source revisions again before doing so; a stale
local snapshot is not live authority. Follow [the release pipeline](../release/RELEASE-PIPELINE.md)
and the workspace publication rulebook. Both preview and Cloudflare builds verify
registered solution files. `bankAssets.ts` includes all solution PDFs/previews;
`release.ts` rewrites them to the existing immutable SHA-256 keys. The transformation
identity binds their shared schema and file validator, so old inventory reuse is
invalidated when that implementation changes.

Preserve all classifier-selected checks. These publisher/transform changes are
conservative infrastructure changes; do not invent a narrow audit exemption.
Keep qualification, merge, deployment, object upload and actual live verification
as separate recorded stages. An empty-slot feature release proves no production
solution content. The later upload tranche must verify each newly adopted object's
public bytes/headers/ranges and actual HTTPS reveals, including shared-page and
multi-page cases. Keep resumable batch receipts and exact outstanding IDs.

There is no new public upload API, storage service, paid dependency, schema upgrade
for diagram documents, bulk worked-solution booklet export or automatic sharing.

## Where the files are committed

`public/bank/assets/` is the `tboughen/mathsdock-bank` repository, linked as a Git
submodule. Registering resources therefore takes two commits: commit and push the
new files inside `public/bank/assets` first, then commit `catalogue.json` and the
updated submodule link in this repository. The release bank fingerprint
(`HEAD:public/bank`) includes that link, so qualification still pins exact files.

The bank repository is private. Workflows check it out at the linked commit with the
`BANK_READ_TOKEN` repository secret: a fine-grained token with read-only Contents
access to `tboughen/mathsdock-bank` only. Renew it before it expires.
