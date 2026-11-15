// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/angle-core/src/index";
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
    keys: { test: "angles-diagram-synthetic-key-only-for-tests" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "angles-test", version: "1" });
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

it("creates a parallel-lines diagram with a hidden answer, revises it and prints verified files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "angles" } });
  expect(JSON.stringify(caps.content)).toContain("set_figure");
  const r = await call(client, "create_diagram", {
    kind: "angles",
    spec: { figure: { type: "parallel", crossDeg: 58 }, angles: [{ id: "p1-ur", text: "58" }, { id: "p2-ul", text: "x", answer: "122" }] },
  });
  const d = r.envelope.document;
  expect(d.angles.map((a) => [a.id, a.label.state, a.label.text, a.label.answer])).toEqual([
    ["p1-ur", "value", "58", ""],
    ["p2-ul", "symbol", "x", "122"],
  ]);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/angles#angles=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);
  const svg = await (await fetch(r.downloads.svg.url)).text();
  expect(svg).toContain("<svg");
  // The saved answer never reaches the pupil copy.
  expect(svg).not.toContain("#b0125b");

  const answer = await call(client, "create_diagram", { kind: "angles", envelope: r.envelope, outputView: "answer" });
  expect(answer.outputView).toBe("answer");

  const moved = await call(client, "revise_diagram", {
    kind: "angles",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "set_angle", angle: { id: "p2-ll", text: "y" } }, { op: "set_figure", figure: { type: "parallel", count: 3 } }],
  });
  expect(moved.envelope.document.figure).toMatchObject({ type: "parallel", count: 3, crossDeg: 58 });
  expect(moved.envelope.document.angles).toHaveLength(3);

  const stale = await client.callTool({ name: "revise_diagram", arguments: { kind: "angles", envelope: r.envelope, baseHash: "0".repeat(64), operations: [] } });
  expect(stale.isError).toBe(true);
});

it("refuses to drop labelled angles when the figure changes, unless asked", async () => {
  const { client } = await start();
  const r = await call(client, "create_diagram", { kind: "angles", spec: { example: "straight-line" } });
  const refused = await client.callTool({
    name: "revise_diagram",
    arguments: { kind: "angles", envelope: r.envelope, baseHash: r.contentHash, operations: [{ op: "set_figure", figure: { type: "polygon", sides: 5 } }] },
  });
  expect(refused.isError).toBe(true);
  expect(JSON.stringify(refused.content)).toContain("dropMissing");
  const dropped = await call(client, "revise_diagram", {
    kind: "angles",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "set_figure", figure: { type: "polygon", sides: 5 }, dropMissing: true }],
  });
  expect(dropped.envelope.document.angles).toEqual([]);
  expect(dropped.envelope.document.names).toEqual([]);
});

it("warns when given sizes cannot all be right", async () => {
  const { client } = await start();
  const r = await call(client, "create_diagram", { kind: "angles", spec: { figure: { type: "straight-line", rays: [60] }, angles: [{ id: "s1", text: "60" }, { id: "s2", text: "100" }] } });
  expect(r.warnings.join(" ")).toContain("add to 160°, not 180°");
});
