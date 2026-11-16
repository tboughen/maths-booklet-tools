// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/written-method-core/src/index";
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
    keys: { test: "written-method-synthetic-key-only-for-tests" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "written-method-test", version: "1" });
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

it("creates a long multiplication with pupil space, works it out only on request and prints verified files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "written-method" } });
  expect(JSON.stringify(caps.content)).toContain("set_mark");
  const r = await call(client, "create_diagram", { kind: "written-method", spec: { method: "multiply", numbers: ["546", "43"], working: 2 } });
  const d = r.envelope.document;
  expect(d.answer).toEqual({ text: "", show: "show" });
  expect(d.working.map((w) => w.value.text)).toEqual(["", ""]);
  expect(d.marks).toEqual([]);
  expect(r.warnings.filter((w) => !w.startsWith("Editable JSON"))).toEqual([]);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/written-method#written-method=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);

  const done = await call(client, "revise_diagram", { kind: "written-method", envelope: r.envelope, baseHash: r.contentHash, operations: [{ op: "complete" }] });
  expect(done.envelope.document.answer).toEqual({ text: "23478", show: "hidden" });
  expect(done.envelope.document.working.map((w) => w.value.text)).toEqual(["1638", "21840"]);
  const pupil = await (await fetch(done.downloads.svg.url)).text();
  expect(pupil).not.toContain("#b0125b");
  expect(pupil).not.toContain(">8<");
  const answers = await call(client, "revise_diagram", { kind: "written-method", envelope: done.envelope, baseHash: done.contentHash, operations: [], outputView: "answer" });
  expect(await (await fetch(answers.downloads.svg.url)).text()).toContain("#b0125b");

  const wrong = await call(client, "revise_diagram", {
    kind: "written-method",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "set_row", row: "answer", text: "23468" }],
  });
  expect(wrong.warnings).toContain("546 × 43 is 23478, not 23468.");
}, 30000);
