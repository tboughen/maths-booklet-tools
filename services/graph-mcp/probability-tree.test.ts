// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { withFamilyNames } from "./family-tool-names";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { graphService } from "./server";
import { leaves, pathName, type Envelope } from "../../packages/probability-tree-core/src/index";
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
    keys: { test: "probability-tree-synthetic-key-only" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = withFamilyNames(new Client({ name: "probability-tree-test", version: "1" }));
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

it("creates a without-replacement tree with a given-that question and verified print files", async () => {
  const { client } = await start();
  const caps = await client.callTool({ name: "probability_tree_capabilities", arguments: {} });
  expect(JSON.stringify(caps.content)).toContain("given-that");
  const r = await call(client, "create_probability_tree", {
    spec: {
      stages: [{ outcomes: ["Red", "Blue"] }, { outcomes: ["Red", "Blue"] }],
      bag: { counts: [4, 6], replacement: false },
      hide: "probabilities",
      settings: { stageTitles: ["First", "Second"] },
      questions: [{ text: "P(first red | second red) =", event: ["Red, Red"], given: ["Red, Red", "Blue, Red"], calculate: true }],
    },
  });
  const d = r.envelope.document;
  expect(d.branches.map((b) => b.probability.text)).toEqual(["4/10", "3/9", "6/9", "6/10", "4/9", "5/9"]);
  expect(d.branches.every((b) => b.probability.show === "hidden")).toBe(true);
  expect(d.questions[0].answer).toEqual({ text: "1/3", show: "hidden" });
  expect(r.outputView).toBe("pupil");
  expect(r.editorUrl).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/probability-tree#tree=/);
  const png = new Uint8Array(await (await fetch(r.downloads.png.url)).arrayBuffer());
  verifyPrintBytes(png, r.printRaster.width, r.printRaster.height);
  const svg = await (await fetch(r.downloads.svg.url)).text();
  expect(svg).toContain("<svg");
});

it("revises an unequal tree with stable IDs and refuses a stale hash", async () => {
  const { client } = await start();
  const made = await call(client, "create_probability_tree", {
    spec: { stages: [{ outcomes: ["Pass", "Fail"], probabilities: ["0.6", ""] }] },
  });
  const fail = made.envelope.document.branches[1].id;
  const revised = await call(client, "revise_probability_tree", {
    envelope: made.envelope,
    baseHash: made.contentHash,
    operations: [
      { op: "fill_complements" },
      { op: "extend_branch", branchId: fail },
      { op: "add_question", question: { text: "P(pass within two) =", event: ["Pass", "Fail, Pass"] } },
    ],
  });
  const d = revised.envelope.document;
  expect(d.branches[1].probability.text).toBe("0.4");
  expect(leaves(d).map((b) => pathName(d, b.id))).toEqual(["Pass", "Fail, Pass", "Fail, Fail"]);
  // No answer is calculated unless asked.
  expect(d.questions[0].answer.text).toBe("");
  const stale = await client.callTool({
    name: "revise_probability_tree",
    arguments: { envelope: revised.envelope, baseHash: made.contentHash, operations: [] },
  });
  expect(stale.isError).toBe(true);
  const answer = await call(client, "create_probability_tree", { spec: { example: "two-bags" }, outputView: "answer" });
  expect(answer.outputView).toBe("answer");
  expect(answer.envelope.document.branches.some((b) => b.probability.show === "hidden")).toBe(true);
});
