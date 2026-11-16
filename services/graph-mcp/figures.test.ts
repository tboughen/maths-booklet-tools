// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/figure-core/src/index";
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
    keys: { test: "figures-synthetic-key-only-for-tests" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "figures-test", version: "1" });
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

it("creates a circle-theorem figure with a hidden answer, revises it and prints verified files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "figures" } });
  expect(JSON.stringify(caps.content)).toContain("tangents");
  const r = await call(client, "create_diagram", {
    kind: "figures",
    spec: {
      points: [
        { id: "o", place: { type: "free", x: 0, y: 0 }, name: "O", show: "dot" },
        { id: "a", place: { type: "on", circle: "c", deg: 60 }, name: "A" },
        { id: "b", place: { type: "on", circle: "c", deg: 300 }, name: "B" },
        { id: "t", place: { type: "tangents", a: "a", b: "b" }, name: "T" },
      ],
      circles: [{ id: "c", centre: "o", r: 20 }],
      segments: [
        { id: "ta", a: "t", b: "a" },
        { id: "tb", a: "t", b: "b" },
        { id: "oa", a: "o", b: "a" },
        { id: "ob", a: "o", b: "b" },
      ],
      angles: [
        { id: "atb", at: "t", from: "b", to: "a", label: { text: "40" } },
        { id: "aob", at: "o", from: "a", to: "b", label: { text: "x", answer: "140" }, mark: "arc" },
      ],
    },
  });
  expect(r.envelope.document.angles.map((a) => [a.id, a.label.state, a.label.text, a.label.answer])).toEqual([
    ["atb", "value", "40", ""],
    ["aob", "symbol", "x", "140"],
  ]);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/figures#figures=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);
  const svg = await (await fetch(r.downloads.svg.url)).text();
  expect(svg).toContain("<svg");
  // The saved answer never reaches the pupil copy.
  expect(svg).not.toContain("#b0125b");
  const answer = await call(client, "create_diagram", { kind: "figures", envelope: r.envelope, outputView: "answer" });
  expect(answer.outputView).toBe("answer");

  const revised = await call(client, "revise_diagram", {
    kind: "figures",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "set_segment", segment: { id: "ot", a: "o", b: "t", style: "dashed" } }, { op: "set_point", point: { id: "a", name: "P" } }],
  });
  expect(revised.envelope.document.segments.at(-1)).toMatchObject({ id: "ot", style: "dashed" });
  expect(revised.envelope.document.points.find((p) => p.id === "a")!.name).toBe("P");
  const stale = await client.callTool({ name: "revise_diagram", arguments: { kind: "figures", envelope: r.envelope, baseHash: "0".repeat(64), operations: [] } });
  expect(stale.isError).toBe(true);
});

it("starts from a Question Bank example, with answers only when asked", async () => {
  const { client } = await start();
  const pupil = await call(client, "create_diagram", { kind: "figures", spec: { example: "similar-right" } });
  expect(JSON.stringify(pupil.envelope)).not.toContain("22.5");
  const worked = await call(client, "create_diagram", { kind: "figures", spec: { example: "similar-right", worked: true } });
  expect(JSON.stringify(worked.envelope)).toContain("22.5 cm");
});
