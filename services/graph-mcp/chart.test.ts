// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import { layout, type Envelope } from "../../packages/chart-core/src/index";
import { examples } from "../../packages/chart-core/src/examples";
import { hash } from "../../packages/chart-core/src/interchange";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
const clients: Client[] = [],
  servers: Server[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))),
  );
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
    keys: { test: "chart-qualification-synthetic-key-only" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "chart-qualification", version: "1" });
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL(base + "/mcp")),
  );
  return client;
}
type Result = {
  envelope: Envelope;
  contentHash: string;
  downloads: Record<string, { url: string }>;
  physicalSizeCm: { width: number; height: number };
  printRaster: { width: number; height: number };
  editorUrl: string;
  outputView: string;
  warnings: string[];
};
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<Result> {
  const r = await client.callTool({ name, arguments: args });
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  return r.structuredContent as Result;
}
it("advertises chart tools with homogeneous schemas", async () => {
  const c = await start(),
    tools = (await c.listTools()).tools;
  for (const name of ["chart_capabilities", "create_chart", "revise_chart"])
    expect(tools.map((t) => t.name)).toContain(name);
  const revise = tools.find((t) => t.name === "revise_chart")!;
  expect(JSON.stringify(revise.inputSchema)).not.toContain('"prefixItems"');
  const caps = await c.callTool({ name: "chart_capabilities", arguments: {} });
  const text = (caps.content as { text: string }[])[0].text;
  expect(JSON.parse(text).kinds).toEqual(["bar", "dual", "composite", "vline"]);
});

// One test per example: each renders SVG and a 600 ppi PNG through the real service.
it.each(examples)("creates the $id example with real downloads and reopens it in the editor", async (example) => {
  const c = await start();
  {
    const r = await call(c, "create_chart", { spec: { example: example.id } });
    expect(r.envelope).toEqual(example.make(false));
    expect(await hash(r.envelope)).toBe(r.contentHash);
    expect(r.outputView).toBe("pupil");
    const g = layout(r.envelope);
    expect(r.physicalSizeCm).toEqual({ width: g.width / 10, height: g.height / 10 });
    const svg = Buffer.from(await (await fetch(r.downloads.svg.url)).arrayBuffer()).toString();
    expect(svg).not.toContain("<text");
    expect(svg).toContain('mm"');
    verifyPrintBytes(new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer()), r.printRaster.width, r.printRaster.height);
    expect(await (await fetch(r.downloads.json.url)).json()).toEqual(r.envelope);
    const url = new URL(r.editorUrl);
    expect(url.pathname).toBe("/tools/charts");
    expect(JSON.parse(Buffer.from(url.hash.slice(7), "base64url").toString("utf8"))).toEqual(r.envelope);
  }
}, 30000);

it("builds a custom dual chart, revises atomically by index and never fills answers", async () => {
  const c = await start();
  const r = await call(c, "create_chart", {
    spec: {
      kind: "dual",
      categories: ["Mon", "Tue", "Wed"],
      series: [
        { name: "Year 7", values: ["4", null, "0"] },
        { name: "Year 8", fill: "hatch", values: ["6", "3", "5"], hidden: [1] },
      ],
      axis: { max: "8", step: "1" },
      presentation: { yTitle: "Frequency" },
    },
  });
  const d = r.envelope.document;
  expect(d.series[0].values.map((v) => v.value)).toEqual(["4", "", "0"]);
  expect(d.series[1].values[1]).toEqual({ value: "3", show: "hidden" });
  const revised = await call(c, "revise_chart", {
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [
      { op: "add_category", label: "Thu" },
      { op: "set_value", series: 0, category: 3, value: "2" },
      { op: "set_kind", kind: "composite" },
      { op: "set_axis", axis: { max: "12", step: "2" } },
    ],
  });
  expect(revised.envelope.document.kind).toBe("composite");
  expect(revised.envelope.document.series[1].values[3].value).toBe("");
  expect(revised.envelope.document.series[1].values[1].show).toBe("hidden");
  const failed = await c.callTool({
    name: "revise_chart",
    arguments: { envelope: r.envelope, baseHash: "0".repeat(64), operations: [] },
  });
  expect(failed.isError).toBe(true);
  const atomic = await c.callTool({
    name: "revise_chart",
    arguments: { envelope: r.envelope, baseHash: r.contentHash, operations: [{ op: "set_category", category: 0, label: "Day" }, { op: "set_value", series: 3, category: 0, value: "1" }] },
  });
  expect(atomic.isError).toBe(true);
  const tooHigh = await c.callTool({
    name: "revise_chart",
    arguments: { envelope: r.envelope, baseHash: r.contentHash, operations: [{ op: "set_value", series: 0, category: 0, value: "9" }] },
  });
  expect(tooHigh.isError).toBe(true);
  expect(JSON.stringify(tooHigh.content)).toMatch(/outside the axis/);
}, 30000);

it("draws saved answers only when the answer view is explicitly requested", async () => {
  const c = await start();
  const pupil = await call(c, "create_chart", { spec: { example: "vline-cars" } });
  const answer = await call(c, "create_chart", { spec: { example: "vline-cars" }, outputView: "answer" });
  expect(answer.envelope).toEqual(pupil.envelope);
  expect(answer.outputView).toBe("answer");
  const lines = async (r: Result) =>
    (Buffer.from(await (await fetch(r.downloads.svg.url)).arrayBuffer()).toString().match(/stroke-width="0.6"/g) ?? []).length;
  expect(await lines(answer)).toBeGreaterThan(await lines(pupil));
}, 30000);
