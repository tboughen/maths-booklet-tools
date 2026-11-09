// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { PDFDocument } from "pdf-lib";
import { graphService } from "./server";
import { WorksheetDownloads } from "./worksheet-tools";
import { comparativeBarCharts, treeDiagrams } from "../../packages/resource-core/src/fixtures";

const key = "synthetic-worksheet-test-only-not-a-production-key";
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
  const base = `http://127.0.0.1:${port}`,
    server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: key }, activeKey: "test" });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "worksheet-acceptance", version: "1" });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  return { client, base };
}
type Reply = {
  resource: unknown;
  contentHash: string;
  printReady: boolean;
  issues: { side: number; column: number; message: string }[];
  files: Record<string, string>;
  downloads: Record<string, { url: string }>;
};

describe("worksheet tools", () => {
  it("produces previews, pupil and answers PDFs and editable JSON for a finalised sheet", async () => {
    const { client } = await start();
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(["worksheet_capabilities", "create_worksheet"]));
    const r = await client.callTool({ name: "create_worksheet", arguments: { resource: treeDiagrams } });
    expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
    const reply = r.structuredContent as unknown as Reply;
    expect(reply.printReady).toBe(true);
    expect(reply.issues).toEqual([]);
    expect(reply.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(reply.files.pupilPdf).toBe("SP7.01_List outcomes of combined events using a tree diagram_A3.pdf");
    const images = (r.content as { type: string; mimeType?: string }[]).filter((c) => c.type === "image");
    expect(images).toHaveLength(2);

    const pupil = await fetch(reply.downloads.pupilPdf.url);
    expect(pupil.status).toBe(200);
    expect(pupil.headers.get("content-type")).toBe("application/pdf");
    expect(pupil.headers.get("content-disposition")).toContain("filename*=UTF-8''SP7.01_List%20outcomes");
    const bytes = new Uint8Array(await pupil.arrayBuffer());
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    for (const page of pdf.getPages()) {
      // A3 landscape in points: 420 x 297 mm.
      expect(page.getWidth()).toBeCloseTo((420 * 72) / 25.4, 1);
      expect(page.getHeight()).toBeCloseTo((297 * 72) / 25.4, 1);
    }
    // Vector output: embedded fonts, no images.
    const raw = Buffer.from(bytes).toString("latin1");
    expect(raw).toContain("/FontFile2");
    expect(raw).not.toContain("/Subtype /Image");

    const answers = await fetch(reply.downloads.answersPdf.url);
    expect(answers.status).toBe(200);
    expect((await PDFDocument.load(new Uint8Array(await answers.arrayBuffer()))).getPageCount()).toBe(2);

    const json = await (await fetch(reply.downloads.json.url)).json();
    expect(json).toEqual(treeDiagrams);
  });

  it("reports overflow as issues instead of shrinking text", async () => {
    const { client } = await start();
    const doc = structuredClone(comparativeBarCharts);
    doc.document.sides[0].columns[0].cards[0].items.push({ type: "space", kind: "working", heightMm: 120 });
    const r = await client.callTool({ name: "create_worksheet", arguments: { resource: doc } });
    expect(r.isError).not.toBe(true);
    const reply = r.structuredContent as unknown as Reply;
    expect(reply.printReady).toBe(false);
    expect(reply.issues[0]).toMatchObject({ side: 1, column: 1 });
    expect(JSON.stringify(r.content)).toContain("NOT print-ready");
  });

  it("refuses invalid documents with a specific error", async () => {
    const { client } = await start();
    const doc = structuredClone(treeDiagrams) as unknown as { document: { sides: unknown[] } };
    doc.document.sides = doc.document.sides.slice(0, 1);
    const r = await client.callTool({ name: "create_worksheet", arguments: { resource: doc } });
    expect(r.isError).toBe(true);
  });

  it("signs download links and rejects tampering", () => {
    const d = new WorksheetDownloads("http://127.0.0.1:1/", { test: key }, "test");
    const link = new URL(d.link(treeDiagrams, "pdf", "answers", 1_000_000).url);
    expect(link.href.length).toBeLessThan(7500);
    expect(d.verify(link, 1_000_000)).toMatchObject({ format: "pdf", view: "answers" });
    const forged = new URL(link);
    forged.searchParams.set("signature", "A".repeat(43));
    expect(() => d.verify(forged, 1_000_000)).toThrow(/signature/);
    expect(() => d.verify(link, 1_000_000 + 8 * 86_400_000)).toThrow(/expired/);
  });
});
