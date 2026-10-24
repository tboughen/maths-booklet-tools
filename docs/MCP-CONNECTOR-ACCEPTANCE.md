Routine publication follows the [MCP release playbook](MCP-RELEASE-PLAYBOOK.md) and
[checklist](MCP-RELEASE-CHECKLIST.md). Retained incident/family details below remain
applicable; historical family/tool counts are snapshots, not discovery evidence.

# MCP connector acceptance and missing-tool incidents

Use this guide when adding or changing any MathsDock MCP call. Check it before
declaring a connector ready and before diagnosing a missing tool. The website,
service, plugin package, registered App and tools supplied to a conversation have
separate evidence. Updating one does not prove the others adopted the change.

These rules prevent known schema regressions and catch delivery gaps early.
They cannot promise to prevent a host catalogue delay whose cause is unknown.

## What happened

### 8-9 October 2026: confirmed schema-import failure

The original connection retained three graph tools after refresh while direct
SDK discovery advertised six and ratio creation/exports worked. A temporary
connection showed a generic settings-rejection banner. Its actual response
identified `apps_sdk_error`, `mcp_validation`, and
`Invalid MCP tool schema for tool 'create_ratio_table'`.

Identical ratio cells/headings used `z.tuple([item, item])`, emitted as draft-07
positional `items` arrays. [Fix e4a0882e](https://github.com/tboughen/maths-booklet-tools/commit/e4a0882ec04f78f4849dc89a8e7f1fbfa29180ef)
used homogeneous `z.array(item).length(2)` schemas, preserving the saved JSON,
blanks, arithmetic and artwork. Ten affected schema sites disappeared. After
the corrected deployment, Tim confirmed that refreshing the original connection
exposed the ratio tools and its actual ChatGPT test succeeded. A second connection
or service was unnecessary.

This was a server schema correction. Positional arrays can be valid JSON Schema;
the incompatibility concerned this client's importer. Do not ban all unions or
weaken handler validation based on this incident.

### 16 October 2026: missing SVG call, later accepted without a new fix

After publication of service commit `650c9bf3` and private package `1.1.5`, the
service advertised 21 calls, including `get_diagram_svg`. Existing and fresh
ChatGPT conversations still received 20. The correct development App's
**Manage app > Refresh tools** button showed a spinner, then returned to normal
without a visible success/error. The package and existing App binding were correct.

Historical/current schema comparison excluded the old tuple defect: all 185
current array schemas had object-valued items, and the new SVG call contained no
array schemas. These checks did not prove full ChatGPT importer compatibility.

At the next investigation's first inspection, the actual connected Codex catalogue
contained all 21 calls, with the same server code, definitions and plugin release.
No schema repair, version bump, replacement connection or deployment was made.
Eight SVG cases covering all six families, Venn answers and a maximum 50-object
graph passed actual connector retrieval, exact saving and native vector-PDF checks:
15 chunks, 436,268 bytes; eight PDF pages, 11,269 paths and zero images.

Tim then supplied the original worksheet chat's final report: its original
19,272-byte SVG was retrieved in one chunk, independently checksum-verified and
embedded into a two-page A3 landscape PDF with no raster images. Bounds, pupil
blanks and source hash were retained; page 2 was reported pixel-identical. This
was user-reported target-chat acceptance; those worksheet files were not supplied
for independent inspection in the development chat.

The cause and exact duration of the earlier catalogue delay remain unconfirmed.
Do not label it a proven cache bug, review hold, 20-tool limit, or repaired schema.
Its lesson is to verify the consumer's catalogue and real workflow explicitly.

The working records are `reports/ratio-table-connection-2026-10-09/`,
`reports/mathsdock-mcp-history-investigation-2026-10-16/`, and
`reports/mathsdock-mcp-investigation-execution-2026-10-16/` in Tim's workspace.
They are workspace evidence, not assumed files in every repository or plugin.

## Record separate acceptance stages

| Stage | Required evidence | Does not establish |
| --- | --- | --- |
| Source and schema | Exact commit, emitted input/output definitions, regression checks | A deployed service or accepted import |
| Live service | Actual endpoint/build identity, complete `tools/list`, affected SDK calls | Tools available to a particular chat |
| Plugin package | Correct release, preserved App binding, skills/reference read-back | Updated registered tools or chat definitions |
| Connection and conversation | Intended existing App/URL; named tool actually present in the consuming chat | Successful execution or a saved file |
| Execution | Actual named call, arguments, result/error and retained envelope/hash | File retrieval, assembly or printing |
| Saved output | Reopened exact bytes/checksums; native-size vector PDF or verified PNG | Native Word or physical printing |

Record client surface and test provenance: SDK simulation, actual Codex connector,
actual ChatGPT chat, or Tim's supplied report. Keep pending stages explicit.
"Service deployed; target-client acceptance pending" is an honest release stage.
Do not mark the full connector accepted merely because qualification passed.

## Before adding or changing a call

1. Retain the previous named catalogue and representative saved sources/outputs.
   Define the expected delta in names and schemas; a count alone is insufficient.
2. Inspect actual emitted `tools/list` input AND output schemas, including nested
   arrays/records, required fields, unions/nullability, references, constraints,
   descriptions, annotations and execution metadata. Follow actual pagination.
3. Keep the homogeneous-array regression in
   `services/graph-mcp/ratio-table.test.ts`. It rejects positional `items`,
   `prefixItems` and `additionalItems` in this project's advertised schemas.
   Use the historical failing snapshot as a negative control when changing it.
   It is a project compatibility guard, not ChatGPT's complete validator.
4. Check complete payloads, defaults, stable IDs, numeric strings and retained
   old signatures. Handler validation must still enforce mathematical limits,
   atomic revisions, pupil blanks, hidden answers and source-hash checks.
5. Define an early actual-host import/call trial and a small complete output
   trial in the tool brief. For a new delivery route, include maximum/multi-chunk
   and failure cases. A deliberately restricted SDK transport is useful but
   does not stand in for the environment that will assemble the worksheet.
6. Keep the exact deployed source, package and intended App identities separate.
   Preserve existing keys, endpoint, hosting constraints and saved files.

## After an authorised service or package update

Use the existing connection's metadata-refresh control when the server's tool
metadata changed. In the development App inspected on 16 October this was
**Manage app > Refresh tools**. Updating/downloading a package, refreshing a web
page, and refreshing its MCP tools are different operations. Identify the actual
surface before giving directions. A public reviewed distribution has a different
tool-update process; do not direct a private development App to nonexistent
submission controls.

Record what the refresh reports, then inspect expected tool names and changed
schemas in the intended chat. If it retains older definitions, check one fresh
conversation with the same plugin selected, carrying the saved resource/context
where execution requires it. Do not create an indefinite refresh/new-chat loop.
A spinner ending, unchanged package version, or a model repeating skill text
does not prove that the tool metadata updated.

If the gap persists, stop assembly, retain the source, and follow the diagnosis
below. Do not invoke a guessed tool name or promise that waiting a fixed number
of minutes will solve it. No universal refresh timeout was established here.

## Diagnose from evidence

| Observation | Next discriminating check |
| --- | --- |
| Live build or endpoint differs from reviewed source | Reconcile deployment/connection identity before changing schemas |
| Service omits the new tool | Check exact deployed registration, build, pagination and protocol response |
| Service advertises it; intended chats do not | Compare the registered App/URL and actual refresh/import response; audit emitted metadata |
| `mcp_validation` names a tool | Inspect its complete emitted input/output schemas; reproduce and isolate the incompatibility |
| Refresh response explicitly succeeds but stored metadata remains old | Check the observed connection version/catalogue; retain evidence for host investigation |
| Exact unchanged tool later appears and works | Record the observed recovery; do not invent a retrospective code fix or cause |
| Tool executes but file saving fails | Diagnose the consumer's download/save route separately from discovery |

Retain the relevant response's status, error type/code/message, named tool, UTC
time and available correlation ID. A scoped browser Network response can reveal
what a generic banner or spinner hides. Do independent source/schema checks
first where authenticated inspection is unavailable; do not demand repeated
button screenshots. Never request cookies, Authorization headers or a full HAR.
Provider logs without a caller/method cannot attribute a nearby HTTP 400 to that
refresh. This POST-only service may return 405 to an SDK's optional GET probe;
successful `initialize`/`tools/list` calls must be evaluated separately.

If the response is inconclusive, use an authorised isolated import experiment:
exact full catalogue, previous working catalogue, new definition alone, and only
then a minimal harmless addition or ordering comparison. Keep transport/account
conditions constant, vary one feature at a time and retain exact definitions and
results. A broken control invalidates the experiment. Reintroduce a suspected
feature to reproduce rejection before claiming causation where possible.
Skip this matrix when the exact unchanged tool already works. Do not uninstall
the original plugin, remove an old tool to make room, weaken origin checks,
change authentication/keys, or redeploy speculatively.

## File delivery must work in the assembly environment

A signed URL returned by a successful tool is not a retrieved file. A local
"URL not viewed" gate rejects before HTTP; DNS failure receives no HTTP status.
An inaccessible `web.run` result is not an observed MathsDock endpoint response.
A ZIP returned through another signed URL may encounter the same restriction.
Keep these failures distinct from a server HTTP error.

Use the existing [original SVG delivery](DIRECT-SVG-DELIVERY.md) when discovered
and appropriate. For future tools, plan a bounded retrieval route usable by the
actual consumer; do not assume URLs or model-visible chunks guarantee saving.
Retain the exact envelope/view, verify source identity, contiguous UTF-8 chunks,
byte counts, chunk/full hashes and native dimensions, then verify the saved file.
Decode source JSON explicitly as UTF-8 too: a hidden inequality corrupted by a
platform default encoding can change the source hash even if visible SVG ink is
unchanged. Do not normalize, repair or redraw a mismatch.

For vector output, verify the final PDF dimensions and recursive resources,
including nested forms and inline images, then render and inspect it. In a retry
that should change one graph, compare retained pages/text and untouched artwork.
Existing tight labels remain a separately reviewed artwork issue. File transport
must not silently change bounds, pupil blanks, answers or the original drawing.

## Completion record for each connector change

Retain this small record with the release evidence:

```text
Change and expected tool names/schema delta:
Exact source/build, endpoint and previous compatible release:
Package release, App/connection identity and mode:
Direct discovery: complete names, pagination, schema fingerprints:
Refresh/import: observed result/error, UTC time, resulting metadata:
Intended chat/client: actual available names and named call receipt:
Saved resource: source hash, view, bounds/blanks retained:
Saved file: byte count, independent checksum, dimensions:
Final consumer: vector/PNG checks, rendered review, untouched output comparison:
Maximum/multi-chunk, invalid-input and idle/wake checks actually performed:
Evidence source: automated SDK / actual Codex / actual ChatGPT / user report:
Unverified stages, next action and review owner:
```

Update canonical documentation and affected local/plugin skill copies together.
Validate references/frontmatter and preserve App presentation, connection and
audience during guidance updates. Documentation-only edits need content/link/
package checks; they do not justify a runtime rebuild or service deployment.
Merges, deployments, client acceptance and Tim's final completion confirmation
remain distinct under the project's normal approval rules.

## Official references

Checked 16 October 2026; verify again when the host surface changes:

- [Connect, refresh metadata and test](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Published-distribution MCP scans and held changes](https://developers.openai.com/plugins/deploy/submission)
- [Tool/server troubleshooting](https://developers.openai.com/plugins/deploy/troubleshooting)
