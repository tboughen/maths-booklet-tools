/** Public-protocol consumer qualification. No direct core artwork is used. */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { graphService } from "./server";
import { defaultEnvelope } from "../../packages/value-graph-core/src/model";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import { unzipSync } from "fflate";
const output = resolve(process.argv[2] ?? "test-results/diagram-consumption");
await mkdir(output, { recursive: true });
let base = process.argv[3];
let server: ReturnType<typeof graphService> | undefined;
if (!base) {
  const reservation = createServer();
  await new Promise<void>((r) => reservation.listen(0, "127.0.0.1", r));
  const port = (reservation.address() as {port: number}).port;
  await new Promise<void>((r) => reservation.close(() => r()));
  base = `http://127.0.0.1:${port}`;
  server = graphService({publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: {test: "synthetic-consumer-test-only-not-a-production-key"}, activeKey: "test"});
  await new Promise<void>((r) => server!.listen(port, "127.0.0.1", r));
}
const client = new Client({name: "external-diagram-consumer-test", version: "1"});
type Result = { envelope: Record<string, unknown>; contentHash: string; physicalSizeCm: {width: number; height: number}; printRaster: {width: number; height: number}; downloads: Record<string, {url: string}>; editorUrl: string; printGuidance?: unknown };
async function call(name: string, args: Record<string, unknown>): Promise<Result> {
  const result = await client.callTool({name, arguments: args});
  assert.notEqual(result.isError, true, JSON.stringify(result.content));
  return result.structuredContent as unknown as Result;
}
const items: Record<string, Result> = {};
async function save(name: string, data: Result) {
  for (const format of ["svg", "json", "png"]) {
    const response = await fetch(data.downloads[format].url);
    assert.equal(response.status, 200, `${name} ${format} retrieval`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (format === "json") assert.deepEqual(JSON.parse(Buffer.from(bytes).toString()), data.envelope);
    if (format === "png") verifyPrintBytes(bytes, data.printRaster.width, data.printRaster.height);
    if (format === "svg") assert(!/<(?:text|image|script|foreignObject)\b|(?:href|src)="(?:https?:|data:image)/i.test(Buffer.from(bytes).toString()), "self-contained vector SVG");
    await writeFile(resolve(output, `${name}.${format}`), bytes);
  }
  items[name] = { ...data, downloads: {} };
}
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  const tools = (await client.listTools()).tools;
  for (const name of ["graph_capabilities", "ratio_table_capabilities", "value_graph_capabilities"])
    await client.callTool({name, arguments: {}});
  const graphSpec = JSON.parse(await readFile("services/graph-mcp/fixtures/print-consumption/graph.json", "utf8"));
  const ratioSpec = JSON.parse(await readFile("services/graph-mcp/fixtures/print-consumption/ratio.json", "utf8"));
  const graph = await call("create_graph", graphSpec); await save("graph", graph);
  const ratio = await call("create_ratio_table", ratioSpec); await save("ratio", ratio);
  const labelled = await call("revise_graph", {envelope: graph.envelope, baseHash: graph.contentHash, operations: [{op: "set_label", id: "main", visible: true, position: {x: "-1", y: "7"}}]});
  // Revision image checks use SVG at constant physical dimensions.
  async function saveSvg(name: string, data: Result) {
    const r = await fetch(data.downloads.svg.url); assert(r.ok);
    await writeFile(resolve(output, `${name}.svg`), new Uint8Array(await r.arrayBuffer()));
    items[name] = {...data, downloads: {}};
  }
  await saveSvg("label-before", labelled);
  const moved = await call("revise_graph", {envelope: labelled.envelope, baseHash: labelled.contentHash, operations: [{op: "set_label", id: "main", position: {x: "1", y: "7"}}]});
  const expected = structuredClone(labelled.envelope);
  const document = expected.document as {objects: Array<Record<string, unknown>>};
  document.objects[0].equationLabelPosition = {x: 1, y: 7};
  assert.deepEqual(moved.envelope, expected); await saveSvg("label-after", moved);
  const refreshed = await call("revise_graph", {envelope: graph.envelope, baseHash: graph.contentHash, operations: []});
  assert.deepEqual(refreshed.envelope, graph.envelope); assert.equal(refreshed.contentHash, graph.contentHash);
  const refreshSvg = await (await fetch(refreshed.downloads.svg.url)).text();
  assert.equal(refreshSvg, await readFile(resolve(output, "graph.svg"), "utf8"));
  const revisedRatio = await call("revise_ratio_table", {envelope: ratio.envelope, baseHash: ratio.contentHash, operations: [{op: "set_transition", transition: {from: "start", to: "target", operation: "divide", factor: "2"}}]});
  assert.deepEqual((revisedRatio.envelope.document as {rows: unknown}).rows, (ratio.envelope.document as {rows: unknown}).rows);
  await saveSvg("ratio-revised", revisedRatio);
  const value = defaultEnvelope();
  value.document.columns[1].y = {kind: "answer-line"};
  value.document.columns[2].y = {kind: "value", value: "0"};
  value.document.columns[4].y = {kind: "value", value: "1/2"};
  value.document.graph.series = [{id: "mistake", source: "custom", connection: "straight-joins", points: [{id: "p1", x: "-2", y: "2"}, {id: "p2", x: "1", y: "1/2"}]}];
  const combined = await call("create_value_graph", {envelope: value}); await save("quadratic-combined", combined);
  const graphOnly = await call("revise_value_graph", {envelope: combined.envelope, baseHash: combined.contentHash, operations: [{op: "set_presentation", settings: {composition: "graph"}}]});
  assert.deepEqual((graphOnly.envelope.document as {columns: unknown}).columns, value.document.columns);
  await save("quadratic-graph", graphOnly);
  const optionalTools = tools.some((t) => t.name === "download_diagram_bundle");
  if (optionalTools) {
    const reply = await client.callTool({name: "download_diagram_bundle", arguments: {kind: "ratio-table", envelope: ratio.envelope}});
    assert.notEqual(reply.isError, true);
    const bundle = reply.structuredContent as {download: {url: string}};
    const r = await fetch(bundle.download.url); assert(r.ok);
    const bytes = new Uint8Array(await r.arrayBuffer()), members = unzipSync(bytes);
    assert.deepEqual(JSON.parse(Buffer.from(members["source.json"]).toString()), ratio.envelope);
    await writeFile(resolve(output, "ratio-bundle.zip"), bytes);
    const advice = await client.callTool({name: "check_diagram_placement", arguments: {kind: "graph", envelope: graph.envelope, widthMm: graph.physicalSizeCm.width * 7.5}});
    assert.notEqual(advice.isError, true); assert.equal((advice.structuredContent as {uniformScale: number}).uniformScale, 0.75);
  }
  const maximumGraph = await call("create_graph", {...graphSpec, axes: {
    x: {negativeSquares: 9, positiveSquares: 9, unitsPerSquare: 0.5},
    y: {negativeSquares: 13, positiveSquares: 13, unitsPerSquare: 2},
  }});
  await saveSvg("maximum-graph", maximumGraph);
  const maximumRatio = await call("create_ratio_table", {schemaVersion: 2, mode: "annotated", size: "large",
    rows: Array.from({length: 6}, (_, i) => ({id: `r${i}`, cells: [{kind: "number", value: "2/3"}, {kind: "number", value: "0"}, i % 2 ? {kind: "answer-line"} : {kind: "empty"}]})),
    transitions: Array.from({length: 5}, (_, i) => ({from: `r${i}`, to: `r${i + 1}`, operation: "multiply", factor: "3/2"})),
  });
  await saveSvg("maximum-ratio", maximumRatio);
  await writeFile(resolve(output, "retrieval.json"), JSON.stringify({base, tools: tools.map((t) => t.name), optionalTools, items}, null, 2));
  console.log(JSON.stringify({output, downloaded: Object.keys(items), optionalTools, passed: true}));
} finally {
  await client.close();
  if (server) await new Promise<void>((r) => server!.close(() => r()));
}
