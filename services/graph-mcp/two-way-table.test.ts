// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/two-way-table-core/src/index";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";

const clients: Client[] = [],
  servers: Server[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
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
    keys: { test: "two-way-table-synthetic-key-only" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "two-way-table-test", version: "1" });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(base + "/mcp")));
  return { client, base };
}
type Result = {
  envelope: Envelope;
  contentHash: string;
  downloads: Record<string, { url: string }>;
  physicalSizeCm: { width: number; height: number };
  printRaster: { width: number; height: number };
  editorUrl: string | null;
  outputView: string;
  warnings: string[];
};
async function call(client: Client, name: string, args: Record<string, unknown>) {
  const r = await client.callTool({ name, arguments: args });
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  return r.structuredContent as Result;
}

it("creates a table with hidden answers, completes totals only on request and prints verified files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "two-way-table" } });
  expect(JSON.stringify(caps.content)).toContain("complete_totals");
  const r = await call(client, "create_diagram", {
    kind: "two-way-table",
    spec: {
      columns: ["Walk", "Bus"],
      rows: [
        { heading: "Year 7", cells: ["12", { text: "8", hidden: true }, ""] },
        { heading: "Year 8", cells: ["1/2", "2 1/4", ""] },
      ],
    },
  });
  const d = r.envelope.document;
  expect(d.rows[0].cells).toEqual([{ text: "12", show: "show" }, { text: "8", show: "hidden" }, { text: "", show: "show" }]);
  expect(d.totalRow!.every((c) => c.text === "")).toBe(true);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/two-way-table#two-way-table=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);
  const svg = await (await fetch(r.downloads.svg.url)).text();
  expect(svg).toContain("<svg");
  expect(svg).not.toContain("#b0125b");

  const done = await call(client, "revise_diagram", {
    kind: "two-way-table",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "complete_totals", hidden: true }],
  });
  const t = done.envelope.document;
  expect(t.rows.map((x) => x.cells[2])).toEqual([{ text: "20", show: "hidden" }, { text: "2 3/4", show: "hidden" }]);
  expect(t.totalRow!.map((c) => c.text)).toEqual(["12 1/2", "10 1/4", "22 3/4"]);

  const stale = await client.callTool({ name: "revise_diagram", arguments: { kind: "two-way-table", envelope: r.envelope, baseHash: "0".repeat(64), operations: [{ op: "add_row" }] } });
  expect(stale.isError).toBe(true);
});

it("refuses a cell that is not a number with the reason", async () => {
  const { client } = await start();
  const r = await client.callTool({ name: "create_diagram", arguments: { kind: "two-way-table", spec: { columns: ["A"], rows: [{ heading: "B", cells: ["lots", ""] }] } } });
  expect(r.isError).toBe(true);
  expect(JSON.stringify(r.content)).toContain("lots");
});
