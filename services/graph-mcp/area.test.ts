// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/area-core/src/index";
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
    keys: { test: "area-diagram-synthetic-key-only-for-tests" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "area-test", version: "1" });
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

it("creates a compound shape with a hidden answer, revises it and prints verified files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "area" } });
  expect(JSON.stringify(caps.content)).toContain("set_shape");
  const r = await call(client, "create_diagram", {
    kind: "area",
    spec: { preset: "l-shape", labels: [{ id: "e1", text: "12 cm" }, { id: "e6", text: "10 cm" }, { id: "area", answer: "85 cm²" }] },
  });
  const d = r.envelope.document;
  expect(d.labels.map((l) => [l.id, l.state, l.text, l.answer])).toEqual([
    ["e1", "value", "12 cm", ""],
    ["e6", "value", "10 cm", ""],
    ["area", "hidden", "", "85 cm²"],
  ]);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/area#area=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);
  const svg = await (await fetch(r.downloads.svg.url)).text();
  expect(svg).toContain("<svg");
  // The saved answer never reaches the pupil copy.
  expect(svg).not.toContain("#b0125b");

  const answer = await call(client, "create_diagram", { kind: "area", envelope: r.envelope, outputView: "answer" });
  expect(answer.outputView).toBe("answer");

  const revised = await call(client, "revise_diagram", {
    kind: "area",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "set_label", label: { id: "e3", text: "x" } }, { op: "set_settings", settings: { shaded: "shape" } }],
  });
  expect(revised.envelope.document.labels).toHaveLength(4);
  expect(revised.envelope.document.shaded).toBe("shape");
});

it("draws a sector and warns when lengths cannot all be right", async () => {
  const { client } = await start();
  const r = await call(client, "create_diagram", { kind: "area", spec: { shape: { type: "circle", part: "sector", radiusMm: 35, angleDeg: 72 }, labels: [{ id: "r", text: "9 cm" }, { id: "r2", text: "8 cm" }, { id: "angle", text: "72" }] } });
  expect(r.warnings.join(" ")).toContain("should be equal");
  expect(r.physicalSizeCm.width).toBeGreaterThan(3);
});
