// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import { graphService } from "./server";
import { sliceSvg, svgDeliveryResult, svgSha256, SVG_CHUNK_BYTES, SVG_RESPONSE_BYTES, SVG_FILE_BYTES, type SvgDelivery, type SvgDeliveryInput } from "./svg-delivery";
import { receiveSvg } from "./svg-consumer";
import { createGraph } from "../../packages/graph-core/src/interchange";
import { create as createLegacyVenn } from "../../packages/venn-core/src/index";

const servers: Server[] = [], clients: Client[] = [];
afterEach(async () => { await Promise.all(clients.splice(0).map(c => c.close())); await Promise.all(servers.splice(0).map(s => new Promise<void>(r => s.close(() => r())))); });
async function start(options: { dailyBytes?: number; renderTimeoutMs?: number; workerFile?: string } = {}) {
  const reserve = createServer(); await new Promise<void>(r => reserve.listen(0, "127.0.0.1", r));
  const port = (reserve.address() as { port: number }).port; await new Promise<void>(r => reserve.close(() => r()));
  const base = `http://127.0.0.1:${port}`, server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: "synthetic-svg-delivery-not-a-production-key" }, activeKey: "test", ...options });
  servers.push(server); await new Promise<void>(r => server.listen(port, "127.0.0.1", r));
  const requests: string[] = [], client = new Client({ name: "restricted-original-svg-consumer", version: "1" }); clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { fetch: async (url, init) => {
    const target = new URL(url instanceof Request ? url.url : String(url));
    if (target.pathname !== "/mcp") throw Error("Simulated restricted consumer cannot fetch artifact URLs.");
    requests.push(target.pathname); return fetch(url, init);
  } }));
  return { client, base, requests };
}
async function call(client: Client, input: SvgDeliveryInput) {
  const r = await client.callTool({ name: "get_diagram_svg", arguments: input });
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  const data = r.structuredContent as SvgDelivery;
  expect(JSON.parse((r.content as Array<{ text: string }>)[0].text)).toEqual(data);
  expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThan(SVG_RESPONSE_BYTES);
  return data;
}
const source = { kind: "graph" as const, envelope: createGraph({ schemaVersion: 1, objects: [] }) };
function artificial(bytes: Buffer, offset = 0, size = 1024): SvgDelivery {
  return { kind: "graph", filename: "diagram.svg", mimeType: "image/svg+xml", encoding: "utf-8",
    rendererVersion: "graph-1", sourceContentHash: "a".repeat(64), physicalSizeCm: { width: 10, height: 10 },
    ...sliceSvg(bytes, offset, size, offset ? svgSha256(bytes) : undefined) };
}
describe("bounded original SVG byte transport", () => {
  it("reassembles multibyte boundaries, escapes and CRLF without normalization", async () => {
    const bytes = Buffer.from('<svg>\r\n<!--' + 'x'.repeat(1010) + '😀定µ\\"'.repeat(300) + '-->\r\n</svg>');
    const read = async (input: SvgDeliveryInput) => artificial(bytes, input.offsetBytes);
    const result = await receiveSvg(read, { ...source, maxChunkBytes: 1024 });
    expect(result.body).toEqual(bytes); expect(result.chunks).toBeGreaterThan(1);
    expect(result.svgSha256).toBe(svgSha256(bytes));
  });
  it("rejects invalid offsets, code-point boundaries, EOF, chunk sizes and missing hashes", () => {
    const bytes = Buffer.from('<svg>😀</svg>');
    for (const offset of [-1, 1.5, 6, bytes.length, bytes.length + 1]) expect(() => sliceSvg(bytes, offset)).toThrow();
    expect(() => sliceSvg(bytes, 5)).toThrow("expectedSvgSha256");
    for (const size of [0, 1023, SVG_CHUNK_BYTES + 1]) expect(() => sliceSvg(bytes, 0, size)).toThrow();
    expect(() => sliceSvg(bytes, 0, 1024, "0".repeat(64))).toThrow("differs");
    expect(() => sliceSvg(Buffer.from([255]))).toThrow("UTF-8");
    expect(() => sliceSvg(Buffer.alloc(0))).toThrow("nonempty");
    expect(() => sliceSvg(Buffer.alloc(SVG_FILE_BYTES + 1))).toThrow("10 MiB");
  });
  it.each(["offset", "truncated", "checksum", "identity", "complete", "next", "total", "view", "source", "dimensions"])("rejects %s corruption without returning a file", async mode => {
    const bytes = Buffer.from('<svg>' + 'x'.repeat(2500) + '</svg>'); let count = 0;
    const read = async (input: SvgDeliveryInput) => {
      const p = artificial(bytes, input.offsetBytes); count++;
      if (mode === "view") p.outputView = "answer";
      if (mode === "source") p.sourceContentHash = "b".repeat(64);
      if (mode === "dimensions") p.physicalSizeCm.width = 11;
      if (count > 1) {
        if (mode === "offset") p.offsetBytes = 0;
        if (mode === "truncated") p.svgChunk = p.svgChunk.slice(1);
        if (mode === "checksum") p.chunkSha256 = "0".repeat(64);
        if (mode === "identity") p.svgSha256 = "0".repeat(64);
        if (mode === "complete") p.complete = true;
        if (mode === "next") p.nextOffsetBytes = 1;
        if (mode === "total") p.totalBytes++;
      }
      return p;
    };
    await expect(receiveSvg(read, { ...source, maxChunkBytes: 1024 }, { expectedSourceContentHash: "a".repeat(64), expectedPhysicalSizeCm: { width: 10, height: 10 } })).rejects.toThrow();
  });
  it("bounds continuation count and verifies the complete hash independently of chunk hashes", async () => {
    const bytes = Buffer.from('<svg>' + 'x'.repeat(2500) + '</svg>');
    await expect(receiveSvg(async i => artificial(bytes, i.offsetBytes), { ...source, maxChunkBytes: 1024 }, { maxChunks: 1 })).rejects.toThrow("bounded chunk count");
    await expect(receiveSvg(async i => ({ ...artificial(bytes, i.offsetBytes), svgSha256: "0".repeat(64) }), { ...source, maxChunkBytes: 1024 })).rejects.toThrow("Complete SVG");
  });
  it("caps the actual escaped and duplicated JSON, allowing smaller chunks", () => {
    const bytes = Buffer.from('<svg><!--' + '\\'.repeat(SVG_CHUNK_BYTES) + '--></svg>');
    expect(() => svgDeliveryResult(artificial(bytes, 0, SVG_CHUNK_BYTES))).toThrow("256 KiB");
    const { result, responseBytes } = svgDeliveryResult(artificial(bytes, 0, 16384));
    expect(responseBytes).toBe(Buffer.byteLength(JSON.stringify(result)));
    expect(responseBytes).toBeLessThan(SVG_RESPONSE_BYTES);
  });
});

