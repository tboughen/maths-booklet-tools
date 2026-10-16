# Original SVG delivery through MCP

`get_diagram_svg` is an optional additive retrieval call for Graph, Ratio tables,
Plotting quadratics, Cuboids, Number lines and Venn. It returns the existing
outlined SVG bytes through MCP when a consuming environment cannot retrieve a
returned download URL. It uses the same artifact dispatcher as the signed SVG
download. It does not redraw, revise, migrate, solve or save the resource.

Source implementation, deployment and actual client acceptance are separate.
Only call this tool if it is discovered in the current conversation. A refreshed
skill does not establish that cached tool definitions include it.

## Recovery sequence

1. Try the exact returned SVG URL through the client's supported download path.
   Follow a required URL-opening step if that environment provides it. Do not
   invent `container.download` or another unavailable tool.
2. Record the actual result. A URL-view restriction is a local tool rejection;
   DNS failure occurs before HTTP. Neither establishes an HTTP error from
   MathsDock. Record an HTTP status only if a response was actually received.
3. If fetching is blocked and `get_diagram_svg` is available, supply the exact
   saved envelope, kind and original output view. No URL or `baseHash` is needed.
4. Save and verify the complete original file as below before embedding it.
   If the host cannot save the exact bytes, report that client limitation.
   Do not silently redraw from equations, points or a preview.
5. A downloaded 600 ppi PNG can be an explicitly disclosed alternative if suitable
   for the requested output. It does not meet a vector-only requirement. Any
   user-approved replacement artwork must identify its different provenance.

## Request

| Field | Meaning |
| --- | --- |
| `kind` | `graph`, `ratio-table`, `value-graph`, `cuboids`, `number-line`, `venn` |
| `envelope` | Exact existing saved/returned object; retain its version |
| `outputView` | Venn only: `pupil` (default), or explicitly requested `answer` |
| `offsetBytes` | UTF-8 byte offset, default 0; must be before EOF at a code-point boundary |
| `maxChunkBytes` | Integer 1024–49152; default 49152 (48 KiB) |
| `expectedSvgSha256` | Lowercase 64-digit file checksum; required for offsets greater than 0, optional pin on first call |

First call:

```js
{kind: "value-graph", envelope: previousResult.envelope}
```

Continuation, keeping the envelope and view unchanged:

```js
{kind: "value-graph", envelope: previousResult.envelope,
 offsetBytes: part.nextOffsetBytes, expectedSvgSha256: part.svgSha256}
```

Repeat `outputView:"answer"` on every answer-view Venn request. Answer artwork
retains the original pupil envelope and its canonical source hash. No hidden
answers are filled by retrieval. Other kinds reject `outputView`.

## Response and exact saving

The declared result is available in both `structuredContent` and a JSON text
content block. These are two representations of the same object: consume one.
`svgChunk` is the actual SVG text, not a URL, base64 string, preview or Markdown.

Stable fields are `kind`, `filename:"diagram.svg"`, `mimeType:"image/svg+xml"`,
`encoding:"utf-8"`, `rendererVersion`, `sourceContentHash`, `physicalSizeCm`,
`svgSha256`, `totalBytes`, and Venn's effective `outputView`.
Per-chunk fields are `offsetBytes`, `chunkBytes`, `chunkSha256`, `svgChunk`,
`nextOffsetBytes` and `complete`. The final chunk has `complete:true` and a null
next offset. A request at EOF is an error; no empty terminal chunk is emitted.

The source's `sourceContentHash` is its existing revision hash. `svgSha256` is
SHA-256 of the complete rendered UTF-8 file; `chunkSha256` covers that chunk.
These different checksums are not interchangeable. No delivery metadata enters
the saved envelope or revision hash.

The consuming AI owns file saving and document assembly:

1. Retain the immutable source and effective view. On the first response, check
   kind, renderer version, source hash and native size against the known resource.
2. Decode JSON once. Encode `svgChunk` as exact UTF-8 bytes, without a BOM, added
   newline, literal JSON escapes, Unicode substitutions or line-ending changes.
3. Verify the chunk's byte count/hash and contiguous expected offset before
   appending. Do not append duplicate, missing, reordered or truncated chunks.
