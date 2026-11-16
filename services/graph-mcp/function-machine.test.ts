// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/function-machine-core/src/index";
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
    keys: { test: "function-machine-synthetic-key-only-for-tests" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "function-machine-test", version: "1" });
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

it("creates a machine with a blank output, works it out only on request and prints verified files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "function-machine" } });
  expect(JSON.stringify(caps.content)).toContain("add_inverse");
  const r = await call(client, "create_diagram", { kind: "function-machine", spec: { ops: ["× 3", "− 8"], start: "6", end: "" } });
  const m = r.envelope.document.machines[0];
  expect(m.end).toEqual({ text: "", show: "show" });
  expect(m.steps.map((s) => s.op.text)).toEqual(["× 3", "− 8"]);
  expect(r.warnings.filter((w) => !w.startsWith("Editable JSON"))).toEqual([]);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/function-machine#function-machine=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);

  const done = await call(client, "revise_diagram", {
    kind: "function-machine",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "complete" }, { op: "add_inverse", machineId: "m1" }],
  });
  expect(done.envelope.document.machines[0].end).toEqual({ text: "10", show: "hidden" });
  expect(done.envelope.document.machines[1].steps.map((s) => s.op.text)).toEqual(["+ 8", "÷ 3"]);
  const pupil = await (await fetch(done.downloads.svg.url)).text();
  expect(pupil).not.toContain("#b0125b");
  const answers = await call(client, "revise_diagram", { kind: "function-machine", envelope: done.envelope, baseHash: done.contentHash, operations: [], outputView: "answer" });
  expect(await (await fetch(answers.downloads.svg.url)).text()).toContain("#b0125b");

  const wrong = await call(client, "revise_diagram", {
    kind: "function-machine",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "set_item", machineId: "m1", slot: "end", text: "12" }],
  });
  expect(wrong.warnings).toContain("6 × 3 − 8 is 10, not 12.");
}, 30000);
