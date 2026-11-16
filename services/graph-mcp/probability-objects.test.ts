// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/probability-objects-core/src/index";
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
    keys: { test: "probability-objects-synthetic-key-only-for-tests" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "probability-objects-test", version: "1" });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(base + "/mcp")));
  return { client };
}
type Result = {
  envelope: Envelope;
  contentHash: string;
  downloads: Record<string, { url: string }>;
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

it("creates a spinner and a dice with a hidden label, and prints verified pupil and answers files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "probability-objects" } });
  expect(JSON.stringify(caps.content)).toContain("replace_object");
  const r = await call(client, "create_diagram", {
    kind: "probability-objects",
    spec: { objects: [{ type: "spinner", labels: ["Red", { text: "Blue", hidden: true }, "", "Red"], fills: ["grey", "none", "none", "grey"] }, { type: "dice" }] },
  });
  const s = r.envelope.document.objects[0];
  expect(s.type === "spinner" && s.sectors.map((x) => x.label)).toEqual([
    { text: "Red", show: "show" },
    { text: "Blue", show: "hidden" },
    { text: "", show: "show" },
    { text: "Red", show: "show" },
  ]);
  expect(r.warnings.filter((w) => !w.startsWith("Editable JSON"))).toEqual([]);
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/probability-objects#probability-objects=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);
  const pupil = await (await fetch(r.downloads.svg.url)).text();
  expect(pupil).not.toContain("#b0125b");
  const answers = await call(client, "revise_diagram", { kind: "probability-objects", envelope: r.envelope, baseHash: r.contentHash, operations: [], outputView: "answer" });
  expect(await (await fetch(answers.downloads.svg.url)).text()).toContain("#b0125b");

  const dice = await call(client, "revise_diagram", {
    kind: "probability-objects",
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "set_label", objectId: "o2", slot: "face:1", text: "4" }],
  });
  expect(dice.warnings.some((w) => /3 and 4 are on opposite faces/.test(w))).toBe(true);
}, 30000);
