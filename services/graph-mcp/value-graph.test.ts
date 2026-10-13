// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import { ValueDownloads } from "./value-downloads";
import {
  decode,
  defaultEnvelope,
  type ValueEnvelope,
} from "../../packages/value-graph-core/src/interchange";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
const servers: Server[] = [],
  clients: Client[] = [],
  key = "synthetic-values-test-key-never-use-in-production";
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(
    servers
      .splice(0)
      .map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});
async function start() {
  const reservation = createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, "127.0.0.1", resolve),
  );
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const base = `http://127.0.0.1:${port}`,
    server = graphService({
      publicUrl: base,
      editorUrl: "http://127.0.0.1:5179/",
      keys: { test: key },
      activeKey: "test",
    });
  servers.push(server);
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  const client = new Client({
    name: "value-graph-qualification",
    version: "1",
  });
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL(base + "/mcp")),
  );
  return { client };
}
type Output = {
  envelope: ValueEnvelope;
  contentHash: string;
  printVerified: boolean;
  downloads: Record<string, { url: string }>;
  editorUrl: string;
  printRaster: { width: number; height: number };
};
describe("table-of-values MCP on the real local protocol", () => {
  it("discovers homogeneous schemas and creates a scaffold with real print downloads and an editable link", async () => {
    const { client } = await start(),
      tools = (await client.listTools()).tools.filter((t) =>
        t.name.includes("value_graph"),
      );
    expect(tools).toHaveLength(3);
    function inspect(v: unknown) {
      if (v && typeof v === "object") {
        expect(v).not.toHaveProperty("prefixItems");
        for (const value of Object.values(v)) inspect(value);
      }
    }
    tools.forEach((t) => inspect(t.inputSchema));
    const reply = await client.callTool({
      name: "create_value_graph",
      arguments: {},
    });
    expect(reply.isError).not.toBe(true);
    const data = reply.structuredContent as Output;
    expect(
      data.envelope.document.columns.filter((c) => c.y.kind === "blank"),
    ).toHaveLength(5);
    expect(data.printVerified).toBe(true);
    const svg = await (await fetch(data.downloads.svg.url)).text();
    expect(svg).toContain("<title>Table of values and quadratic graph</title>");
    expect(svg).not.toContain("<text");
    expect(svg).toContain('width="141mm"');
    const png = new Uint8Array(
      await (await fetch(data.downloads.png.url)).arrayBuffer(),
    );
    verifyPrintBytes(png, data.printRaster.width, data.printRaster.height);
    const editable = await (await fetch(data.downloads.json.url)).json();
    expect(editable).toEqual(data.envelope);
    expect(decode(new URL(data.editorUrl).hash.slice(8))).toEqual(
      data.envelope,
    );
  }, 30000);
  it("revises explicitly to correct points and straight joins, and rejects a stale hash", async () => {
    const { client } = await start(),
      created = await client.callTool({
        name: "create_value_graph",
        arguments: {},
      }),
      first = created.structuredContent as Output;
    const revised = await client.callTool({
      name: "revise_value_graph",
      arguments: {
        envelope: first.envelope,
        baseHash: first.contentHash,
        operations: [
          {
            op: "calculate_cells",
            columnIds: first.envelope.document.columns.map((c) => c.id),
            overwrite: true,
          },
          {
            op: "plot_series",
            id: "points",
            source: "table",
            columnIds: first.envelope.document.columns.map((c) => c.id),
            connection: "straight-joins",
          },
        ],
      },
    });
    expect(revised.isError).not.toBe(true);
    const data = revised.structuredContent as Output;
    expect(data.envelope.document.graph.series[0].points).toHaveLength(7);
    expect(data.envelope.document.graph.curves).toHaveLength(0);
    const stale = await client.callTool({
      name: "revise_value_graph",
      arguments: {
        envelope: data.envelope,
        baseHash: first.contentHash,
        operations: [],
      },
    });
    expect(stale.isError).toBe(true);
    expect(JSON.stringify(stale.content)).toContain("stale");
  }, 30000);
  it("rejects expired and tampered downloads without accepting another tool's token", () => {
    const downloads = new ValueDownloads(
        "https://example.com/",
        { test: key },
        "test",
      ),
      link = downloads.link(defaultEnvelope(), "json", 0),
      url = new URL(link.url);
    expect(() => downloads.verify(url, 8 * 86400 * 1000)).toThrow("expired");
    url.searchParams.set("signature", "A".repeat(43));
    expect(() => downloads.verify(url, 0)).toThrow("signature");
  });
});
