// @vitest-environment node
// Regression: the MCP SDK parses tool arguments with the advertised zod schema before the tool
// runs, so a patch schema that fills defaults resets saved values even if apply() merges carefully.
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";

const clients: Client[] = [], servers: Server[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map(c => c.close()));
  await Promise.all(servers.splice(0).map(s => new Promise<void>(r => s.close(() => r()))));
});
async function start() {
  const reserve = createServer();
  await new Promise<void>(r => reserve.listen(0, "127.0.0.1", r));
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>(r => reserve.close(() => r()));
  const base = `http://127.0.0.1:${port}`;
  const server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: "patch-merge-synthetic-test-key-only-not-production" }, activeKey: "test" });
  servers.push(server);
  await new Promise<void>(r => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "patch-merge", version: "1" });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(base + "/mcp")));
  return client;
}
type Result = { envelope: { document: Record<string, unknown> }; contentHash: string };
async function call(client: Client, name: string, args: Record<string, unknown>) {
  const r = await client.callTool({ name, arguments: args });
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  return r.structuredContent as Result;
}

it("revise_number_line set_presentation keeps the hidden answer, prompt and labels", async () => {
  const c = await start();
  const made = await call(c, "create_number_line", { spec: { axis: { minimum: "0", maximum: "10", variable: "y" }, teaching: { answer: "x > 3", prompt: "Show it", labels: { "0": "hidden" } } } });
  const r = await call(c, "revise_number_line", { envelope: made.envelope, baseHash: made.contentHash, operations: [{ op: "set_presentation", teaching: { answerVisible: true } }] });
  expect(r.envelope.document.teaching).toEqual({ ...(made.envelope.document.teaching as object), answerVisible: true });
  expect(r.envelope.document.axis).toEqual(made.envelope.document.axis);
  const axis = await call(c, "revise_number_line", { envelope: r.envelope, baseHash: r.contentHash, operations: [{ op: "set_axis", axis: { maximum: "12" } }] });
  expect(axis.envelope.document.axis).toEqual({ ...(made.envelope.document.axis as object), maximum: "12" });
  expect(axis.envelope.document.teaching).toEqual(r.envelope.document.teaching);
});

it("revise_algebra_grid set_settings keeps compact headings and grid-line weight", async () => {
  const c = await start();
  const made = await call(c, "create_algebra_grid", { spec: { example: "single" } });
  const { compactHeadings, gridLineMm } = made.envelope.document;
  const r = await call(c, "revise_algebra_grid", { envelope: made.envelope, baseHash: made.contentHash, operations: [{ op: "set_settings", settings: { questionVisible: false } }] });
  expect(r.envelope.document).toMatchObject({ compactHeadings, gridLineMm, questionVisible: false });
});
