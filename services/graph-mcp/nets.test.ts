// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import type { Envelope } from "../../packages/net-core/src/index";
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
  const server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: "nets-synthetic-key-only-for-tests" }, activeKey: "test" });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "nets-test", version: "1" });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(base + "/mcp")));
  return { client };
}
type Result = {
  envelope: Envelope;
  contentHash: string;
  downloads: Record<string, { url: string }>;
  printRaster: { width: number; height: number };
  physicalSizeCm: { width: number; height: number };
  outputView: string;
  warnings: string[];
};
async function call(client: Client, name: string, args: Record<string, unknown>) {
  const r = await client.callTool({ name, arguments: args });
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  return r.structuredContent as Result;
}

it("draws a cube net at true size, marks the opposite face only on request and keeps it hidden from pupils", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "diagram_capabilities", arguments: { kind: "nets" } });
  expect(JSON.stringify(caps.content)).toContain("mark_opposite");
  const r = await call(client, "create_diagram", {
    kind: "nets",
    spec: { nets: [{ preset: { type: "cube", net: 5 }, faces: [{ mark: "dot", label: "A" }, null, null, null, null, { label: "F" }] }] },
  });
  const faces = r.envelope.document.nets[0].faces;
  expect(faces[0].mark).toEqual({ kind: "dot", show: "show" });
  expect(faces[5].mark.kind).toBe("none");
  // The cross is 8 squares by 6 on 2-square faces, with a square to spare all round: 10 cm by 8 cm.
  expect(r.physicalSizeCm).toEqual({ width: 10, height: 8 });
  expect(r.warnings.filter((w) => !w.startsWith("Editable JSON"))).toContain("When folded, the net: A is opposite F.");
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);

  const marked = await call(client, "revise_diagram", { kind: "nets", envelope: r.envelope, baseHash: r.contentHash, operations: [{ op: "mark_opposite", netId: "n1", faceId: "f1" }] });
  expect(marked.envelope.document.nets[0].faces[5].mark).toEqual({ kind: "dot", show: "hidden" });
  expect(await (await fetch(marked.downloads.svg.url)).text()).not.toContain("#b0125b");
  const answers = await call(client, "revise_diagram", { kind: "nets", envelope: marked.envelope, baseHash: marked.contentHash, operations: [], outputView: "answer" });
  expect(await (await fetch(answers.downloads.svg.url)).text()).toContain("#b0125b");

  const notNet = await call(client, "create_diagram", { kind: "nets", spec: { nets: [{ squares: [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [3, 1]], caption: "C" }] } });
  expect(notNet.warnings.join(" ")).toContain("Net C does not fold into a cube");
}, 30000);
