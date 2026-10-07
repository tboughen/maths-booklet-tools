// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { createHmac } from "node:crypto";
import { graphService } from "./server";
import { RatioDownloads } from "./ratio-downloads";
import { Downloads } from "./downloads";
import { createGraph } from "../../packages/graph-core/src/interchange";
import {
  createRatioTable,
  ratioHash,
  describeRatio,
  emptyRatioTable,
} from "../../packages/ratio-table-core/src/interchange";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
const key = "synthetic-ratio-test-key-never-use-in-production",
  servers: Server[] = [],
  clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(
    servers
      .splice(0)
      .map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});
async function start(options = {}) {
  const reservation = createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, "127.0.0.1", resolve),
  );
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const base = `http://127.0.0.1:${port}`;
  const server = graphService({
    publicUrl: base,
    editorUrl: "https://example.com/maths-booklet-tools/",
    keys: { test: key },
    activeKey: "test",
    ...options,
  });
  servers.push(server);
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  const client = new Client({ name: "ratio-qualification", version: "1" });
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL(base + "/mcp")),
  );
  return { base, client };
}
const spec = {
  schemaVersion: 1,
  rows: [
    {
      id: "start",
      cells: [
        { kind: "number", value: "3" },
        { kind: "number", value: "2" },
      ],
    },
    {
      id: "target",
      cells: [{ kind: "number", value: "1" }, { kind: "answer-line" }],
    },
  ],
  mode: "annotated",
  transitions: [
    { from: "start", to: "target", operation: "divide", factor: "3" },
  ],
};
type Output = {
  envelope: RatioEnvelope;
  contentHash: string;
  printVerified: boolean;
  description: string;
  warnings: string[];
  editorUrl: string;
  downloads: Record<string, { url: string }>;
  printRaster: { width: number; height: number };
};
describe("ratio tools on the shared real MCP service", () => {
  it("discovers, preserves a pupil blank, downloads all formats and explicitly fills a revision", async () => {
    const { base, client } = await start();
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name)).toEqual([
      "graph_capabilities",
      "create_graph",
      "revise_graph",
      "ratio_table_capabilities",
      "create_ratio_table",
      "revise_ratio_table",
    ]);
    const caps = await client.callTool({
      name: "ratio_table_capabilities",
      arguments: {},
    });
    expect(caps.structuredContent).toMatchObject({
      columns: 2,
      rows: { minimum: 2, maximum: 6 },
      printDpi: 600,
    });
    const reply = await client.callTool({
      name: "create_ratio_table",
      arguments: spec,
    });
    expect(reply.isError).not.toBe(true);
    const data = reply.structuredContent as Output;
    expect(data.envelope.document.rows[1].cells[1]).toEqual({
      kind: "answer-line",
    });
    expect(data.description).not.toContain("2/3");
    expect(data.contentHash).toBe(await ratioHash(data.envelope));
    expect(data.editorUrl).toContain("?tool=ratio-table#ratio-table=");
    expect(data.printVerified).toBe(true);
    for (const format of ["json", "svg", "png"]) {
      const response = await fetch(data.downloads[format].url);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition")).toContain(
        `maths-ratio-table.${format}`,
      );
      if (format === "json")
        expect(await response.json()).toEqual(data.envelope);
      else if (format === "png")
        verifyPrintBytes(
          new Uint8Array(await response.arrayBuffer()),
          data.printRaster.width,
          data.printRaster.height,
        );
      else {
        const svg = await response.text();
        expect(svg).toContain("<title>Ratio table</title>");
        expect(svg).not.toContain("Coordinate graph");
        expect(svg).not.toContain("<text");
        expect(svg).toMatch(/width="[\d.]+cm"/);
      }
    }
    const revise = await client.callTool({
      name: "revise_ratio_table",
      arguments: {
        envelope: data.envelope,
        baseHash: data.contentHash,
        operations: [{ op: "fill_next_row", from: "start", overwrite: true }],
      },
    });
    expect(revise.isError).not.toBe(true);
    const filled = revise.structuredContent as Output;
    expect(filled.envelope.document.rows[1].cells[1]).toEqual({
      kind: "number",
      value: "2/3",
    });
    expect(describeRatio(data.envelope)).not.toContain("2/3");
    const stale = await client.callTool({
      name: "revise_ratio_table",
      arguments: {
        envelope: filled.envelope,
        baseHash: data.contentHash,
        operations: [],
      },
    });
    expect(stale.isError).toBe(true);
    const graph = await client.callTool({
      name: "create_graph",
      arguments: { schemaVersion: 1, objects: [] },
    });
    expect(graph.isError).not.toBe(true);
    expect(await (await fetch(base + "/healthz")).json()).toMatchObject({
      rendererVersion: "graph-1",
      ratioRendererVersion: "ratio-1",
    });
  }, 30000);
  it("retains intentional mistakes and returns warnings without printing corrected answers", async () => {
    const { client } = await start();
    const wrong = structuredClone(spec);
    wrong.rows[1].cells[1] = { kind: "number", value: "7" };
    const reply = await client.callTool({
      name: "create_ratio_table",
      arguments: wrong,
    });
    expect(reply.isError).not.toBe(true);
    const data = reply.structuredContent as Output;
    expect(data.warnings.join(" ")).toContain("Values have been kept");
    expect(data.envelope.document.rows[1].cells[1]).toEqual({
      kind: "number",
      value: "7",
    });
    expect(data.description).not.toContain("2/3");
  }, 15000);
  it("refuses tampering, expiry, cross-kind reuse and signed foreign token fields", () => {
    const ratios = new RatioDownloads(
        "https://example.com",
        { test: key },
        "test",
      ),
      graphs = new Downloads("https://example.com", { test: key }, "test");
    const ratioUrl = new URL(ratios.link(emptyRatioTable(), "json", 0).url);
    expect(() => ratios.verify(ratioUrl, 8 * 24 * 60 * 60 * 1000)).toThrow(
      /expired/,
    );
    const graphUrl = new URL(
      graphs.link(createGraph({ schemaVersion: 1, objects: [] }), "json").url,
    );
    expect(() => ratios.verify(graphUrl)).toThrow(/invalid/);
    expect(() =>
      graphs.verify(new URL(ratios.link(emptyRatioTable(), "json").url)),
    ).toThrow(/invalid/);
    const url = new URL(ratios.link(createRatioTable(spec), "png").url);
    url.searchParams.set("signature", "a".repeat(43));
    expect(() => ratios.verify(url)).toThrow(/signature/);
    const token = JSON.parse(
      Buffer.from(ratioUrl.searchParams.get("token")!, "base64url").toString(
        "utf8",
      ),
    );
    token.graph = token.ratio;
    const malformed = Buffer.from(JSON.stringify(token)).toString("base64url");
    ratioUrl.searchParams.set("token", malformed);
    ratioUrl.searchParams.set(
      "signature",
      createHmac("sha256", key).update(malformed).digest("base64url"),
    );
    expect(() => ratios.verify(ratioUrl, 0)).toThrow(/invalid/);
  });
});
