// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { graphService } from "./server";
import {
  example,
  create,
  canonical,
  renderSvg,
  type Envelope,
} from "../../packages/algebra-grid-core/src/index";
import { hash, revise } from "../../packages/algebra-grid-core/src/interchange";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
const clients: Client[] = [],
  servers: Server[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))),
  );
});
async function start() {
  const reserve = createServer();
  await new Promise<void>((r) => reserve.listen(0, "127.0.0.1", r));
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>((r) => reserve.close(() => r()));
  const base = `http://127.0.0.1:${port}`;
  const server = graphService({
    publicUrl: base,
    editorUrl: "https://mathsdock.co.uk/",
    keys: { test: "algebra-qualification-synthetic-key-only" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "algebra-qualification", version: "1" });
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL(base + "/mcp")),
  );
  return client;
}
type Result = {
  envelope: Envelope;
  contentHash: string;
  downloads: Record<string, { url: string }>;
  physicalSizeCm: { width: number; height: number };
  printRaster: { width: number; height: number };
  editorUrl: string;
};
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<Result> {
  const r = await client.callTool({ name, arguments: args });
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  return r.structuredContent as Result;
}
it("advertises the three new tools and homogeneous schemas", async () => {
  const c = await start(),
    tools = (await c.listTools()).tools;
  expect(tools).toHaveLength(24);
  for (const name of [
    "algebra_grid_capabilities",
    "create_algebra_grid",
    "revise_algebra_grid",
  ])
    expect(tools.some((t) => t.name === name)).toBe(true);
  const cap = await c.callTool({
    name: "algebra_grid_capabilities",
    arguments: {},
  });
  expect(cap.isError).not.toBe(true);
  expect(JSON.stringify(cap.content)).toContain("calculate_answer");
  expect(
    JSON.stringify(
      tools.find((t) => t.name === "create_algebra_grid")!.inputSchema,
    ),
  ).not.toContain("prefixItems");
  expect(
    JSON.stringify(
      tools.find((t) => t.name === "get_diagram_svg")!.inputSchema,
    ),
  ).toContain("algebra-grid");
});
it.each(["single", "double", "cubic", "factor", "signed"])(
  "%s creates exact native files and retains pupil state",
  async (name) => {
    const c = await start(),
      input = { spec: { example: name } },
      before = JSON.stringify(input),
      r = await call(c, "create_algebra_grid", input);
    expect(JSON.stringify(input)).toBe(before);
    expect(r.envelope).toEqual(example(name));
    expect(await hash(r.envelope)).toBe(r.contentHash);
    const svg = Buffer.from(
      await (await fetch(r.downloads.svg.url)).arrayBuffer(),
    );
    expect(svg.toString()).not.toContain("<text");
    expect(svg.toString()).not.toContain("<image");
    expect(svg.toString()).toContain('mm"');
    const png = new Uint8Array(
      await (await fetch(r.downloads.png.url)).arrayBuffer(),
    );
    verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);
    expect(await (await fetch(r.downloads.json.url)).json()).toEqual(
      r.envelope,
    );
    expect(
      JSON.parse(
        Buffer.from(new URL(r.editorUrl).hash.slice(14), "base64url").toString(
          "utf8",
        ),
      ),
    ).toEqual(r.envelope);
    const refreshed = await call(c, "revise_algebra_grid", {
      envelope: r.envelope,
      baseHash: r.contentHash,
      operations: [],
    });
    expect(refreshed.envelope).toEqual(r.envelope);
    expect(refreshed.contentHash).toBe(r.contentHash);
  },
);
it("preserves blanks,hidden answers and zero; only explicit calculations supply answers", async () => {
  const c = await start(),
    r = await call(c, "create_algebra_grid", {
      spec: {
        example: "double",
      settings: { intentionalError: true },
        cells: [
          { rowId: "r1", columnId: "c1", value: "x^2", hidden: true },
          { rowId: "r1", columnId: "c2", value: "0" },
        ],
      },
    });
  expect(r.envelope.document.rows[1].cells[1]).toEqual({
    value: "x^2",
    hidden: true,
  });
  expect(r.envelope.document.rows[2].cells[1].value).toBe(null);
  const a = await call(c, "create_algebra_grid", {
    spec: { example: "factor" },
  });
  const answer = await call(c, "revise_algebra_grid", {
    envelope: a.envelope,
    baseHash: a.contentHash,
    operations: [{ op: "calculate_answer" }],
  });
  expect(answer.envelope.document.rows).toEqual(a.envelope.document.rows);
  expect(answer.envelope.document.answerVisible).toBe(true);
  expect(a.envelope.document.answer).toBe("");
  const worked = await call(c, "revise_algebra_grid", {
    envelope: a.envelope,
    baseHash: a.contentHash,
    operations: [{ op: "worked_copy" }],
  });
  expect(worked.envelope.document.rows[1].cells[2].value).not.toBe(null);
});
it("rejects stale hashes,partial transactions,unknown IDs and implicit overwrites without mutating sources", async () => {
  const e = example(),
    before = canonical(e);
  await expect(
    revise({ envelope: e, baseHash: "0".repeat(64), operations: [] }),
  ).rejects.toThrow("base_hash_mismatch");
  await expect(
    revise({
      envelope: e,
      baseHash: await hash(e),
      operations: [
        { op: "set_cell", rowId: "r1", columnId: "c1", value: "0" },
        { op: "set_cell", rowId: "missing", columnId: "c1", value: "2" },
      ],
    }),
  ).rejects.toThrow("stable");
  expect(canonical(e)).toBe(before);
  const c = await start(),
    r = await call(c, "create_algebra_grid", {
      envelope: example("double", true),
    });
  const failed = await c.callTool({
    name: "revise_algebra_grid",
    arguments: {
      envelope: r.envelope,
      baseHash: r.contentHash,
      operations: [{ op: "fill_products" }],
    },
  });
  expect(failed.isError).toBe(true);
  expect(
    (
      await c.callTool({
        name: "create_algebra_grid",
        arguments: { spec: {}, envelope: e },
      })
    ).isError,
  ).toBe(true);
});
it("bundles and exact multichunk SVG share identical bytes and retain native placement facts", async () => {
  const c = await start(),
    r = await call(c, "create_algebra_grid", {
      spec: {
        example: "cubic",
        cellMm: 18,
        settings: { questionVisible: true, answerLines: 2 },
      },
    });
  const expected = Buffer.from(
    await (await fetch(r.downloads.svg.url)).arrayBuffer(),
  );
  let offset = 0,
    checksum: string | undefined;
  const chunks: Buffer[] = [];
  do {
    const reply = await c.callTool({
      name: "get_diagram_svg",
      arguments: {
        kind: "algebra-grid",
        envelope: r.envelope,
        maxChunkBytes: 2048,
        offsetBytes: offset,
        ...(checksum ? { expectedSvgSha256: checksum } : {}),
      },
    });
    expect(reply.isError).not.toBe(true);
    const v = reply.structuredContent as {
      svgChunk: string;
      chunkBytes: number;
      chunkSha256: string;
      svgSha256: string;
      sourceContentHash: string;
      nextOffsetBytes: number | null;
    };
    const b = Buffer.from(v.svgChunk);
    expect(b.length).toBe(v.chunkBytes);
    expect(createHash("sha256").update(b).digest("hex")).toBe(v.chunkSha256);
    expect(v.sourceContentHash).toBe(r.contentHash);
    checksum = v.svgSha256;
    chunks.push(b);
    offset = v.nextOffsetBytes ?? 0;
  } while (offset);
  expect(Buffer.concat(chunks)).toEqual(expected);
  expect(chunks.length).toBeGreaterThan(1);
  const bundle = await c.callTool({
    name: "download_diagram_bundle",
    arguments: { kind: "algebra-grid", envelope: r.envelope },
  });
  expect(bundle.isError).not.toBe(true);
  const link = (bundle.structuredContent as { download: { url: string } })
    .download;
  const files = unzipSync(
    new Uint8Array(await (await fetch(link.url)).arrayBuffer()),
  );
  expect(Buffer.from(files["diagram.svg"])).toEqual(expected);
  expect(JSON.parse(Buffer.from(files["source.json"]).toString())).toEqual(
    r.envelope,
  );
  const advice = await c.callTool({
    name: "check_diagram_placement",
    arguments: {
      kind: "algebra-grid",
      envelope: r.envelope,
      widthMm: r.physicalSizeCm.width * 5,
    },
  });
  expect(advice.isError).not.toBe(true);
  expect(
    (advice.structuredContent as { uniformScale: number }).uniformScale,
  ).toBeCloseTo(0.5);
});
it("renders maximum blank writing space and preserves legacy cell dimensions", async () => {
  const c = await start(),
    maximum = await call(c, "create_algebra_grid", { envelope: create(7, 7) });
  expect(maximum.physicalSizeCm).toEqual({ width: 10.5, height: 10.5 });
  const legacy = JSON.parse(
    readFileSync(
      "packages/algebra-grid-core/fixtures/first-draft-factor.json",
      "utf8",
    ),
  );
  const old = await call(c, "create_algebra_grid", { envelope: legacy });
  expect(old.physicalSizeCm).toEqual({ width: 4.5, height: 4.5 });
  expect(old.envelope.document.gridLineMm).toBe(0.2);
  expect(renderSvg(old.envelope)).toContain('stroke-width="0.2"');
});