4. Request the returned next offset with the first full-file checksum. Require
   identical stable metadata throughout; reject any change in hash, total length,
   dimensions, source, renderer, kind or view.
5. At completion verify total byte count and complete SHA-256, then parse as SVG.
   Only now expose the completed file for insertion. Do not repair mismatches by
   editing or reformatting the SVG. Restart only after investigating the cause.
6. Convert the verified saved SVG using a qualified vector consumer. Place it at
   `physicalSizeCm`, preserving aspect ratio. Check the PDF's dimensions and
   recursive vector content, then inspect graph, labels, blanks, shading and crop.
   Retain the editable JSON independently of signed URL expiry.

Reference receiving code is `services/graph-mcp/svg-consumer.ts`. It accepts only
a caller-supplied MCP read function, performs no artifact URL fetch, rejects
inconsistent chunks and returns a buffer only after complete verification.
It defaults to at most 256 chunks and never retries indefinitely. Smaller chunks
reduce its maximum retrievable file size; choose a bounded size appropriate to
the client. Hosts that cannot preserve enough model-visible bytes remain
unsupported until an actual end-to-end saving test passes.

`complete` means the last chunk was delivered. It does not mean that the client
saved a file, assembled a PDF or printed anything. PNG `printVerified` does not
verify a downstream vector PDF or physical printer.

## Bounds and failures

The serialized result, including duplicate compatibility text and JSON escaping,
is capped at 256 KiB; the raw SVG artifact remains capped at 10 MiB. Unusually
escaped text may require a smaller chunk. UTF-8 code points are never split;
`chunkBytes` and `nextOffsetBytes` reflect the actual boundary. The 48 KiB and
256 KiB limits are service choices, not a universal promise about ChatGPT limits.

Existing request, CPU, memory, queue, cancellation and daily output quotas remain
enabled: 64 KiB request body, one active renderer/three queued jobs, 15-second
job/queue timeout, 128 MiB child heap, 32 million print pixels, 40 requests per
socket per minute, 120 globally and 200 MiB daily output. Actual complete result
bytes count towards output quota. Every continuation deterministically renders
the full file again and checks its hash. Pace a multi-diagram job; do not bypass
quotas or silently reduce diagram size, detail, precision or writing space.

Failures include `invalid_diagram`, `invalid_svg_range`, `svg_hash_required`,
`svg_hash_mismatch`, `invalid_svg_encoding`, `size_limit`, `busy`,
`render_timeout`, `render_failed` and `rate_limited`. SDK input-schema errors can
reject malformed fields before the handler runs. No failure changes the source
or produces a claimed completed file. A source/view mismatch or renderer update
requires a reviewed restart from zero. Do not log SVG/source contents, hidden
answers or full signed URLs in operational diagnostics.

## Qualification and release

The consumer qualification saves original SVGs for all six families, explicit
Venn answer artwork, and a plotted quadratic with retained blank/answer-line/zero
states. Its SDK transport deliberately refuses non-MCP paths; independent control
downloads use a separate permitted route. This simulates a restricted consumer.
It is not acceptance evidence for the ChatGPT environment that originally failed.
The Python vector proof consumes those exact saved files, checks native sizes and
rejects raster artwork, including a negative nested-raster control.

Retain normal files, old schemas/signatures, previous outputs and rollback keys.
Qualify the exact source through the normal release pipeline. Stage the existing
private plugin's next patch while preserving App configuration and presentation.
Publication/pilot is a separately authorised step using the existing Free/manual
service and guarded plugin update; no website runtime release is needed if its
package bytes are unchanged. Inline ZIP delivery remains deferred.

After approved publication, refresh the existing connection and use a fresh
intended chat if needed. First prove one original quadratic through exact saved
SVG into an inspected vector PDF; then all six, a multi-chunk file and a modest
multi-diagram worksheet. Record actual client/account context, quotas, failures
and required idle/wake behavior. The original affected envelope was not supplied
for this implementation; synthetic proof does not reproduce its unknown bounds.
If that client cannot save exact bytes, keep its handoff unaccepted and investigate
before considering a separately scoped host-native attachment bridge.
