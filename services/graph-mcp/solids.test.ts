// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import { ANSWER_COLOUR, type Envelope } from "../../packages/solid-core/src/index";
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
    keys: { test: "solids-synthetic-key-only-for-tests" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "solids-test", version: "1" });
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

it("creates a cylinder with a hidden answer, revises it and prints verified files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "solids" } });
  expect(JSON.stringify(caps.content)).toContain("hemisphere");
  const r = await call(client, "create_diagram", {
    kind: "solids",
    spec: {
      solids: [{ id: "c", type: "cylinder", at: { x: 0, y: 0, z: 0 }, r: 15, h: 40, axis: "y" }],
      points: [{ id: "r", place: { type: "rim", solid: "c", end: "base", deg: 0 } }],
      dims: [
        { id: "rad", a: "co", b: "r", label: { text: "5 cm" } },
        { id: "ht", a: "co", b: "ct", kind: "arrow", offset: 20, label: { text: "h", answer: "12 cm" } },
      ],
      lines: [{ id: "cr", a: "co", b: "r", style: "dashed" }],
      settings: { view: { type: "turned", turn: 0, tilt: 15 } },
    },
  });
  expect(r.envelope.document.dims.map((m) => [m.id, m.label.state, m.label.text, m.label.answer])).toEqual([
    ["rad", "value", "5 cm", ""],
    ["ht", "symbol", "h", "12 cm"],
  ]);
  // Only the standing note that editable files keep hidden answers.
  expect(r.warnings.filter((w) => !w.startsWith("Editable JSON"))).toEqual([]);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/solids#solids=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);
  const svg = await (await fetch(r.downloads.svg.url)).text();
  expect(svg).toContain("<svg");
  expect(svg).toContain("stroke-dasharray");
  // The saved answer never reaches the pupil copy (downloads outline their text, so the answer colour is checked).
  expect(svg).not.toContain(ANSWER_COLOUR);
  const answer = await call(client, "create_diagram", { kind: "solids", envelope: r.envelope, outputView: "answer" });
  expect(answer.outputView).toBe("answer");
  const answerSvg = await (await fetch(answer.downloads.svg.url)).text();
  expect(answerSvg).toContain(ANSWER_COLOUR);

  const revised = await call(client, "revise_diagram", {
    kind: "solids",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "set_solid", solid: { id: "c", type: "cone", at: { x: 0, y: 0, z: 0 }, r: 15, h: 40, top: 0, axis: "y" } }, { op: "set_name", name: { id: "ct", text: "V" } }],
  });
  expect(revised.envelope.document.solids[0].type).toBe("cone");
  expect(revised.envelope.document.names).toEqual([{ id: "ct", text: "V" }]);
  const stale = await client.callTool({ name: "revise_diagram", arguments: { kind: "solids", envelope: r.envelope, baseHash: "0".repeat(64), operations: [] } });
  expect(stale.isError).toBe(true);
}, 20_000); // Prints verified PDF/PNG files: 5–9 s on the release runner, over the 5 s default.

it("starts from a Question Bank example and places it in a worksheet family list", async () => {
  const { client } = await start();
  const r = await call(client, "create_diagram", { kind: "solids", spec: { example: "square-pyramid" } });
  expect(r.envelope.document.solids[0].type).toBe("pyramid");
  // Only the standing note that editable files keep hidden answers.
  expect(r.warnings.filter((w) => !w.startsWith("Editable JSON"))).toEqual([]);
  const list = await client.callTool({ name: "diagram_capabilities", arguments: {} });
  expect(JSON.stringify(list.content)).toContain("solids");
  expect(JSON.stringify(list.content)).not.toContain("prisms and cylinders as 3D drawings");
});
