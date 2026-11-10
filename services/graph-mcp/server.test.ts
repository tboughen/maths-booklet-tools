// @vitest-environment node
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { withFamilyNames } from "./family-tool-names";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { resolve } from "node:path";
import { graphService } from "./server";
import {
  createGraph,
  GraphError,
  graphHash,
} from "../../packages/graph-core/src/interchange";
import type { GraphEnvelope } from "../../packages/graph-core/src/interchange";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import { Downloads } from "./downloads";
import { RasterQueue } from "./raster";
import { TrafficLimits } from "./limits";
const servers: Server[] = [],
  clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))),
  );
});
async function start() {
  // Reserve an OS-assigned port; no production host, files or secrets are used.
  const reservation = createServer();
  await new Promise<void>((r) => reservation.listen(0, "127.0.0.1", r));
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((r) => reservation.close(() => r()));
  const base = "http://127.0.0.1:" + port;
  const logs: Array<unknown> = [];
  const server = graphService({
    publicUrl: base,
    editorUrl: "https://example.com/editor/",
    keys: { test: "test-only-secret-".repeat(4) },
    activeKey: "test",
    log: (entry) => logs.push(entry),
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = withFamilyNames(new Client({ name: "graph-qualification", version: "1" }));
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL(base + "/mcp")),
  );
  return { base, client, logs };
}
describe("actual MCP transport and print downloads", () => {
  it("fits a maximum-object graph in compressed download links", async () => {
    const { client } = await start();
    const reply = await client.callTool({ name: "create_graph", arguments: { schemaVersion: 1, objects: Array.from({ length: 50 }, (_, i) => ({ kind: "line", id: "long-name-" + i, equation: { kind: "slope", slope: i / 3, intercept: i / 7 }, equationVisible: true })) } });
    expect(reply.isError).not.toBe(true);
    const data = reply.structuredContent as { downloads: Record<string, { url: string }> };
    expect(Object.keys(data.downloads).sort()).toEqual(["json", "png", "svg"]);
    for (const d of Object.values(data.downloads)) expect(d.url.length).toBeLessThan(7500);
    const json = await fetch(data.downloads.json.url);
    expect(json.status, await json.clone().text()).toBe(200);
    expect(((await json.json()) as { document: { objects: unknown[] } }).document.objects).toHaveLength(50);
  }, 30000);
  it("returns intact embedded artifacts when signed/editor links are too large", async () => {
    // Compressed links now fit every valid graph, so force the long-link path to check the fallback.
    const spy = vi.spyOn(Downloads.prototype, "link").mockImplementation(() => { throw new GraphError("size_limit", "Test: link too long."); });
    onTestFinished(() => spy.mockRestore());
    const { client } = await start();
    const reply = await client.callTool({
      name: "create_graph",
      arguments: {
        schemaVersion: 1,
        objects: Array.from({ length: 50 }, (_, i) => ({
          kind: "line",
          id: "long-name-" + i,
          equation: { kind: "slope", slope: i / 3, intercept: i / 7 },
          equationVisible: true,
        })),
      },
    });
    expect(reply.isError).not.toBe(true);
    const data = reply.structuredContent as {
      editorUrl: string | null;
      downloads: Record<string, unknown>;
      printRaster: { width: number; height: number };
      printVerified: boolean;
    };
    expect(data.editorUrl).toBeNull();
    expect(data.downloads).toEqual({});
    const resources = (
      reply.content as Array<{
        type: string;
        resource?: { mimeType: string; blob?: string; text?: string };
      }>
    )
      .filter((c) => c.type === "resource")
      .map((c) => c.resource!);
    expect(resources.map((r) => r.mimeType)).toEqual([
      "image/svg+xml",
      "image/png",
      "application/json",
    ]);
    const png = resources.find((r) => r.mimeType === "image/png")!;
    verifyPrintBytes(
      Buffer.from(png.blob!, "base64"),
      data.printRaster.width,
      data.printRaster.height,
    );
    expect(
      JSON.parse(
        resources.find((r) => r.mimeType === "application/json")!.text!,
      ).document.objects,
    ).toHaveLength(50);
    expect(data.printVerified).toBe(true);
  }, 30000);
  it("discovers tools, creates, downloads and revises through the official client", async () => {
    const { client, logs } = await start();
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual([
      "diagram_capabilities",
      "create_diagram",
      "revise_diagram",
      "check_diagram_placement",
      "download_diagram_bundle",
      "get_diagram_svg",
      "worksheet_capabilities",
      "create_worksheet",
    ]);
    const reply = await client.callTool({
      name: "create_graph",
      arguments: {
        schemaVersion: 1,
        objects: [
          {
            kind: "line",
            id: "main",
            equation: { kind: "slope", slope: "1/2", intercept: -1 },
            equationVisible: true,
          },
          {
            kind: "line",
            id: "vertical",
            equation: { kind: "vertical", x: -2 },
            strokeStyle: "dashed",
          },
          { kind: "point", id: "point", position: { x: 1, y: 3 } },
        ],
      },
    });
    expect(reply.isError).not.toBe(true);
    expect(reply.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "image", mimeType: "image/png" }),
      ]),
    );
    const data = reply.structuredContent as {
      envelope: GraphEnvelope;
      contentHash: string;
      downloads: Record<string, { url: string }>;
      printRaster: { width: number; height: number };
      editorUrl: string;
    };
    expect(data.contentHash).toBe(await graphHash(data.envelope));
    expect(data.editorUrl).toContain("#graph=");
    for (const format of ["json", "svg", "png"]) {
      const response = await fetch(data.downloads[format].url);
      expect(response.status).toBe(200);
      if (format === "json")
        expect(await response.json()).toEqual(data.envelope);
      else if (format === "svg") {
        const svg = await response.text();
        expect(svg).not.toContain("<text");
        expect(svg).toContain("<path");
        expect(svg).toMatch(/width="[0-9.]+cm"/);
      } else
        verifyPrintBytes(
          new Uint8Array(await response.arrayBuffer()),
          data.printRaster.width,
          data.printRaster.height,
        );
    }
    const revised = await client.callTool({
      name: "revise_graph",
      arguments: {
        envelope: data.envelope,
        baseHash: data.contentHash,
        operations: [{ op: "set_label", id: "main", visible: false }],
      },
    });
    expect(revised.isError).not.toBe(true);
    const next = (revised.structuredContent as { envelope: GraphEnvelope })
      .envelope;
    expect(next.document.objects.slice(1)).toEqual(
      data.envelope.document.objects.slice(1),
    );
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain("test-only-secret");
    expect(JSON.stringify(logs)).not.toContain("main");
  }, 30000);
  it("validates HTTP boundaries and hostile tool requests", async () => {
    const { base, client } = await start();
    expect((await fetch(base + "/mcp")).status).toBe(405);
    expect(
      (
        await fetch(base + "/healthz", {
          headers: { Origin: "https://evil.example" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(base + "/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "x".repeat(65537),
        })
      ).status,
    ).toBe(400);
    const invalid = await client.callTool({
      name: "create_graph",
      arguments: {
        schemaVersion: 1,
        objects: [{ kind: "curve", expression: "x*x" }],
      },
    });
    expect(invalid.isError).toBe(true);
    const valid = createGraph({ schemaVersion: 1, objects: [] });
    const stale = await client.callTool({
      name: "revise_graph",
      arguments: { envelope: valid, baseHash: "0".repeat(64), operations: [] },
    });
    expect(stale.isError).toBe(true);
    expect(JSON.stringify(stale)).toContain("stale_document");
  });
  it("renders the maximum grid with the correct physical density", async () => {
    const { client } = await start();
    const reply = await client.callTool({
      name: "create_graph",
      arguments: {
        schemaVersion: 1,
        axes: {
          x: { negativeSquares: 9, positiveSquares: 9, unitsPerSquare: 0.5 },
          y: { negativeSquares: 13, positiveSquares: 13, unitsPerSquare: 2 },
        },
        objects: [
          {
            kind: "line",
            equation: { kind: "slope", slope: -2, intercept: 3 },
            equationVisible: true,
          },
        ],
      },
    });
    expect(reply.isError).not.toBe(true);
    const data = reply.structuredContent as {
      downloads: { png: { url: string } };
      printRaster: { width: number; height: number };
    };
    const response = await fetch(data.downloads.png.url);
    expect(response.status).toBe(200);
    verifyPrintBytes(
      new Uint8Array(await response.arrayBuffer()),
      data.printRaster.width,
      data.printRaster.height,
    );
    expect(data.printRaster.width * data.printRaster.height).toBeLessThan(
      32_000_000,
    );
  }, 30000);
});
it("rejects signed URL tampering/expiry and retains links through secret rotation/restart", () => {
  const graph = createGraph({ schemaVersion: 1, objects: [] }),
    oldKey = "old-key-".repeat(8),
    newKey = "new-key-".repeat(8);
  const old = new Downloads("https://example.com", { old: oldKey }, "old"),
    url = new URL(old.link(graph, "png", 1000).url);
  const rotated = new Downloads(
    "https://example.com",
    { old: oldKey, new: newKey },
    "new",
  );
  expect(rotated.verify(url, 2000).envelope).toEqual(graph);
  const tampered = new URL(url);
  tampered.searchParams.set("signature", "a".repeat(43));
  expect(() => rotated.verify(tampered, 2000)).toThrow("signature");
  expect(() => rotated.verify(url, 8 * 24 * 60 * 60 * 1000)).toThrow("expired");
});
it("kills a slow native renderer and releases its queue", async () => {
  // This existing worker waits forever without a job response; no scratch file.
  const queue = new RasterQueue(
    resolve("services/graph-mcp/testing-hung-worker.mjs"),
    undefined,
    100,
  );
  await expect(queue.render("<svg/>", 10, 10)).rejects.toThrow("timed out");
  await expect(queue.render("<svg/>", 10, 10)).rejects.toThrow("timed out");
});
it("enforces request and served-byte budgets", () => {
  // The whole allowance for one address here; quota.test.ts covers the per-address share.
  const limits = new TrafficLimits(100, { clientShare: 1 });
  for (let i = 0; i < 40; i++) limits.request("client", 1000);
  expect(() => limits.request("client", 1000)).toThrow("Too many");
  limits.output(100, 1000);
  expect(() => limits.output(1, 1000)).toThrow("allowance");
  expect(() => limits.request("client", 61000)).not.toThrow();
});