describe("real MCP SVG delivery with artifact downloads disabled in the consumer", () => {
  const fixtures = [
    { kind: "graph", name: "graph", args: { schemaVersion: 1, objects: [] } },
    { kind: "ratio-table", name: "ratio_table", args: { schemaVersion: 1, rows: [{ cells: [{ kind: "number", value: "2/3" }, { kind: "answer-line" }] }, { cells: [{ kind: "number", value: "0" }, { kind: "empty" }] }] } },
    { kind: "value-graph", name: "value_graph", args: {} },
    { kind: "cuboids", name: "cuboid", args: { spec: { shapes: [{ labels: { width: { mode: "blank" } } }] } } },
    { kind: "number-line", name: "number_line", args: { spec: { teaching: { labels: { "0": "answer-line" }, answer: "x > 0", answerVisible: false } } } },
    { kind: "venn", name: "venn", args: { spec: { regions: [{ mask: 1, region: { kind: "number", text: "0", visibility: "hidden" } }] } } },
  ];
  it.each(fixtures)("$kind returns exact signed-download bytes without external consumer fetching", async f => {
    const { client, requests } = await start();
    const created = await client.callTool({ name: `create_${f.name}`, arguments: f.args }); expect(created.isError).not.toBe(true);
    const a = created.structuredContent as { envelope: SvgDeliveryInput["envelope"]; contentHash: string; physicalSizeCm: { width: number; height: number }; downloads: { svg: { url: string } } };
    const before = JSON.stringify(a.envelope);
    const file = await receiveSvg(i => call(client, i), { kind: f.kind as SvgDeliveryInput["kind"], envelope: a.envelope, maxChunkBytes: 16384 }, { expectedSourceContentHash: a.contentHash, expectedPhysicalSizeCm: a.physicalSizeCm });
    // Independent control request is deliberately outside the restricted consumer.
    const control = await fetch(a.downloads.svg.url); expect(control.status).toBe(200);
    expect(file.body).toEqual(Buffer.from(await control.arrayBuffer()));
    expect(file.body.toString()).not.toMatch(/<(?:text|image|script|foreignObject)\b/);
    expect(JSON.stringify(a.envelope)).toBe(before); expect(requests.every(p => p === "/mcp")).toBe(true);
  }, 30000);
  it("preserves pupil source while pinning answer-view Venn chunks", async () => {
    const { client } = await start(); const created = await client.callTool({ name: "create_venn", arguments: { spec: { regions: [{ mask: 1, region: { kind: "number", text: "37", visibility: "hidden" } }] } } });
    const a = created.structuredContent as { envelope: SvgDeliveryInput["envelope"]; contentHash: string };
    const pupil = await call(client, { kind: "venn", envelope: a.envelope });
    const answer = await call(client, { kind: "venn", envelope: a.envelope, outputView: "answer" });
    expect(answer.sourceContentHash).toBe(a.contentHash); expect(pupil.sourceContentHash).toBe(a.contentHash);
    expect(answer.svgSha256).not.toBe(pupil.svgSha256);
    const wrong = await client.callTool({ name: "get_diagram_svg", arguments: { kind: "venn", envelope: a.envelope, outputView: "answer", expectedSvgSha256: pupil.svgSha256 } });
    expect(wrong.isError).toBe(true); expect(JSON.stringify(wrong.content)).toContain("svg_hash_mismatch");
  }, 30000);
  it("reconstructs a maximum-object graph exactly when its ordinary links are too long", async () => {
    const { client } = await start();
    const created = await client.callTool({ name: "create_graph", arguments: {
      schemaVersion: 1, objects: Array.from({ length: 50 }, (_, i) => ({
        kind: "line", id: `long-name-${i}`, equation: { kind: "slope", slope: i / 3, intercept: i / 7 }, equationVisible: true,
      })),
    } });
    expect(created.isError).not.toBe(true);
    const data = created.structuredContent as { envelope: SvgDeliveryInput["envelope"]; contentHash: string; downloads: Record<string, unknown> };
    expect(data.downloads).toEqual({});
    const original = (created.content as Array<{ type: string; resource?: { mimeType: string; text?: string } }>).find(c => c.resource?.mimeType === "image/svg+xml")?.resource?.text;
    expect(original).toBeTypeOf("string");
    const result = await receiveSvg(i => call(client, i), { kind: "graph", envelope: data.envelope }, { expectedSourceContentHash: data.contentHash });
    expect(result.body).toEqual(Buffer.from(original!, "utf8"));
    expect(result.chunks).toBeGreaterThan(1);
  }, 30000);
  it.each(["cuboids", "venn"])("retains legacy %s schema and exact SVG", async kind => {
    const { client } = await start();
    const file = kind === "cuboids" ? "packages/cuboid-core/src/fixtures/v1.json" : "";
    const envelope = kind === "cuboids" ? JSON.parse(readFileSync(file, "utf8"))[0].envelope : createLegacyVenn();
    const before = JSON.stringify(envelope);
    const r = await call(client, { kind: kind as "cuboids" | "venn", envelope });
    expect(r.rendererVersion).toBe(kind === "cuboids" ? "cuboids-1" : "venn-1");
    const created = await client.callTool({ name: kind === "cuboids" ? "create_cuboid" : "create_venn", arguments: { envelope } });
    expect(created.isError).not.toBe(true);
    const url = (created.structuredContent as { downloads: { svg: { url: string } } }).downloads.svg.url;
    const full = await receiveSvg(i => call(client, i), { kind: kind as "cuboids" | "venn", envelope });
    expect(full.body).toEqual(Buffer.from(await (await fetch(url)).arrayBuffer()));
    expect(JSON.stringify(envelope)).toBe(before);
  }, 30000);
  it("rejects missing continuation hash before rendering and invalid sources", async () => {
    const { client } = await start();
    const r = await client.callTool({ name: "get_diagram_svg", arguments: { ...source, offsetBytes: 1 } });
    expect(r.isError).toBe(true); expect(JSON.stringify(r.content)).toContain("svg_hash_required");
    const bad = await client.callTool({ name: "get_diagram_svg", arguments: { ...source, kind: "venn" } }); expect(bad.isError).toBe(true);
  });
  it("enforces daily output quota on the actual MCP delivery", async () => {
    const { client } = await start({ dailyBytes: 1 });
    const r = await client.callTool({ name: "get_diagram_svg", arguments: source });
    expect(r.isError).toBe(true); expect(JSON.stringify(r.content)).toContain("allowance");
    expect(r.structuredContent).toBeUndefined();
  }, 30000);
  it("reports worker failure without claiming a complete file", async () => {
    const { client } = await start({ workerFile: "service-dist/no-such-worker.js" });
    const r = await client.callTool({ name: "get_diagram_svg", arguments: source });
    expect(r.isError).toBe(true); expect(r.structuredContent).toBeUndefined();
  }, 30000);
  it("keeps renderer timeouts bounded for direct delivery", async () => {
    const { client } = await start({ workerFile: "services/graph-mcp/testing-hung-worker.mjs", renderTimeoutMs: 100 });
    const r = await client.callTool({ name: "get_diagram_svg", arguments: source });
    expect(r.isError).toBe(true); expect(JSON.stringify(r.content)).toContain("render_timeout");
    expect(r.structuredContent).toBeUndefined();
  }, 10000);
  it("honours cancellation and leaves the source intact", async () => {
    const { client } = await start({ workerFile: "services/graph-mcp/testing-hung-worker.mjs", renderTimeoutMs: 1000 });
    const before = JSON.stringify(source), controller = new AbortController();
    const pending = client.callTool({ name: "get_diagram_svg", arguments: source }, undefined, { signal: controller.signal });
    const timer = setTimeout(() => controller.abort(new Error("consumer cancelled")), 100);
    try { await expect(pending).rejects.toThrow("consumer cancelled"); }
    finally { clearTimeout(timer); }
    expect(JSON.stringify(source)).toBe(before);
    // A subsequent MCP call remains available; the cancelled result was never a file.
    expect((await client.listTools()).tools.some(t => t.name === "get_diagram_svg")).toBe(true);
  }, 10000);
});
