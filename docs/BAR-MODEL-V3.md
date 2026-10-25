# Horizontal fractions and handwriting space

Candidate identity: schemaVersion **3**, rendererVersion **bar-model-3**,
styleProfile **lesson-v3**. New empty browser sessions use v3. Frozen v1/v2 files
keep their original hashes and artwork. Source capability and qualification do
not establish production service or intended-client adoption.

## Working lines

Captions keep `{id,label:{text,state},alignment:left|centre|right}` and add
`format:maths|plain` (default `maths`). Limits remain three lines/80 characters.
Type `4/5 × 45 = 36`, `n/5 of 45 = 36`, `-3/8 × 48 = -18` or `1/2 + 3/4`:
the whole statement uses horizontal fraction rules and one mathematical axis.
Bundled font advance/ink metrics determine full width, ascent/descent and crop.
Fraction glyphs use the requested body size, without fit-dependent shrinking.

Fraction atoms are signed/unsigned numbers, single variables, coefficient terms,
or one parenthesised group, e.g. `(a+b)/c`. Nested fractions and ambiguous chains
such as `9/10/2026` fail with an explanation. Invalid drafts remain available and
exports stay blocked. Plain text is explicit for prose/dates/literal slashes;
failed Maths never selects it automatically. Titles and quantity names remain
plain text. Display layout never evaluates, solves, simplifies or fills answers.

## Writing geometry

Each explicit `state:line` reserves **12 mm above the upper stroke edge**, the
existing **0.25 mm** underline, and **3 mm below the lower stroke edge**. The
underline remains **8 mm** long; the complete vertical footprint is **15.25 mm**.
An invisible rectangle controls layout. The underline is 4.5 mm below its centre;
no writing box or additional shading is printed.

This covers inside/above/below section slots, whole/range/inside/between
annotations, names, titles and captions. Between labels retain their original
adjacent endpoint bars while the actual gap grows. Clear neighbours share a
lane; overlapping handwriting rectangles move lanes. Actual guide/stroke and
label occupancy is checked; a crossing guide fails explicitly.

`presentation.barHeightMm` becomes a **requested minimum**, bounded 8..24 mm.
Inside answer lines require uniform actual bars of at least **20 mm**, covering
the footprint plus at least 2 mm internal clearance on each side. Outside lines
enlarge their own lanes. The editor shows minimum and actual height;
`printGuidance.referenceFeatures.tableRowHeightsMm` reports actual height.
Weights, offsets, boundaries and shared unit width never change to fit text.
Insufficient horizontal room requires wider shared units or an outside label.
Blank, question, hidden and zero remain distinct; hidden text never determines
pupil dimensions. Editable definitions/links still retain saved hidden answers.

## Creation and compatibility

Bare/legacy MCP requests remain v1; explicit `spec.schemaVersion:2` stays v2.
Use `spec:{schemaVersion:3,...}` or an exact v3 envelope for new output. V3 keeps
v2 starters, slots, fills, anchored annotations and operations, adding the caption
format and minimum-height semantics above. Consult actual capabilities and the
[complete emitted descriptors](BAR-MODEL-EMITTED-SCHEMAS.json).

`upgrade_document` **without a target keeps its prior v1-to-v2 meaning**.
Explicit `{op:"upgrade_document",targetSchemaVersion:3}` upgrades v1/v2 to v3.
Use it once, first. Check the original `baseHash` before operations; any later
failure rolls back the entire batch. Preserve IDs, source references, exact
weights/offsets, labels/states, fills and fixed vs dynamic scope. A v1 fixed span
stays fixed. The browser previews the change; one Undo restores the original
version and earlier history. No read-time upgrade occurs.
If an old caption contains a date or literal slash, the upgrade preview blocks
ambiguous Maths. Explicitly choose **Keep existing calculation lines as Plain
text** to preserve it; this choice is never made automatically.

Protected storage accepts all three versions. Unknown/corrupt future records
remain protected; compare-before-write and divergent-key recovery still apply.
Older clients reject v3 rather than silently overwriting an unknown definition.

## Output and acceptance

Browser/MCP share geometry and SVG. Check actual SVG, 600 ppi PNG, both clipboard
routes, JSON, original-SVG chunks, bundle and native vector consumption. Print at
Actual size / 100%; document resizing changes the physical handwriting space.
Bounds remain 280 × 260 mm, 32 million pixels, 32 KiB definition/request, 16,000
link characters, 96 sections, 18 annotations and three captions. Runtime limits,
quotas and timeouts are unchanged. The dense admissible fixture has 96 inside
answer lines at 20 mm actual bar height. All maxima plus every possible outside
line need not coexist. Excess fails explicitly without compressed handwriting,
font shrinking or hidden scaling. Old compact pupil-height targets are superseded
for this profile.

The website must read all three versions before production service issues v3.
Website, service, private package and actual intended-client stages stay separate.
SDK/browser rehearsals do not establish actual Codex/ChatGPT adoption, native Word,
physical handwriting/print, real-phone use or independent teacher acceptance.
New sources are in `bar-model-examples/lesson-v3/`; frozen v2 sources remain in
`bar-model-examples/lesson-v2/`. Reproduce native output with
`node scripts/bar-model-v3-review.mjs NEW_OUTPUT_DIRECTORY`; use
`--write-examples` only for deliberate website asset refreshes.
