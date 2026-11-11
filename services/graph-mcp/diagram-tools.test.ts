// @vitest-environment node
// The generic diagram tools (wave 4 lane D): one registry, three tools, every family.
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import { DIAGRAM_KINDS, FAMILIES, drawDiagram, svgSizeMm } from "../../packages/diagram-core/src/registry";
import { GUIDES } from "../../packages/diagram-core/src/guides";
import { TOOL_TITLES } from "./tool-metadata";

const servers: Server[] = [],
  clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});
async function start(extra: { dailyBytes?: number } = {}) {
  const reserve = createServer();
  await new Promise<void>((r) => reserve.listen(0, "127.0.0.1", r));
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>((r) => reserve.close(() => r()));
  const base = `http://127.0.0.1:${port}`;
  const server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: "diagram-tools-test-only-key-0123456789" }, activeKey: "test", ...extra });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "generic-diagram-tools", version: "1" });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  return client;
}
function homogeneous(v: unknown, path = "schema"): void {
  if (!v || typeof v !== "object") return;
  const node = v as Record<string, unknown>;
  expect(node, path).not.toHaveProperty("prefixItems");
  if (node.type === "array") expect(Array.isArray(node.items), path).toBe(false);
  for (const [k, child] of Object.entries(node)) homogeneous(child, `${path}.${k}`);
}
/** Each family's smallest valid new diagram. */
const DEFAULT_SPEC: Partial<Record<(typeof DIAGRAM_KINDS)[number], Record<string, unknown>>> = { graph: { objects: [] } };

describe("registry", () => {
  it("lists every family once, with a guide, and draws each default at its printed size", () => {
    expect(Object.keys(FAMILIES).sort()).toEqual([...DIAGRAM_KINDS].sort());
    expect(Object.keys(GUIDES).sort()).toEqual([...DIAGRAM_KINDS].sort());
    for (const kind of DIAGRAM_KINDS) {
      const f = FAMILIES[kind];
      expect(f.kind).toBe(kind);
      const e = f.create(DEFAULT_SPEC[kind] ? { spec: DEFAULT_SPEC[kind] } : {});
      const pupil = drawDiagram(kind, e, "pupil"),
        answer = drawDiagram(kind, e, "answer");
      expect(pupil.widthMm, kind).toBeGreaterThan(10);
      expect(pupil.heightMm, kind).toBeGreaterThan(10);
      // Both copies reserve the same space, so a worksheet's layout never moves between them.
      expect(answer.widthMm).toBe(pupil.widthMm);
      expect(answer.heightMm).toBe(pupil.heightMm);
      expect(pupil.altText.length, kind).toBeGreaterThan(3);
    }
  });
  it("reads SVG sizes in mm, cm, inches and points", () => {
    expect(svgSizeMm('<svg width="12cm" height="3.5cm">')).toEqual({ width: 120, height: 35 });
    expect(svgSizeMm('<svg width="45mm" height="45">')).toEqual({ width: 45, height: 45 });
    expect(svgSizeMm('<svg width="1in" height="72pt">').width).toBeCloseTo(25.4);
  });
});

