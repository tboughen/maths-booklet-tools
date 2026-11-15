// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/factor-tree-core/src/index";
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
    keys: { test: "factor-tree-synthetic-key-only-for-tests" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "factor-tree-test", version: "1" });
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

it("creates a tree with a hidden answer line, completes only on request and prints verified files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "factor-tree" } });
  expect(JSON.stringify(caps.content)).toContain("complete_tree");
  const r = await call(client, "create_diagram", {
    kind: "factor-tree",
    spec: { trees: [{ root: { value: "60", children: [{ value: "6" }, { value: "10", hidden: true }] }, product: true }] },
  });
  const t = r.envelope.document.trees[0];
  expect(t.nodes.map((n) => n.value)).toEqual([{ text: "60", show: "show" }, { text: "6", show: "show" }, { text: "10", show: "hidden" }]);
  expect(t.product).toEqual({ text: "", show: "show" });
  expect(r.warnings.filter((w) => !w.startsWith("Editable JSON"))).toEqual([]);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/factor-tree#factor-tree=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);
  const svg = await (await fetch(r.downloads.svg.url)).text();
  expect(svg).toContain("<svg");
  expect(svg).not.toContain("#b0125b");

  const done = await call(client, "revise_diagram", {
    kind: "factor-tree",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "complete_tree" }, { op: "set_node", treeId: "t1", nodeId: "n2", text: "7" }],
  });
  const d = done.envelope.document.trees[0];
  expect(d.product).toEqual({ text: "2^2 × 3 × 5", show: "hidden" });
  expect(done.warnings).toContain("7 × 10 is 70, not 60.");
  const answers = await call(client, "revise_diagram", { kind: "factor-tree", envelope: done.envelope, baseHash: done.contentHash, operations: [], outputView: "answer" });
  expect(await (await fetch(answers.downloads.svg.url)).text()).toContain("#b0125b");

  const stale = await client.callTool({ name: "revise_diagram", arguments: { kind: "factor-tree", envelope: r.envelope, baseHash: "0".repeat(64), operations: [{ op: "add_tree" }] } });
  expect(stale.isError).toBe(true);
});

it("refuses a number that is not a whole number, with the reason", async () => {
  const { client } = await start();
  const r = await client.callTool({ name: "create_diagram", arguments: { kind: "factor-tree", spec: { root: "3.5" } } });
  expect(r.isError).toBe(true);
  expect(JSON.stringify(r.content)).toContain("whole number");
});
