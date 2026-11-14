// @vitest-environment node
/** M12: every connector failure, from any tool or the SDK itself, has the one error shape. */
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import { DIAGRAM_KINDS, FAMILIES } from "../../packages/diagram-core/src/registry";
import type { ToolErrorBody } from "./tool-error";

const servers: Server[] = [],
  clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});
async function start() {
  const reservation = createServer();
  await new Promise<void>((r) => reservation.listen(0, "127.0.0.1", r));
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((r) => reservation.close(() => r()));
  const base = "http://127.0.0.1:" + port;
  const server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: "test-only-secret-".repeat(4) }, activeKey: "test" });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "error-shape", version: "1" });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(base + "/mcp")));
  return client;
}
/** Calls a tool that must fail and returns its parsed error body, checking the shape. */
async function failure(client: Client, name: string, args: Record<string, unknown>): Promise<ToolErrorBody> {
  const r = await client.callTool({ name, arguments: args });
  expect(r.isError, `${name} should fail`).toBe(true);
  const content = r.content as { type: string; text: string }[];
  expect(content).toHaveLength(1);
  const body = JSON.parse(content[0].text) as ToolErrorBody;
  expect(Object.keys(body).every((k) => ["code", "message", "fields", "hint", "retry"].includes(k)), JSON.stringify(body)).toBe(true);
  expect(body.code).toMatch(/^[a-z][a-z0-9_]+$/);
  expect(body.message.length).toBeGreaterThan(0);
  expect(["fix_input", "refresh_envelope", "try_later", "none"]).toContain(body.retry);
  for (const f of body.fields ?? []) expect(typeof f.path === "string" && typeof f.message === "string").toBe(true);
  return body;
}

describe("one error shape across the connector (M12)", () => {
  it("names the failing field when arguments fail a tool's own input schema", async () => {
    const client = await start();
    const badKind = await failure(client, "create_diagram", { kind: "pie-chart" });
    expect(badKind.code).toBe("invalid_input");
    expect(badKind.fields?.[0].path).toBe("kind");
    expect(badKind.message).not.toMatch(/Input validation error/);
    const extra = await failure(client, "revise_diagram", { kind: "venn", envelope: {}, baseHash: "x", operations: [], colour: "red" });
    expect(extra.fields?.some((f) => f.path === "input" || f.path === "colour")).toBe(true);
    expect(extra.hint).toContain('diagram_capabilities {kind:"venn"}');
    const sheet = await failure(client, "create_worksheet", { resource: { kind: "worksheet-a3" } });
    expect(sheet.code).toBe("invalid_input");
    expect(sheet.fields?.every((f) => f.path.startsWith("resource"))).toBe(true);
    expect(sheet.hint).toContain("worksheet_capabilities");
    const booklet = await failure(client, "create_booklet", {});
    expect(booklet.fields?.[0].path).toBe("booklet");
  });

  it("reports a stale baseHash the same way for every family", async () => {
    const client = await start();
    for (const kind of DIAGRAM_KINDS) {
      let envelope: unknown;
      try {
        envelope = FAMILIES[kind].create(kind === "graph" ? { spec: { objects: [] } } : {});
      } catch {
        continue;
      }
      const body = await failure(client, "revise_diagram", { kind, envelope, baseHash: "0".repeat(64), operations: [] });
      expect(body.code, kind).toBe("stale_hash");
      expect(body.retry, kind).toBe("refresh_envelope");
      expect(body.hint, kind).toContain("contentHash");
    }
  });

  it("keeps a core's own code and names spec fields on create", async () => {
    const client = await start();
    const chart = await failure(client, "create_diagram", { kind: "charts", spec: { categories: "Mon" } });
    expect(chart.code).toBe("invalid_input");
    expect(chart.fields?.[0].path).toBe("spec.categories");
    const view = await failure(client, "create_diagram", { kind: "cuboids", spec: {}, outputView: "answer" });
    expect(view.code).toBe("invalid_input");
    expect(view.message).toContain("outputView applies only to");
  });

  it("uses the shape for output tools and SVG delivery too", async () => {
    const client = await start();
    const bundle = await failure(client, "download_diagram_bundle", { kind: "venn", envelope: { nope: true } });
    expect(bundle.code).toMatch(/invalid/);
    const svg = await failure(client, "get_diagram_svg", { kind: "venn", envelope: FAMILIES.venn.create({}), offsetBytes: 10 });
    expect(svg.code).toBe("svg_hash_required");
    const placement = await failure(client, "check_diagram_placement", { kind: "venn", envelope: FAMILIES.venn.create({}), widthMm: -5 });
    expect(placement.code).toBe("invalid_input");
  });

  it("answers an unknown tool with the shape", async () => {
    const client = await start();
    const body = await failure(client, "create_bar_model", {});
    expect(body.code).toBe("unknown_tool");
  });
});
