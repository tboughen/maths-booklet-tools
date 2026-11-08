// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import { TOOL_TITLES, serverVersion } from "./tool-metadata";
import servicePackage from "./package.json" with { type: "json" };

const servers: Server[] = [], clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});
async function start(buildId?: string) {
  const reservation = createServer();
  await new Promise<void>((r) => reservation.listen(0, "127.0.0.1", r));
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((r) => reservation.close(() => r()));
  const base = "http://127.0.0.1:" + port;
  const server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: "test-only-secret-".repeat(4) }, activeKey: "test", buildId });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "metadata-check", version: "1" });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(base + "/mcp")));
  return client;
}
type Json = { [key: string]: unknown };
const property = (schema: Json, key: string): Json | undefined => {
  const own = (schema.properties as Record<string, Json> | undefined)?.[key];
  if (own) return own;
  for (const branch of [...((schema.anyOf as Json[]) ?? []), ...((schema.oneOf as Json[]) ?? [])]) {
    const found = property(branch, key);
    if (found) return found;
  }
};

describe("MCP tool metadata (M4, M10, M17, M18)", () => {
  it("gives every tool a title, describes shared fields and reports the build", async () => {
    const client = await start("0123456789abcdef0123456789abcdef");
    expect(client.getServerVersion()?.version).toBe(`${servicePackage.version}+0123456789ab`);
    expect(client.getServerCapabilities()?.tools?.listChanged).toBe(false);
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name).sort()).toEqual(Object.keys(TOOL_TITLES).sort());
    for (const tool of tools) {
      expect(tool.title, tool.name).toBe(TOOL_TITLES[tool.name]);
      const schema = tool.inputSchema as Json;
      for (const key of ["envelope", "baseHash", "operations", "outputView"]) {
        const field = property(schema, key);
        if (field) expect(field.description, `${tool.name}.${key}`).toBeTruthy();
      }
    }
    expect(new Set(tools.map((t) => t.title)).size).toBe(tools.length);
  });
  it("accepts create_graph without schemaVersion and create_ratio_table with no arguments", async () => {
    const client = await start();
    const graph = await client.callTool({ name: "create_graph", arguments: { objects: [] } });
    expect(graph.isError).toBeFalsy();
    expect((graph.structuredContent as { envelope: { schemaVersion: number } }).envelope.schemaVersion).toBe(1);
    const table = await client.callTool({ name: "create_ratio_table", arguments: {} });
    expect(table.isError).toBeFalsy();
    const data = table.structuredContent as { envelope: { schemaVersion: number; document: { rows: { cells: { kind: string }[] }[] } }; editorUrl: string };
    expect(data.envelope.schemaVersion).toBe(1);
    expect(data.envelope.document.rows.map((r) => r.cells.map((c) => c.kind))).toEqual([["empty", "empty"], ["empty", "empty"]]);
    expect(data.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/ratio-table#ratio-table=/);
  }, 30000);
  it("builds versions with semver build metadata", () => {
    expect(serverVersion("1.0.0", undefined)).toBe("1.0.0+development");
    expect(serverVersion("1.2.3", "fedcba9876543210")).toBe("1.2.3+fedcba987654");
  });
});
