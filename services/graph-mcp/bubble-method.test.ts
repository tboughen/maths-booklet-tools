// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/bubble-method-core/src/index";
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
    keys: { test: "bubble-method-synthetic-key-only-for-tests" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "bubble-method-test", version: "1" });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(base + "/mcp")));
  return { client };
}
type Result = {
  envelope: Envelope;
  contentHash: string;
  downloads: Record<string, { url: string }>;
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

it("creates bubble method working with hidden lines, never solves it, and prints verified files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "bubble-method" } });
  expect(JSON.stringify(caps.content)).toContain("set_bubbles");
  const r = await call(client, "create_diagram", {
    kind: "bubble-method",
    spec: { start: "y = 3x + 2", steps: [{ bubble: "−2", line: { text: "y − 2 = 3x", hidden: true } }, { bubble: "", line: "" }] },
  });
  const d = r.envelope.document;
  expect(d.first.rhs.text).toBe("3x + 2");
  expect(d.steps[0].line.lhs).toEqual({ text: "y − 2", show: "hidden" });
  expect(d.steps[1].line.lhs).toEqual({ text: "", show: "show" });
  expect(r.warnings.filter((w) => !w.startsWith("Editable JSON"))).toEqual([]);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/bubble-method#bubble-method=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);
  const pupil = await (await fetch(r.downloads.svg.url)).text();
  expect(pupil).not.toContain("#b0125b");
  const answers = await call(client, "revise_diagram", { kind: "bubble-method", envelope: r.envelope, baseHash: r.contentHash, operations: [], outputView: "answer" });
  expect(await (await fetch(answers.downloads.svg.url)).text()).toContain("#b0125b");

  const wrong = await call(client, "revise_diagram", {
    kind: "bubble-method",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "set_item", slot: "step:0:right", text: "+2" }],
  });
  expect(wrong.warnings).toContain("Step 1: the bubbles differ (−2 and +2). Balancing does the same to both sides.");
}, 30000);
