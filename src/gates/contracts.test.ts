// @vitest-environment node
// Contract gate (docs/AUTONOMOUS-LOOP-POLICY.md, gate 8): saved-file schemas and the advertised MCP
// catalogue are compared with committed snapshots in src/gates/contracts/. Any difference fails, so
// a schema or MCP change is always visible in the diff and goes to Tim (tiers T5 and T6).
// After an approved change, refresh with UPDATE_CONTRACTS=1 npx vitest run src/gates/contracts.test.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { schema as algebraGrid } from "../../packages/algebra-grid-core/src/index";
import { schema as barModelV1 } from "../../packages/bar-model-core/src/index";
import { schema as barModelV2 } from "../../packages/bar-model-core/src/v2";
import { schema as barModelV3 } from "../../packages/bar-model-core/src/v3";
import { schema as barModelVersioned } from "../../packages/bar-model-core/src/versioned";
import { envelopeSchema as cuboid } from "../../packages/cuboid-core/src/index";
import { envelopeSchema as graph } from "../../packages/graph-core/src/interchange";
import { envelopeSchema as numberLine } from "../../packages/number-line-core/src/index";
import { ratioEnvelopeSchema as ratioTable } from "../../packages/ratio-table-core/src/schema";
import { envelopeSchema as triangle } from "../../packages/triangle-core/src/model";
import { envelopeSchema as valueGraph } from "../../packages/value-graph-core/src/schema";
import { envelopeSchema as venn } from "../../packages/venn-core/src/index";
import { graphService } from "../../services/graph-mcp/server";

const dir = "src/gates/contracts"; // vitest runs from the repository root
const update = process.env.UPDATE_CONTRACTS === "1";

function compare(name: string, actual: unknown) {
  const path = `${dir}/${name}.json`, text = JSON.stringify(actual, null, 2) + "\n";
  if (update) { mkdirSync(dir, { recursive: true }); writeFileSync(path, text); return; }
  let expected: unknown;
  try { expected = JSON.parse(readFileSync(path, "utf8")); } catch { throw new Error(`Missing ${path}; run with UPDATE_CONTRACTS=1 after Tim approves the change.`); }
  expect(actual, `${name} differs from ${path}. A schema or MCP change needs Tim; then run with UPDATE_CONTRACTS=1.`).toEqual(expected);
}

const savedFiles: Record<string, z.ZodType> = {
  "algebra-grid": algebraGrid, "bar-model-v1": barModelV1, "bar-model-v2": barModelV2, "bar-model-v3": barModelV3,
  "bar-model-versioned": barModelVersioned, cuboid, graph, "number-line": numberLine, "ratio-table": ratioTable,
  triangle, "value-graph": valueGraph, venn,
};

describe("contracts", () => {
  it("saved-file schemas match the committed contract", () => {
    const actual = Object.fromEntries(Object.entries(savedFiles).map(([k, s]) => [k, z.toJSONSchema(s, { io: "input", unrepresentable: "any" })]));
    compare("saved-files", actual);
  });

  const servers: { close: (cb: () => void) => void }[] = [], clients: Client[] = [];
  afterAll(async () => {
    await Promise.all(clients.map(c => c.close()));
    await Promise.all(servers.map(s => new Promise<void>(r => s.close(() => r()))));
  });

  it("the advertised MCP catalogue matches the committed contract", async () => {
    const reservation = createServer();
    await new Promise<void>(r => reservation.listen(0, "127.0.0.1", r));
    const port = (reservation.address() as { port: number }).port;
    await new Promise<void>(r => reservation.close(() => r()));
    const base = `http://127.0.0.1:${port}`;
    const server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: "synthetic-contract-test-only-not-a-production-key" }, activeKey: "test" });
    servers.push(server);
    await new Promise<void>(r => server.listen(port, "127.0.0.1", r));
    const client = new Client({ name: "contract-gate", version: "1" });
    clients.push(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
    const { tools } = await client.listTools();
    // Normalise the local origin so the snapshot does not depend on the test port.
    const catalogue = JSON.parse(JSON.stringify(tools.sort((a, b) => a.name.localeCompare(b.name))).split(base).join("https://mcp.example"));
    compare("mcp-catalogue", catalogue);
  });
});
