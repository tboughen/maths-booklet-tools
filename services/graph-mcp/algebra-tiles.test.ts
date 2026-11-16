// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/algebra-tile-core/src/index";
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
    keys: { test: "algebra-tiles-synthetic-key-only-for-tests" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "algebra-tiles-test", version: "1" });
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

it("creates tiles with a blank answer, collects only on request and prints verified files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "algebra-tiles" } });
  expect(JSON.stringify(caps.content)).toContain("write_expression");
  const r = await call(client, "create_diagram", { kind: "algebra-tiles", spec: { tiles: "2a²b + ab² − a²b + 2ab²", expression: "2a²b + ab² − a²b + 2ab²", answer: "" } });
  expect(r.envelope.document.answer).toEqual({ text: "", show: "show" });
  expect(r.envelope.document.terms.map((t) => t.count)).toEqual([2, 1, -1, 2]);
  expect(r.warnings.filter((w) => !w.startsWith("Editable JSON"))).toEqual([]);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/algebra-tiles#algebra-tiles=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);

  const done = await call(client, "revise_diagram", {
    kind: "algebra-tiles",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "collect" }, { op: "set_settings", settings: { arrangement: "grouped", zeroPairs: "hidden" } }],
  });
  expect(done.envelope.document.answer).toEqual({ text: "a²b + 3ab²", show: "hidden" });
  const pupil = await (await fetch(done.downloads.svg.url)).text();
  expect(pupil).not.toContain("#b0125b");
  const answers = await call(client, "revise_diagram", { kind: "algebra-tiles", envelope: done.envelope, baseHash: done.contentHash, operations: [], outputView: "answer" });
  expect(await (await fetch(answers.downloads.svg.url)).text()).toContain("#b0125b");

  const wrong = await call(client, "revise_diagram", {
    kind: "algebra-tiles",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "set_item", item: "answer", text: "4a²b²" }],
  });
  expect(wrong.warnings.join(" ")).toContain("does not match the tiles");
}, 30000);
