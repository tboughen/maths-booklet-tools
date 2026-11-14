// @vitest-environment node
/**
 * M2: the connector's catalogue has a byte budget, so schema growth cannot slip in unseen. Every
 * conversation that loads the connector pays for tools/list; a family's capabilities are paid
 * the first time it is used. Budgets live in catalogue-budget.json with the measurements behind
 * them. The test prints the current sizes, so a pull request's CI log shows the change.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import { DIAGRAM_KINDS } from "../../packages/diagram-core/src/registry";
import budget from "./catalogue-budget.json" with { type: "json" };

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");
let server: Server, client: Client;
beforeAll(async () => {
  const reservation = createServer();
  await new Promise<void>((r) => reservation.listen(0, "127.0.0.1", r));
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((r) => reservation.close(() => r()));
  const base = "http://127.0.0.1:" + port;
  server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: "test-only-secret-".repeat(4) }, activeKey: "test" });
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  client = new Client({ name: "catalogue-budget", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(base + "/mcp")));
});
afterAll(async () => {
  await client.close();
  await new Promise<void>((r) => server.close(() => r()));
});

describe("connector catalogue budget (M2)", () => {
  it("keeps tools/list, each tool and each description within budget", async () => {
    const tools = (await client.listTools()).tools;
    const total = bytes(tools);
    const rows = tools.map((t) => ({ tool: t.name, bytes: bytes(t), budget: (budget.perTool as Record<string, number>)[t.name] ?? budget.perTool.default, description: t.description?.length ?? 0 }));
    console.log(`catalogue: tools/list ${total} bytes (budget ${budget.toolsList})\n` + rows.map((r) => `  ${r.tool}: ${r.bytes} / ${r.budget} bytes, description ${r.description} chars`).join("\n"));
    expect(total, "tools/list bytes").toBeLessThanOrEqual(budget.toolsList);
    for (const r of rows) {
      expect(r.bytes, `${r.tool} bytes`).toBeLessThanOrEqual(r.budget);
      expect(r.description, `${r.tool} description characters`).toBeLessThanOrEqual(budget.descriptionChars);
    }
  });

  it("keeps every family's capabilities and the worksheet capabilities within budget", async () => {
    const caps = budget.capabilities as Record<string, number>;
    const lines: string[] = [];
    for (const kind of DIAGRAM_KINDS) {
      const r = await client.callTool({ name: "diagram_capabilities", arguments: { kind } });
      const size = bytes(r.content);
      const limit = caps[kind] ?? caps.default;
      lines.push(`  ${kind}: ${size} / ${limit}`);
      expect(size, `${kind} capabilities bytes`).toBeLessThanOrEqual(limit);
    }
    const w = await client.callTool({ name: "worksheet_capabilities", arguments: {} });
    lines.push(`  worksheet: ${bytes(w.content)} / ${caps.worksheet}`);
    console.log("capabilities:\n" + lines.join("\n"));
    expect(bytes(w.content), "worksheet_capabilities bytes").toBeLessThanOrEqual(caps.worksheet);
  });
});
