// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/sample-space-core/src/index";
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
    keys: { test: "sample-space-synthetic-key-only-for-tests" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "sample-space-test", version: "1" });
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

it("creates two dice with hidden totals, fills only on request and prints verified files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "sample-space" } });
  expect(JSON.stringify(caps.content)).toContain("fill_cells");
  const r = await call(client, "create_diagram", {
    kind: "sample-space",
    spec: { rowTitle: "Dice A", columnTitle: "Dice B", corner: "+", cells: [["2", { text: "3", hidden: true }, { text: "4", ring: true }]] },
  });
  const d = r.envelope.document;
  expect(d.rows[0].cells.slice(0, 4)).toEqual([{ text: "2", show: "show" }, { text: "3", show: "hidden" }, { text: "4", show: "show", ring: true }, { text: "", show: "show" }]);
  expect(d.rows[5].cells.every((c) => c.text === "")).toBe(true);
  expect(r.warnings.filter((w) => !w.startsWith("Editable JSON"))).toEqual([]);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/sample-space#sample-space=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);
  const svg = await (await fetch(r.downloads.svg.url)).text();
  expect(svg).toContain("<svg");
  expect(svg).not.toContain("#b0125b");

  const done = await call(client, "revise_diagram", {
    kind: "sample-space",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "fill_cells", operation: "sum" }, { op: "set_cell", rowId: "r6", columnId: "c6", text: "13" }],
  });
  const t = done.envelope.document;
  expect(t.rows[0].cells[3]).toEqual({ text: "5", show: "hidden" });
  expect(t.rows[0].cells[1]).toEqual({ text: "3", show: "hidden" });
  expect(done.warnings).toContain("The cell for 6 and 6 holds 13; the sum is 12.");
  const answers = await call(client, "revise_diagram", { kind: "sample-space", envelope: done.envelope, baseHash: done.contentHash, operations: [], outputView: "answer" });
  expect(await (await fetch(answers.downloads.svg.url)).text()).toContain("#b0125b");

  const stale = await client.callTool({ name: "revise_diagram", arguments: { kind: "sample-space", envelope: r.envelope, baseHash: "0".repeat(64), operations: [{ op: "add_row" }] } });
  expect(stale.isError).toBe(true);
}, 20_000); // Prints verified PDF/PNG files: 5–9 s on the release runner, over the 5 s default.

it("refuses to fill sums of outcomes that are not numbers, with the reason", async () => {
  const { client } = await start();
  const r = await client.callTool({ name: "create_diagram", arguments: { kind: "sample-space", spec: { rows: ["H", "T"], fill: { operation: "sum" } } } });
  expect(r.isError).toBe(true);
  expect(JSON.stringify(r.content)).toContain("must be a number");
});
