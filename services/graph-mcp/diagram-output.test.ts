// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { graphService } from "./server";
import { checkPlacement } from "./placement";
import { diagramPrintInfo, diagramSource } from "./diagram-source";
import { BundleDownloads } from "./bundle-downloads";
import { ARCHIVE_NAMES, packArchive } from "./archive";
import { createGraph, graphHash, type GraphEnvelope } from "../../packages/graph-core/src/interchange";
import { createRatioTable, validateRatioEnvelope, ratioHash } from "../../packages/ratio-table-core/src/interchange";
import { defaultEnvelope, decode, contentHash as valueHash } from "../../packages/value-graph-core/src/interchange";
import { renderRatioSvg, ratioPrintFacts } from "../../packages/ratio-table-core/src/svg";
import { graphPrintFacts } from "../../packages/graph-core/src/svg";
import { valuePrintFacts, renderSvg } from "../../packages/value-graph-core/src/svg";
import { verifyPrintBytes, printRasterSize } from "../../packages/graph-core/src/png-bytes";
import { RasterQueue } from "./raster";
const graphSpec = JSON.parse(readFileSync("services/graph-mcp/fixtures/print-consumption/graph.json", "utf8"));
const ratioSpec = JSON.parse(readFileSync("services/graph-mcp/fixtures/print-consumption/ratio.json", "utf8"));
const key = "synthetic-bundle-only-key-not-for-production";
const clients: Client[] = [], servers: Server[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});
async function start() {
  const reservation = createServer();
  await new Promise<void>((r) => reservation.listen(0, "127.0.0.1", r));
  const port = (reservation.address() as {port: number}).port;
  await new Promise<void>((r) => reservation.close(() => r()));
  const base = `http://127.0.0.1:${port}`;
  const server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: key }, activeKey: "test" });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "diagram-output-acceptance", version: "1" }); clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  return { base, client };
}
type Reply = { envelope: GraphEnvelope; contentHash: string; downloads: Record<string, {url: string}>; physicalSizeCm: {width: number; height: number}; printGuidance: ReturnType<typeof graphPrintFacts> };
function native(source: {kind: string; envelope: unknown}) {
  const size = diagramPrintInfo(diagramSource(source)).physicalSizeCm;
  return { widthMm: size.width * 10, heightMm: size.height * 10 };
}
describe("physical facts and independent placement", () => {
  it("excludes hidden equations and includes only visible graph labels", () => {
    const e = createGraph(graphSpec);
    expect(graphPrintFacts(e.document).referenceFeatures).toEqual({ textSizesPt: [12], gridPitchMm: [10], answerLineLengthsMm: [], tableRowHeightsMm: [] });
    const labelled = structuredClone(e);
    const line = labelled.document.objects[0];
    if (line.kind !== "straight") throw Error("fixture");
    line.equationVisible = true;
    expect(graphPrintFacts(labelled.document).referenceFeatures.textSizesPt).toEqual([10, 12]);
    line.start = {x: 100, y: 100}; line.end = {x: 101, y: 100};
    expect(graphPrintFacts(labelled.document).referenceFeatures.textSizesPt).toEqual([12]);
  });
  it.each(["compact", "standard", "large"] as const)("measures actual ratio text/fraction/answer space at %s size", (size) => {
    const e = createRatioTable({ ...ratioSpec, size });
    e.document.rows[0].cells[0] = {kind: "number", value: "1/2"};
    e.document.transitions[0].factor = "1/2";
    const facts = ratioPrintFacts(e.document).referenceFeatures;
    const scale = {compact: 0.8, standard: 1, large: 1.2}[size];
    expect(facts.answerLineLengthsMm[0]).toBeCloseTo(6 * scale);
    expect(facts.tableRowHeightsMm[0]).toBeCloseTo(10 * scale);
    expect(facts.textSizesPt).toHaveLength(3);
    for (const [i, pt] of [7.68, 9.6, 12].entries()) expect(facts.textSizesPt[i]).toBeCloseTo(pt * scale);
    const actual = [...renderRatioSvg(e.document).matchAll(/font-size="([\d.]+)"/g)].map((m) => +m[1] / 100 * scale * 72 / 2.54);
    for (const f of actual) expect(facts.textSizesPt.some((pt) => Math.abs(pt - f) < 1e-7)).toBe(true);
  });
  it("reports only features visible in quadratic compositions and display rounding", () => {
    const e = defaultEnvelope(); e.document.columns[0].x = "-5/2";
    e.document.columns[1].y = {kind: "answer-line"};
    let facts = valuePrintFacts(e).referenceFeatures;
    expect(facts.textSizesPt).toEqual([9.6, 12]);
    expect(facts.gridPitchMm).toEqual([2, 10, 20]);
    expect(facts.answerLineLengthsMm[0]).toBeCloseTo(e.document.print.tableWidthMm / 8 * 0.6);
    e.document.presentation.composition = "graph";
    facts = valuePrintFacts(e).referenceFeatures;
    expect(facts.textSizesPt).toEqual([12]);
    expect(facts.answerLineLengthsMm).toEqual([]); expect(facts.tableRowHeightsMm).toEqual([]);
    e.document.presentation.composition = "table"; e.document.presentation.decimalPlaces = 2;
    facts = valuePrintFacts(e).referenceFeatures;
    expect(facts.gridPitchMm).toEqual([]); expect(facts.textSizesPt).toEqual([12]);
    expect(renderSvg(e)).not.toContain('data-layer="grid"');
  });
  it("gives accurate native/reduced/enlarged sizes without changing the definition", async () => {
    const envelope = createGraph(graphSpec), source = { kind: "graph", envelope };
    const before = structuredClone(envelope), hash = await graphHash(envelope), n = native(source);
    expect(checkPlacement({ ...source, ...n }).warnings).toEqual([]);
    const small = checkPlacement({ ...source, widthMm: n.widthMm * 0.75 });
    expect(small.uniformScale).toBeCloseTo(0.75); expect(small.wouldDistort).toBe(false);
    expect(small.scaledReferenceFeatures.gridPitchMm).toEqual([7.5]);
    expect(small.scaledReferenceFeatures.textSizesPt).toEqual([9]);
    expect(small.warnings[0].code).toBe("reduced_print_size");
    const large = checkPlacement({ ...source, heightMm: n.heightMm * 2 });
    expect(large.effectivePngDpi).toBeCloseTo(300); expect(large.warnings[0].code).toBe("png_enlargement");
    expect(envelope).toEqual(before); expect(await graphHash(envelope)).toBe(hash);
  });
  it("distinguishes a box from a stretch and tolerates rounded dimensions", () => {
    const source = { kind: "graph", envelope: createGraph(graphSpec) }, n = native(source);
    expect(checkPlacement({ ...source, widthMm: Math.round(n.widthMm * 10) / 10, heightMm: Math.round(n.heightMm * 10) / 10 }).wouldDistort).toBe(false);
    const box = checkPlacement({ ...source, widthMm: n.widthMm / 2, heightMm: n.heightMm });
    expect(box.wouldDistort).toBe(true); expect(box.proportionalSizeMm.height).toBeCloseTo(n.heightMm / 2);
    expect(box.warnings.map((w) => w.code)).toContain("aspect_ratio_mismatch");
  });
  it("rejects invalid dimensions, mismatched kinds and malformed source relationships", () => {
    const source = { kind: "graph", envelope: createGraph(graphSpec) };
    for (const dimensions of [{}, {widthMm: 0}, {heightMm: -1}, {widthMm: Infinity}, {widthMm: NaN}])
      expect(() => checkPlacement({ ...source, ...dimensions })).toThrow();
    expect(() => checkPlacement({ ...source, kind: "ratio-table", widthMm: 100 })).toThrow();
    const ratio = createRatioTable(ratioSpec); ratio.document.transitions[0].factor = "0";
    expect(() => checkPlacement({kind: "ratio-table", envelope: ratio, widthMm: 100})).toThrow();
  });
});
describe("bounded bundle signing and workers", () => {
  it("signs, refreshes and rejects expiry/tamper/cross-format without a library", () => {
    const source = diagramSource({kind: "graph", envelope: createGraph(graphSpec)});
    const downloads = new BundleDownloads("https://example.com/", {test: key}, "test");
    const link = downloads.link(source, 100000);
    expect(downloads.verify(new URL(link.url), 100001)).toEqual(source);
    expect(() => downloads.verify(new URL(link.url), 100000 + 7 * 86400000)).toThrow("expired");
    const bad = new URL(link.url); bad.searchParams.set("signature", "a".repeat(43));
    expect(() => downloads.verify(bad, 100001)).toThrow("signature");
    const refresh = downloads.link(source, 200000);
    expect(refresh.url).not.toBe(link.url); expect(downloads.verify(new URL(refresh.url), 200001)).toEqual(source);
  });
  it("bounds archive members and resulting bytes independently", () => {
    const members = Object.fromEntries(ARCHIVE_NAMES.map((n) => [n, new Uint8Array(1)]));
    expect(Object.keys(unzipSync(packArchive(members)))).toEqual(ARCHIVE_NAMES);
    expect(() => packArchive({...members, "../escape": new Uint8Array(1)})).toThrow("five");
    expect(() => packArchive({...members, "diagram.png": new Uint8Array(11 * 1024 * 1024)})).toThrow("10 MiB");
    expect(() => packArchive({...members, "diagram.png": new Uint8Array(21 * 1024 * 1024)})).toThrow("20 MiB");
  });
  it("cancels packing and can service the next request", async () => {
    const queue = new RasterQueue(), members = Object.fromEntries(ARCHIVE_NAMES.map((n) => [n, new Uint8Array(1)]));
    const abort = new AbortController(); abort.abort();
    await expect(queue.pack(members, abort.signal)).rejects.toThrow("cancelled");
    expect(Object.keys(unzipSync(await queue.pack(members)))).toEqual(ARCHIVE_NAMES);
  });
});
describe("real MCP output workflows", () => {
  it("discovers schemas, advises a size and preserves retrieved bundle/source after label movement", async () => {
    const { client } = await start();
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name)).toContain("check_diagram_placement");
    function inspect(v: unknown) {
      if (!v || typeof v !== "object") return;
      expect(v).not.toHaveProperty("prefixItems");
      const s = v as Record<string, unknown>;
      if (s.type === "array") expect(s.items).toBeDefined();
      Object.values(s).forEach(inspect);
    }
    tools.forEach((t) => { inspect(t.inputSchema); inspect(t.outputSchema); });
    const call = async (name: string, args: Record<string, unknown>) => {
      const r = await client.callTool({name, arguments: args}); expect(r.isError).not.toBe(true); return r.structuredContent as Record<string, unknown>;
    };
    const first = await call("create_graph", graphSpec) as unknown as Reply;
    expect(first.printGuidance.referenceFeatures.gridPitchMm).toEqual([10]);
    expect(first.printGuidance.referenceFeatures.textSizesPt).toEqual([12]);
    const labelled = await call("revise_graph", { envelope: first.envelope, baseHash: first.contentHash, operations: [{op: "set_label", id: "main", visible: true, position: {x: "0", y: "5"}}] }) as unknown as Reply;
    const moved = await call("revise_graph", { envelope: labelled.envelope, baseHash: labelled.contentHash, operations: [{op: "set_label", id: "main", position: {x: "1", y: "6"}}] }) as unknown as Reply;
    expect(moved.envelope.document.axes).toEqual(labelled.envelope.document.axes);
    expect(moved.envelope.document.objects[1]).toEqual(labelled.envelope.document.objects[1]);
    const expected = structuredClone(labelled.envelope); const line = expected.document.objects[0];
    if (line.kind !== "straight") throw Error("fixture"); line.equationLabelPosition = {x: 1, y: 6};
    expect(moved.envelope).toEqual(expected);
    const placement = await call("check_diagram_placement", {kind: "graph", envelope: moved.envelope, widthMm: moved.physicalSizeCm.width * 7.5});
    expect(placement.uniformScale).toBeCloseTo(0.75);
    const bundle = await call("download_diagram_bundle", {kind: "graph", envelope: moved.envelope});
    const response = await fetch((bundle.download as {url: string}).url); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Object.keys(files)).toEqual(ARCHIVE_NAMES);
    expect(JSON.parse(Buffer.from(files["source.json"]).toString())).toEqual(moved.envelope);
    expect(JSON.parse(Buffer.from(files["print-info.json"]).toString()).printGuidance).toEqual(moved.printGuidance);
    const pngSize = printRasterSize(moved.physicalSizeCm.width, moved.physicalSizeCm.height);
    verifyPrintBytes(files["diagram.png"], pngSize.width, pngSize.height);
    expect(Buffer.from(files["diagram.svg"]).toString()).toBe(await (await fetch(moved.downloads.svg.url)).text());
    expect(Buffer.from(files["README.txt"]).toString()).not.toMatch(/signature=|token=/);
    const broken = await client.callTool({name: "download_diagram_bundle", arguments: {kind: "ratio-table", envelope: moved.envelope}});
    expect(broken.isError).toBe(true);
    expect((await client.callTool({name: "create_graph", arguments: graphSpec})).isError).not.toBe(true);
  }, 30000);
  it("bundles ratio blanks/zero/deliberate errors and quadratic scaffold with reopened source", async () => {
    const { client } = await start();
    const ratio = createRatioTable(ratioSpec);
    ratio.document.rows[0].cells[0] = {kind: "number", value: "0"};
    const value = defaultEnvelope();
    value.document.columns[1].y = {kind: "answer-line"}; value.document.columns[2].y = {kind: "value", value: "0"};
    value.document.columns[4].y = {kind: "value", value: "1/2"};
    for (const source of [{kind: "ratio-table", envelope: ratio}, {kind: "value-graph", envelope: value}]) {
      const before = structuredClone(source);
      const reply = await client.callTool({name: "download_diagram_bundle", arguments: source}); expect(reply.isError).not.toBe(true);
      const url = ((reply.structuredContent as Record<string, unknown>).download as {url: string}).url;
      const files = unzipSync(new Uint8Array(await (await fetch(url)).arrayBuffer()));
      const saved = JSON.parse(Buffer.from(files["source.json"]).toString());
      expect(saved).toEqual(source.envelope); expect(source).toEqual(before);
      if (source.kind === "ratio-table") expect(validateRatioEnvelope(saved)).toEqual(source.envelope);
      else expect(decode(Buffer.from(JSON.stringify(saved)).toString("base64url"))).toEqual(source.envelope);
      expect(Buffer.from(files["diagram.svg"]).toString()).not.toMatch(/<text|<image|disagree/);
    }
    expect(await ratioHash(ratio)).toBe(await ratioHash(validateRatioEnvelope(ratio)));
    expect(await valueHash(value)).toHaveLength(64);
  }, 30000);
  it("uses bounded inline ZIP for a long source and reports legacy font conversion explicitly", async () => {
    const {client} = await start();
    const e = createGraph({schemaVersion: 1, objects: Array.from({length: 50}, (_, i) => ({kind: "line", id: "long-name-" + i, equation: {kind: "slope", slope: i / 3, intercept: i / 7}, equationVisible: true}))});
    const reply = await client.callTool({name: "download_diagram_bundle", arguments: {kind: "graph", envelope: e}});
    expect(reply.isError).not.toBe(true); expect((reply.structuredContent as Record<string, unknown>).inline).toBe(true);
    const resource = (reply.content as Array<{type: string; resource?: {blob: string}}>).find((c) => c.type === "resource")!.resource!;
    expect(JSON.parse(Buffer.from(unzipSync(Buffer.from(resource.blob, "base64"))["source.json"]).toString())).toEqual(e);
    const legacy = {...e, styleProfile: "legacy"};
    const bad = await client.callTool({name: "download_diagram_bundle", arguments: {kind: "graph", envelope: legacy}});
    expect(bad.isError).toBe(true); expect(JSON.stringify(bad.content)).toContain("explicit portable conversion");
  }, 30000);
});
