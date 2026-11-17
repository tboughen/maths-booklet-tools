# Per-question worked solutions: files and registration

A worked solution is **data**: checked steps for each part of a question, kept as one JSON file in
the private bank and drawn by MathsDock over the question's own cuts at true size. What the steps
say and how they look is in [WORKED-SOLUTIONS.md](WORKED-SOLUTIONS.md). This page covers where the
files live, how one is attached to a question, and how it reaches the website.

The old worked solutions (one flat PDF and PNG per question, schema 1) were retired on
16 November 2026 together with all code that read them. Their files stay in the bank under
`worked/<question id>/<old revision>/` as the starting point for the new data; nothing serves them.

## In the Question bank

Questions open first. The **Worked solution** switch is deliberate and opens the working in a pane
of its own beside whatever else is on (Question, Mark scheme); switching it off closes that pane
(`docs/tools/APP-HOUSE-STYLE.md`, "Question bank: three switches"). Switching question, filters,
crossover identity or reloading shows only Question, and ordinary question links never encode an
answer role. Questions with no attachment show a disabled switch and **Not available yet**.

- In part view the working shows over the served part's cuts (and its stem), with only that part's
  grey (N). The whole question shows every cut stacked, with the **Total for Question** line the
  cuts leave out. An uncut question shows its own views.
- The steps file and the handwriting font load only when a worked solution is first opened.
- Mark notes, step by step and image exports are described in [WORKED-SOLUTIONS.md](WORKED-SOLUTIONS.md).
  Paper Builder keeps its two outputs (questions, mark schemes) for now.

## The catalogue attachment

`BankQuestion.workedSolution` is optional. When present it is exactly:

```json
{
  "schemaVersion": 2,
  "revision": "ws-2026-11-16-a",
  "basedOnQuestionRevision": "31a7cdaf55d22bfb",
  "data": "bank/assets/worked/1MA1_JUN_2017_1F_Q20/ws-2026-11-16-a.json",
  "dataSha256": "<sha-256 of the file's bytes>"
}
```

- `data` is always `bank/assets/worked/<question id>/<revision>.json`, and a new revision is a new
  file. Files are never edited in place once registered.
- `basedOnQuestionRevision` must equal the question's `revision`. A changed question hides its
  solution until the solution is checked against it and registered again.
- The steps file names the same question id and revision (`questionId`, `questionRevision`);
  the page refuses a file whose hash or owner differs from the catalogue.

The shared contract is `workedSolution.ts`; the steps schema, renderer and checks are
`packages/worked-core`.

## Register a batch

1. Write the steps files into the bank checkout at their `data` paths.
2. Write a batch file:

   ```json
   { "schemaVersion": 2, "batchId": "pilot-jun-2017-1f",
     "registrations": [{ "questionId": "…", "expectedQuestionRevision": "…", "solution": { …attachment… },
         "evidence": { "reviewRecordSha256": "…", "independentSolve": true } }] }
   ```

   `evidence` records WS13: every answer was solved again independently and agrees with the mark
   scheme, with the hash of that review record (kept outside the repository). To replace an attachment, add `expectedPreviousSolution` with the current one; the new one needs
   a new revision and file.
3. Stage it (plain Node 24, no build):

   ```
   node scripts/bank/register-worked-solutions.ts --catalogue=/abs/public/bank/catalogue.json \
     --batch=/abs/batch.json --public=/abs/public --output=/abs/fresh-output-directory
   ```

   This checks each attachment, file hash and owner, refuses conflicts and writes a proposed
   catalogue, the files and a receipt to the new directory. The source catalogue is never touched.
4. Copy the proposal in, then run the full checks on the real bank:
   `npx vitest run src/bank/worked-bank.test.ts`. They parse every steps file and run every
   machine check of the standard (marks add up, every answer line filled, carried answers match,
   stacked fractions, school words, nothing overlapping or off the cut). Nothing is committed while
   any check fails.

If another importer regenerates question records, stage with
`--proposed-catalogue=/abs/regenerated/catalogue.json` and an empty `registrations` array. The
`preserveWorkedSolutions` guard keeps attachments for unchanged questions and refuses removed or
changed ones.

## Where the files are committed

`public/bank/assets/` is the private `tboughen/mathsdock-bank` repository, linked as a submodule.
Commit and push the steps files inside it first, then commit `catalogue.json` and the updated
submodule link here. The bank fingerprint (`HEAD:public/bank`) includes that link.

`catalogue.json` is the only catalogue file to edit. Every build derives the light
`bank/catalogue-index.json` and one detail file per paper from it (`bankCatalogueSplit.ts`).

Workflows check the bank out with the `BANK_READ_TOKEN` secret (read-only Contents access to the
bank only). Renew it before it expires.

## Release

`bankAssets.ts` lists each steps file with the other bank assets, and only as `.json`.
`scripts/cloudflare/release.ts` checks it parses, then rewrites `data` to its immutable
`bank/assets/sha256/<hash>.json` object served as `application/json` behind staff sign-in.
Preview and Cloudflare builds check every registered file's hash and owner
(`scripts/bank/solution-files.ts`). Worked solutions are switched on paper by paper, and each
switch-on is a website release that needs Tim's go.
