# Automatic question accessibility

This local candidate is based on main b390faff00e79af23a76adc0ab7ded6d039c9199.
It has not been pushed, merged or deployed.

Questions automatically run from most accessible to most challenging within
each tier. Both-tier lists group Foundation before Higher. A shared crossover
keeps the existing eligible representative and its direct links.

The average-marks toggle starts off each session. Measured percentages use a
pastel red, peach, amber, yellow-green and green gradient; estimates are grey.
The toggle applies to browsing and paper review. Badges are separate from
question images and PDFs. Shared questions show both labelled tier figures
when both tiers are selected.

New paper selections are automatically ordered. Manual up/down movement locks
the teacher's order; further additions append without rearranging that work.
Clearing the draft restores automatic ordering. No order selector was added.

## Data maintenance

The original catalogue, question assets and Sparx mappings are unchanged.
`src/bank/performance-data.json` supplies marks and calibration metadata;
`withPerformance` enriches catalogue records in memory. A catalogue rebuild
does not erase the generated data. New measured questions match by paper ID
and original question number, with a maximum-marks check.

Regenerate using the bundled Python runtime:

```
python scripts/import-performance.py "Higher workbook.xlsx" "Foundation workbook.xlsx"
```

Requires openpyxl for read-only extraction. The importer records workbook
hashes and row references, excludes invalid/overlapping rows, and checks
aggregated marks against the catalogue. The import report records exceptions.
It never uses Edexcel skill text to change Sparx mappings.

The baseline includes complete published mocks, so their final question
numbers are recorded in `paperQuestionCounts`. When adding a new incomplete
paper without grid data, provide its complete original question count in the
catalogue's optional `paperQuestionCounts` map. Do not infer this from the
number of uploaded questions. Without a reliable count the badge says No data
and the question sorts last within its tier.

Each tier's ten position bands are fitted using weighted decreasing isotonic
regression, with linear interpolation and endpoint clamping. The curves are
fixed until an explicit import. No AI assessment or individual remapping is
needed. Bad measured records use this same positional estimate.

## Local checks

```
npm run lint
npm run typecheck
npm test -- --maxWorkers=2
npm run build
npm run dev -- --host 127.0.0.1 --port 5193 --strictPort
npx playwright test --config=playwright.accessibility.config.ts
```

The dedicated browser checks cover default-off display, ordering, estimates,
both crossover links, mobile layout, manual paper order, and actual downloads
in both PDF layouts. Evidence is retained in the workspace report directory
`reports/mathsdock-accessibility-testing-2026-10-12`.

The supplied grids yield 1188 measured published appearances and 599 estimated
appearances, including mocks and three exam exceptions. All 1787 appearances
have a score in this baseline. Exceptions: June 2017 2F Q5 repeats a part label;
November 2017 1F Q26 has a nonnumeric mean;
November 2018 3F Q19 is missing three marks in the grid. The three published
exam exceptions are reported rather than silently repaired.
