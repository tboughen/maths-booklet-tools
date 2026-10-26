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
  "revision": "immutable-solution-revision",
  "basedOnQuestionRevision": "exact-bank-question-revision",
  "pdf": "bank/assets/worked/QUESTION_ID/REVISION/solution.pdf",
  "pdfSha256": "EXACT_64_CHARACTER_LOWERCASE_SHA256",
  "views": [
    {
      "id": "solution-page-1",
      "label": "Original page 8",
      "page": 1,
      "width": 595.28,
      "height": 841.89,
      "preview": "bank/assets/worked/QUESTION_ID/REVISION/solution-1.png",
      "description": "QUESTION_ID worked solution, original page 8",
      "sourcePages": [8]
    }
  ]
}
```

This example contains placeholders, not an accepted registration. Use the actual
native PDF dimensions in points. `page` is the one-based page in the derivative
PDF; `sourcePages` contains its one original full-paper page number. Every PDF
page has exactly one view, in order, with strictly increasing original page
numbers. Continuation pages 8/9 become derivative pages 1/2. Revisions are bounded
nonempty identifiers using letters, digits, `_` and `-`. Hashes use lowercase hex.

Keep the bank question revision and existing question/scheme resources unchanged
when adding an attachment. The solution has its own immutable revision. Changing
question content invalidates the solution's base revision; reconcile and review it
explicitly rather than transferring an old answer to new content. Every crossover
appearance needs its own registration, even if identical file bytes deduplicate
in content-addressed storage. No equivalent-ID fallback is used.

## Prepare the individual resource

Use the complete original PDF page at native scale, with the target's checked
black working and dark-pink guidance. Preserve printed neighbouring questions,
diagrams and working areas. Exclude neighbouring **worked overlays** from the
actual PDF and PNG bytes. Cropping, white masks, CSS hiding and optional hidden
answer layers are not substitutes. Include every target continuation page. Keep
the checked all-answers paper and its editable bundle unchanged as evidence.

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
        "fullOriginalPages": true
      }
    }
  ]
}
```

List each unique referenced PDF/PNG exactly once in `files`. The helper validates
IDs/base revisions, complete view metadata, safe contained paths, exact hashes,
actual PDF page count/geometry (unrotated unit-point pages without derivative
CropBox clipping), PNG decoding and preview proportions before
publishing any proposal directory. Byte snapshots feed the staged files and
receipt. Duplicate IDs, a changed question, differing existing solution, missing
file or failed check leaves no final output. A repeated exact registration is an
`unchanged` no-op; use a new output directory for its receipt. Never overwrite a
previous batch or resolve a conflict by changing only its expected revision.

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
local snapshot is not live authority. Follow [the release pipeline](RELEASE-PIPELINE.md)
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