describe("generic connector tools", () => {
  it("advertises nine small tools, within the tools/list budget", async () => {
    const client = await start();
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name).sort()).toEqual(Object.keys(TOOL_TITLES).sort());
    expect(tools).toHaveLength(9);
    for (const t of tools) {
      homogeneous(t.inputSchema, `${t.name}.input`);
      homogeneous(t.outputSchema, `${t.name}.output`);
      if (t.name.endsWith("_diagram") || t.name === "diagram_capabilities")
        expect(JSON.stringify(t).length, t.name).toBeLessThan(8 * 1024);
    }
    // Every chat pays for tools/list before the teacher types; wave 4 cut it from about 478 KB.
    expect(JSON.stringify(tools).length).toBeLessThan(150 * 1024);
    expect((client.getInstructions() ?? "").length).toBeLessThan(2000);
  });
  it("lists the families and gives each one's options, guides and schemas on request", async () => {
    const client = await start();
    const list = await client.callTool({ name: "diagram_capabilities", arguments: {} });
    expect((list.structuredContent as { families: { kind: string }[] }).families.map((f) => f.kind)).toEqual([...DIAGRAM_KINDS]);
    for (const kind of DIAGRAM_KINDS) {
      const r = await client.callTool({ name: "diagram_capabilities", arguments: { kind } });
      expect(r.isError, kind).not.toBe(true);
      const c = r.structuredContent as Record<string, unknown>;
      expect(c.kind).toBe(kind);
      expect(c.createGuide).toBeTypeOf("string");
      expect(c.reviseGuide).toBeTypeOf("string");
      expect(JSON.stringify(c.operationsSchema), kind).toContain('"op"');
      homogeneous(c.specSchema, `${kind}.specSchema`);
      homogeneous(c.operationsSchema, `${kind}.operationsSchema`);
      // Read on demand, but still bounded: the largest (bar models) is well under 64 KB.
      expect(JSON.stringify(c).length, kind).toBeLessThan(64 * 1024);
    }
  }, 30000);
  it.each([...DIAGRAM_KINDS])("creates a %s with a summary, alt text, resource links and real files", async (kind) => {
    const client = await start();
    const r = await client.callTool({ name: "create_diagram", arguments: { kind, ...(DEFAULT_SPEC[kind] ? { spec: DEFAULT_SPEC[kind] } : {}) } });
    expect(r.isError, JSON.stringify(r.content).slice(0, 400)).not.toBe(true);
    const data = r.structuredContent as { kind: string; summary: string; altText: string; contentHash: string; envelope: unknown; downloads: Record<string, { url: string }> };
    expect(data.kind).toBe(kind);
    // The generic output still carries the family's own checked envelope and a SHA-256 hash.
    expect(() => FAMILIES[kind].validate(data.envelope, "pupil")).not.toThrow();
    expect(data.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data).toMatchObject({ printDpi: 600, printVerified: true });
    expect(data.summary).toMatch(new RegExp(`^Created an? ${FAMILIES[kind].label}, [\\d.]+ × [\\d.]+ cm at 100%\\.`));
    expect(data.altText.length).toBeGreaterThan(3);
    const content = r.content as Array<{ type: string; text?: string; uri?: string; mimeType?: string }>;
    expect(content[0]).toEqual({ type: "text", text: data.summary });
    expect(content[1].type).toBe("image");
    const links = content.filter((c) => c.type === "resource_link");
    expect(links.map((l) => l.mimeType).sort()).toEqual(["application/json", "image/png", "image/svg+xml"]);
    for (const l of links) expect(l.uri).toBe(Object.values(data.downloads).find((d) => d.url === l.uri)?.url);
    const json = await fetch(data.downloads.json.url);
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual(data.envelope);
    // The same envelope revises with no operations to fresh links and the same hash.
    const again = await client.callTool({ name: "revise_diagram", arguments: { kind, envelope: data.envelope, baseHash: data.contentHash, operations: [] } });
    expect(again.isError).not.toBe(true);
    expect((again.structuredContent as { contentHash: string }).contentHash).toBe(data.contentHash);
  }, 30000);
  it("names the field that is wrong and points at the family's schema", async () => {
    const client = await start();
    const r = await client.callTool({ name: "create_diagram", arguments: { kind: "charts", spec: { categories: "Mon" } } });
    expect(r.isError).toBe(true);
    const error = JSON.parse((r.content as { text: string }[])[0].text) as { code: string; message: string };
    expect(error.code).toBe("invalid_input");
    expect(error.message).toMatch(/^spec\.categories: /);
    expect(error.message).toContain('diagram_capabilities {kind:"charts"}');
    const view = await client.callTool({ name: "create_diagram", arguments: { kind: "graph", spec: { objects: [] }, outputView: "answer" } });
    expect(view.isError).toBe(true);
    expect(JSON.stringify(view.content)).toContain("outputView applies only to");
    const stale = await client.callTool({ name: "revise_diagram", arguments: { kind: "venn", envelope: FAMILIES.venn.create({}), baseHash: "0".repeat(64), operations: [] } });
    expect(stale.isError).toBe(true);
  });
  it("has no per-family tools any more", async () => {
    const client = await start();
    for (const name of ["create_bar_model", "revise_venn", "triangle_capabilities", "create_graph"]) {
      const r = await client.callTool({ name, arguments: {} }).catch((e: Error) => ({ isError: true, content: [{ type: "text", text: e.message }] }));
      expect(r.isError, name).toBe(true);
    }
  });
  it("counts a connector call's output against the caller's share of the daily allowance", async () => {
    // A quarter of 400 KB is less than two graph previews, so one address runs out first.
    const client = await start({ dailyBytes: 400 * 1024 });
    const errors: string[] = [];
    for (let i = 0; i < 12 && !errors.length; i++) {
      const r = await client.callTool({ name: "create_diagram", arguments: { kind: "graph", spec: { objects: [] } } });
      if (r.isError) errors.push(JSON.stringify(r.content));
    }
    expect(errors[0]).toContain("its share of today");
  });
  it("reports degrees, not centimetres, as the answer unit for an angle", async () => {
    const client = await start();
    const r = await client.callTool({ name: "create_diagram", arguments: { kind: "triangle" } });
    const contexts = (r.structuredContent as { calculationContexts: { target: string; lengthUnit: string; answerUnit: string }[] }).calculationContexts;
    const angle = contexts.find((c) => c.target.startsWith("a:"));
    const side = contexts.find((c) => c.target.startsWith("e:"));
    expect(angle?.answerUnit).toBe("°");
    expect(side?.answerUnit).toBe(side?.lengthUnit);
    expect(["cm", "mm", "m"]).toContain(angle?.lengthUnit);
  });
});
