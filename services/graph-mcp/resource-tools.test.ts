// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { unzipSync } from "fflate";
import { graphService } from "./server";
import { ResourceDownloads } from "./resource-downloads";
import { diagramSource } from "./diagram-source";
import { createVenn } from "../../packages/venn-core/src/interchange";
import { createCuboid } from "../../packages/cuboid-core/src/interchange";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import { RasterQueue } from "./raster";
const key = "synthetic-six-tools-test-only-not-a-production-key";
const servers: Server[] = [],
  clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))),
  );
});
async function start() {
  const reservation = createServer();
  await new Promise<void>((r) => reservation.listen(0, "127.0.0.1", r));
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((r) => reservation.close(() => r()));
  const base = `http://127.0.0.1:${port}`,
    server = graphService({
      publicUrl: base,
      editorUrl: "https://mathsdock.co.uk/",
      keys: { test: key },
      activeKey: "test",
    });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "six-tool-acceptance", version: "1" });
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${base}/mcp`)),
  );
  return { client, base };
}
type Reply = {
  envelope: Record<string, unknown>;
  contentHash: string;
  downloads: Record<string, { url: string }>;
  editorUrl: string | null;
  physicalSizeCm: { width: number; height: number };
  printRaster: { width: number; height: number };
  outputView?: string;
  printVerified: boolean;
  warnings: string[];
};
async function call(
  c: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const r = await c.callTool({ name, arguments: args });
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  return r.structuredContent as unknown as Reply;
}
const cases = [
  {
    kind: "cuboids",
    name: "cuboid",
    args: {
      spec: {
        shapes: [
          { labels: { width: { mode: "blank" } }, caption: "Volume = 99 cm³" },
        ],
      },
    },
    ops: [{ op: "set_dimension", id: "cuboid-1", axis: "depth", value: "5/2" }],
  },
  {
    kind: "number-line",
    name: "number_line",
    args: {
      spec: {
        solution: {
          kind: "interval",
          id: "solution",
          lower: "-3",
          upper: "2",
          lowerIncluded: true,
          upperIncluded: false,
        },
        teaching: {
          labels: { "0": "answer-line" },
          answer: "x < 2",
          answerVisible: false,
        },
      },
    },
    ops: [
      { op: "set_endpoint", id: "solution", endpoint: "upper", value: "5/2" },
    ],
  },
  {
    kind: "venn",
    name: "venn",
    args: {
      spec: {
        regions: [
          {
            mask: 1,
            region: { kind: "number", text: "0", visibility: "hidden" },
          },
          {
            mask: 3,
            region: { kind: "number", text: "1/2", visibility: "line" },
          },
        ],
      },
    },
    ops: [
      {
        op: "shade_expression",
        expression: "A ∩ B",
        style: "hatch",
        mode: "replace",
      },
    ],
  },
];
describe("three new families through actual MCP/HTTP", () => {
  it("discovers twenty-one tools with typed operations, bounded homogeneous arrays and no tuple items", async () => {
    const { client } = await start(),
      tools = (await client.listTools()).tools;
    expect(tools).toHaveLength(21);
    for (const c of cases) {
      const tool = tools.find((t) => t.name === `revise_${c.name}`)!;
      expect(tool.inputSchema.properties).toHaveProperty("operations");
      expect(JSON.stringify(tool.inputSchema)).not.toContain('"prefixItems"');
      const cap = await client.callTool({
        name: `${c.name}_capabilities`,
        arguments: {},
      });
      expect(cap.isError).not.toBe(true);
    }
  });
  it.each(cases)(
    "$kind creates/revises/refreshes real files, rejects stale/partial edits and bundles",
    async (c) => {
      const { client } = await start();
      const a = await call(client, `create_${c.name}`, c.args);
      expect(a.printVerified).toBe(true);
      expect(a.editorUrl).toContain("https://mathsdock.co.uk/?tool=");
      const n = await call(client, `revise_${c.name}`, {
        envelope: a.envelope,
        baseHash: a.contentHash,
        operations: c.ops,
      });
      expect(n.contentHash).not.toBe(a.contentHash);
      const fresh = await call(client, `revise_${c.name}`, {
        envelope: n.envelope,
        baseHash: n.contentHash,
        operations: [],
      });
      expect(fresh.envelope).toEqual(n.envelope);
      expect(fresh.contentHash).toBe(n.contentHash);
      const bad = await client.callTool({
        name: `revise_${c.name}`,
        arguments: {
          envelope: n.envelope,
          baseHash: "0".repeat(64),
          operations: [],
        },
      });
      expect(bad.isError).toBe(true);
      const partial = await client.callTool({
        name: `revise_${c.name}`,
        arguments: {
          envelope: n.envelope,
          baseHash: n.contentHash,
          operations: [...c.ops, { op: "nonexistent" }],
        },
      });
      expect(partial.isError).toBe(true);
      const formats: Record<string, Uint8Array> = {};
      for (const format of ["json", "svg", "png"]) {
        const r = await fetch(n.downloads[format].url);
        expect(r.status).toBe(200);
        formats[format] = new Uint8Array(await r.arrayBuffer());
      }
      expect(JSON.parse(Buffer.from(formats.json).toString())).toEqual(
        n.envelope,
      );
      const svg = Buffer.from(formats.svg).toString();
      expect(svg).not.toMatch(/<(text|image|script|foreignObject)\b/);
      expect(svg).not.toContain("Coordinate graph");
      expect(svg).toContain(`width="${n.physicalSizeCm.width}cm"`);
      verifyPrintBytes(formats.png, n.printRaster.width, n.printRaster.height);
      const b = await client.callTool({
        name: "download_diagram_bundle",
        arguments: { kind: c.kind, envelope: n.envelope },
      });
      expect(b.isError, JSON.stringify(b.content)).not.toBe(true);
      const link = (b.structuredContent as { download: { url: string } })
        .download.url;
      const download = await fetch(link);
      expect(download.status).toBe(200);
      const zip = unzipSync(new Uint8Array(await download.arrayBuffer()));
      expect(Object.keys(zip).sort()).toEqual(
        [
          "source.json",
          "diagram.svg",
          "diagram.png",
          "print-info.json",
          "README.txt",
        ].sort(),
      );
      expect(JSON.parse(Buffer.from(zip["source.json"]).toString())).toEqual(
        n.envelope,
      );
      expect(zip["diagram.png"]).toEqual(formats.png);
      expect(
        JSON.parse(Buffer.from(zip["print-info.json"]).toString())
          .physicalSizeCm,
      ).toEqual(n.physicalSizeCm);
      const advice = await client.callTool({
        name: "check_diagram_placement",
        arguments: {
          kind: c.kind,
          envelope: n.envelope,
          widthMm: n.physicalSizeCm.width * 5,
        },
      });
      expect(advice.isError, JSON.stringify(advice.content)).not.toBe(true);
      expect(
        (advice.structuredContent as { uniformScale: number }).uniformScale,
      ).toBeCloseTo(0.5);
    },
    30000,
  );
  it("binds answer view to signed files and ZIP while retaining pupil envelope/hash", async () => {
    const { client } = await start();
    const a = await call(client, "create_venn", cases[2].args);
    const answer = await call(client, "revise_venn", {
      envelope: a.envelope,
      baseHash: a.contentHash,
      operations: [],
      outputView: "answer",
    });
    expect(answer.envelope).toEqual(a.envelope);
    expect(answer.contentHash).toBe(a.contentHash);
    expect(answer.outputView).toBe("answer");
    const pupilSvg = await (await fetch(a.downloads.svg.url)).text(),
      answerSvg = await (await fetch(answer.downloads.svg.url)).text();
    expect(answerSvg).not.toBe(pupilSvg);
    expect(await (await fetch(answer.downloads.json.url)).json()).toEqual(
      a.envelope,
    );
    const b = await client.callTool({
      name: "download_diagram_bundle",
      arguments: { kind: "venn", envelope: a.envelope, outputView: "answer" },
    });
    expect(b.isError).not.toBe(true);
    const zip = unzipSync(
      new Uint8Array(
        await (
          await fetch(
            (b.structuredContent as { download: { url: string } }).download.url,
          )
        ).arrayBuffer(),
      ),
    );
    expect(Buffer.from(zip["diagram.svg"]).toString()).toBe(answerSvg);
    expect(JSON.parse(Buffer.from(zip["source.json"]).toString())).toEqual(
      a.envelope,
    );
    expect(
      JSON.parse(Buffer.from(zip["print-info.json"]).toString()).outputView,
    ).toBe("answer");
    const url = new URL(answer.downloads.svg.url);
    const token = JSON.parse(
      Buffer.from(url.searchParams.get("token")!, "base64url").toString(),
    );
    token.source.outputView = "pupil";
    url.searchParams.set(
      "token",
      Buffer.from(JSON.stringify(token)).toString("base64url"),
    );
    expect((await fetch(url)).status).toBe(400);
  }, 30000);
  it("signs family, source, format, view, expiry and keys; retains previous keys", () => {
    const d = new ResourceDownloads("https://example.com", { old: key }, "old"),
      s = diagramSource({
        kind: "venn",
        envelope: createVenn(),
        outputView: "answer",
      });
    const link = d.link(s, "svg", 1000);
    expect(d.verify(new URL(link.url), 1001).source).toEqual(s);
    expect(() => d.verify(new URL(link.url), 8 * 86400000)).toThrow("expired");
    const rotated = new ResourceDownloads(
      "https://example.com",
      { old: key, next: key + "new" },
      "next",
    );
    expect(rotated.verify(new URL(link.url), 1001).source).toEqual(s);
    expect(
      () =>
        new ResourceDownloads("https://example.com", { test: "short" }, "test"),
    ).toThrow();
  });
  it("uses bounded inline files for a large complete UTF-8 Venn resource", async () => {
    const { client } = await start();
    const e = createVenn({ spec: { sets: 3, widthCm: 16, fontPt: 9 } });
    // Hidden text is retained without compromising print layout, and is large enough for signed URLs to fall back.
    e.document.definitions = Array.from({ length: 4 }, () => "定".repeat(100));
    e.document.showDefinitions = false;
    for (const r of e.document.regions) {
      r.kind = "text";
      r.text = "α".repeat(30);
      r.visibility = "hidden";
    }
    for (const r of e.document.regions.slice(0, 2)) {
      r.kind = "members";
      r.text = Array.from({ length: 20 }, () => "定".repeat(31)).join(",");
    }
    const r = await client.callTool({
      name: "create_venn",
      arguments: { envelope: e },
    });
    expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
    const resources = (
      r.content as Array<{
        type: string;
        resource?: { mimeType: string; text?: string };
      }>
    ).filter((c) => c.type === "resource");
    expect(resources).toHaveLength(3);
    expect(
      JSON.parse(
        resources.find((c) => c.resource!.mimeType === "application/json")!
          .resource!.text!,
      ),
    ).toEqual(e);
  }, 30000);
  it("preserves geometry scale and includes real ink, strokes, markers and margins in native Cuboid crop", async () => {
    const r = new RasterQueue();
    const e = createCuboid({
      spec: {
        shapes: [
          {
            arrows: true,
            direction: "left",
            title: "Fractional cuboid",
            dimensions: { width: "7/2", depth: "3", height: "2" },
            labels: { height: { mode: "blank" } },
          },
        ],
      },
    });
    const svg = (
        await import("../../packages/cuboid-core/src/index")
      ).renderSvg(e),
      crop = await r.crop(svg);
    expect(crop.svg).toContain("data-width-mm=");
    expect(crop.widthCm).toBeLessThan(e.document.widthCm + 1);
    const original = svg.match(/data-width-mm="([^"]+)"/)![1];
    expect(crop.svg.match(/data-width-mm="([^"]+)"/)![1]).toBe(original);
    const png = await r.render(
      crop.svg,
      Math.round((crop.widthCm / 2.54) * 600),
      Math.round((crop.heightCm / 2.54) * 600),
      true,
      false,
      undefined,
      "cuboids",
    );
    verifyPrintBytes(
      png.png!,
      Math.round((crop.widthCm / 2.54) * 600),
      Math.round((crop.heightCm / 2.54) * 600),
    );
  }, 30000);
});
