# MathsDock diagram outputs for another AI project

MathsDock produces deterministic diagrams. The consuming AI owns booklet
assembly, final placement and saving. Use the returned artifacts and keep the
definition for revisions; do not reconstruct a diagram from its preview.

## Files and measurements

Create/revise retains the envelope, contentHash, renderer/style versions,
SVG/PNG/JSON downloads and editor link. `physicalSizeCm` specifies the complete
artwork's intended size, including labels and writing space. The downloaded PNG
is verified at 600 ppi; the inline image is a preview. Service SVG lettering is
outlined into paths using bundled fonts.

Optional `printGuidance` is response metadata outside the envelope/hash:
`recommendedScale: 1`, `preserveAspectRatio: true`, and `referenceFeatures`
containing `textSizesPt`, `gridPitchMm`, `answerLineLengthsMm` and
`tableRowHeightsMm`. Arrays give distinct visible nominal measurements at this
resource's native size; hidden features are excluded. A compact ratio table's
measurements already include its chosen size. They do not imply a universal
readability threshold.

Use SVG for a qualified vector workflow, or the print PNG for raster insertion.
Set physical dimensions explicitly and preserve the complete artwork and aspect
ratio. Resizing changes grid pitch, type and answer spaces together; axis values
stay unchanged. `printVerified` concerns the PNG dimensions/density, not the
downstream PDF, Word document or physical printer.

## Optional placement calculation

Call `check_diagram_placement` when considering a resize. Input:

```js
{
  kind: "graph", // also ratio-table, value-graph, cuboids, number-line, venn
  envelope: previousResult.envelope,
  widthMm: 80 // heightMm is optional; at least one dimension is required
}
```

Dimensions must be positive finite numbers. No baseHash is required because no
revision is performed. One dimension derives the other proportionally. Two
dimensions describe a box: forcing both may distort the resource, so the result
reports that risk and the largest proportional size inside the box. Tolerance
for rounding is 0.1 mm or 0.1% of the dimension, whichever is larger.

The result has `nativeSizeMm`, `requestedSizeMm`, `proportionalSizeMm`,
`uniformScale`, `wouldDistort`, `scaledReferenceFeatures`, `effectivePngDpi` and
coded `warnings`. Scaled measurements describe the proportional fit, not a
stretched version. Reduction warnings give the effects on the visible text,
grids and writing space. Enlargement density concerns PNG only; SVG remains
vector. Advice does not inspect a booklet or enforce a minimum print size.
Native-size placement does not need a routine extra call or approval question.

## Optional source-and-artwork bundle

Call `download_diagram_bundle` with `kind` and the exact returned `envelope`.
It returns one ZIP with five fixed members:

- `source.json`: editable definition with stable IDs and pupil blanks.
- `diagram.svg`: outlined vector artwork.
- `diagram.png`: verified 600 ppi print PNG.
- `print-info.json`: native size and print facts.
- `README.txt`: placement, reopening and refresh instructions.

The usual response has `download: {url, expiresAt}`, `inline: false`, filenames
and physical information. Archive bytes are generated on retrieval; download
before claiming file success. No persistent library, account or booklet is
stored. Links expire after seven days. Repeating the call with the saved source
refreshes them without revising the mathematics.

Sources too large for a signed URL can use an embedded `application/zip` resource
up to 1 MiB raw. Larger inline archives return `bundle_unavailable`; use the
existing individual download/resource route. Limits: 10 MiB output ZIP, 20 MiB
combined member input, five fixed filenames, existing queue/timeout/child-heap
constraints. ZIP STORE avoids compression work on the main event loop; packing
runs in the bounded child. Inline output accounting includes base64 overhead.

Unzip normally, then open source.json in the existing editor. No ZIP importer,
extra cryptographic hashes, history format or automatic project saving is added.
Archive files contain no signed URLs or credentials. Standard ZIP CRC checks
are not a revision gate. Legacy Graph fonts require the existing explicit
portable conversion via `revise_graph` with no operations before bundling.
The bundle never silently upgrades the saved source.

## Consumer workflow and preservation

1. Inspect capabilities and create with explicit teaching states.
2. Retrieve actual SVG/PNG/JSON and place at physicalSizeCm by default.
3. If a resize is considered, obtain advice and use proportional dimensions.
4. Save JSON alongside the other project's work, or optionally retrieve a bundle.
5. Revise the exact returned envelope using its contentHash as baseHash, then
   retain the newly returned envelope/hash.

Blanks and answer lines remain unanswered unless calculation is explicitly
requested. Deliberate mathematical disagreements remain with teacher-facing
warnings outside pupil artwork. Hash checking binds a revision to the supplied
definition; the stateless server has no cross-chat knowledge of a newer version.
Optional tools can be absent in older discovery. Do not fabricate calls or
construct signed URLs. Their failure does not invalidate existing diagrams.

## Vector PDF qualification

The reference consumer uses the official MCP client and actual HTTP downloads,
converts outlined SVG with CairoSVG, then places component PDFs with pypdf at
native size without rasterisation. It checks dimensions, recursive vector
content, source preservation and label-only image differences. The A3 specimen
has a Graph/Ratio pair and two quadratic compositions with 100 mm calibration
lines. This qualifies this route, not every external AI environment.

```sh
npm run build:service
node service-dist/verify-consumption.js tmp/diagram-consumption
python -m pip install -r scripts/diagram-consumption-requirements.txt
python scripts/verify-diagram-consumption.py tmp/diagram-consumption
```

The collector starts and closes its own local MCP server by default; an optional
third argument is a service origin for a bounded live check. It uses returned
URLs. Python/Cairo dependencies belong to the test environment, not the Node
service image. Windows consumers need Cairo available; a bundled Cairo directory
can be supplied with CAIROCFFI_DLL_DIRECTORIES and PATH.

Render and inspect every specimen page independently. Teacher Actual size/100%
printing remains a separate check. Existing Copy for Word is unchanged.

## Compatibility and release

Saved schemas, renderer versions and artwork styles stay unchanged. Metadata is
additive. Qualify the real discovered schemas and target client after authorised
service deployment. Website, service release and client refresh are distinct.

The six-family service source is documented in [Six-tool MCP](SIX-TOOL-MCP.md).
Cuboid physical facts use its actual close-cropped artwork; print layout width
is a different measurement. Native outlined ink bounds can give different white
margins from browser font layout bounds, while the artwork scale is retained.
Venn placement and bundles accept optional `outputView: "pupil" | "answer"`.
The default is pupil. Answer artwork never replaces saved pupil visibility:
`source.json` and editor links retain the canonical pupil document and may
contain hidden answers. The signed artifact binds its requested output view.
PNG verification, limits and print facts refer to the selected artwork view.
Existing SVG/PNG/JSON links keep their signing and validation conventions.
Rollback should retain new bundle-link support until expiry where possible;
otherwise explain that affected links need regeneration.
