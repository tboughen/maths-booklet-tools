// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { PDFDocument } from "pdf-lib";
import { graphService } from "./server";
import { WorksheetDownloads } from "./worksheet-tools";
import { memoryDocumentStore, type DocumentStore } from "./document-store";
import { inflateSync, strFromU8, unzipSync } from "fflate";
import { comparativeBarCharts, treeDiagrams } from "../../packages/resource-core/src/fixtures";
import { a7Booklet } from "../../packages/resource-core/src/booklet-fixtures";
import { lessonPagesOf, renderBooklet, validateBooklet } from "../../packages/resource-core/src/index";
const renderable = (b: unknown) => validateBooklet(b);
/** Incompressible teacher notes, so a test booklet is as large as a real unit once deflated. */
const noise = (seed: number) => {
  let x = seed + 1;
  return Array.from({ length: 900 }, () => ((x = (x * 1103515245 + 12345) % 2147483648), "abcdefghijklmnopqrstuvwxyz"[x % 26])).join("");
};

const key = "synthetic-worksheet-test-only-not-a-production-key";
const servers: Server[] = [],
  clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});
async function start(documentStore?: DocumentStore) {
  const reservation = createServer();
  await new Promise<void>((r) => reservation.listen(0, "127.0.0.1", r));
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((r) => reservation.close(() => r()));
  const base = `http://127.0.0.1:${port}`,
    server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: key }, activeKey: "test", documentStore });
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
    // The advertised column widths are the renderer's own.
    const caps = await client.callTool({ name: "worksheet_capabilities", arguments: {} });
    const widths = JSON.parse((caps.content as { text: string }[])[0].text).columnWidthsMm;
    expect(widths).toEqual({ three: [131.3, 131.3, 131.3], two: [199.5, 199.5], "wide-narrow": [267.7, 131.3], "narrow-wide": [131.3, 267.7], one: [404] });
    const r = await client.callTool({ name: "create_worksheet", arguments: { resource: treeDiagrams } });
    expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
    const reply = r.structuredContent as unknown as Reply;
    expect(reply.printReady).toBe(true);
    expect(reply.issues).toEqual([]);
    expect(reply.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(reply.files.pupilPdf).toBe("SP7.01_List outcomes of combined events using a tree diagram_A3.pdf");
    const images = (r.content as { type: string; mimeType?: string }[]).filter((c) => c.type === "image");
    expect(images).toHaveLength(2);
    // Clients that show the model only text and images still get every link.
    const text = (r.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    for (const link of Object.values(reply.downloads)) expect(text).toContain(link.url);

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
    // The editable JSON is the sheet exactly as sent: an older sheet without spareSpace stays without it.
    expect(json).toEqual(treeDiagrams);
    expect((reply.resource as { document: Record<string, unknown> }).document).not.toHaveProperty("spareSpace");
  });

  it("keeps an explicit spareSpace and notes columns that are mostly blank", async () => {
    const { client } = await start();
    const sparse = structuredClone(treeDiagrams) as unknown as { document: { spareSpace?: string; sides: { columns: { cards: unknown[] }[] }[] } };
    sparse.document.spareSpace = "last";
    sparse.document.sides[1].columns[2].cards.splice(1);
    const r = await client.callTool({ name: "create_worksheet", arguments: { resource: sparse } });
    expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
    const reply = r.structuredContent as unknown as Reply & { notes: { side: number; column: number; message: string }[] };
    expect((reply.resource as { document: { spareSpace: string } }).document.spareSpace).toBe("last");
    expect(reply.printReady).toBe(true);
    expect(reply.notes.some((n) => n.side === 2 && n.column === 3 && /blank/.test(n.message))).toBe(true);
    expect((r.content as { type: string; text?: string }[])[0].text).toContain("ask the teacher before adding questions");
  });

  it("returns a fraction note for a fraction typed inline and prints {3/4} stacked", async () => {
    const { client } = await start();
    const sheet = structuredClone(treeDiagrams) as unknown as { document: { notation?: string; sides: { columns: { cards: { items: unknown[] }[] }[] }[] } };
    sheet.document.sides[0].columns[0].cards[0].items.unshift({ type: "text", text: "P(red) = 1/2" });
    const r = await client.callTool({ name: "create_worksheet", arguments: { resource: sheet } });
    const reply = r.structuredContent as unknown as Reply & { notes: { question?: number; message: string }[] };
    expect(reply.printReady).toBe(true);
    expect(reply.notes.find((n) => n.question === 1)?.message).toContain("{1/2}");
    expect((r.content as { type: string; text?: string }[])[0].text).toContain("Fraction notes:");
    sheet.document.notation = "maths";
    sheet.document.sides[0].columns[0].cards[0].items[0] = { type: "text", text: "P(red) = {1/2}" };
    const fixed = await client.callTool({ name: "create_worksheet", arguments: { resource: sheet } });
    const ok = fixed.structuredContent as unknown as Reply & { notes: { question?: number }[] };
    expect(ok.notes.filter((n) => n.question !== undefined)).toEqual([]);
  });

  it("gives pupil and answers Word files with the PDF layout", async () => {
    const { client } = await start();
    const r = await client.callTool({ name: "create_worksheet", arguments: { resource: comparativeBarCharts } });
    expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
    const reply = r.structuredContent as unknown as Reply;
    expect(reply.files.pupilDocx).toBe(reply.files.pupilPdf.replace(/\.pdf$/, ".docx"));
    expect(reply.files.answersDocx).toBe(reply.files.answersPdf.replace(/\.pdf$/, ".docx"));
    const word = async (slot: string) => {
      const res = await fetch(reply.downloads[slot].url);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      expect(res.headers.get("content-disposition")).toContain(".docx");
      const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
      return { files, xml: strFromU8(files["word/document.xml"]) };
    };
    const pupil = await word("pupilDocx"),
      answers = await word("answersDocx");
    // A3 landscape (420 x 297 mm in twips), Inter embedded, diagrams as SVG with a PNG fallback.
    expect(pupil.xml).toMatch(/<w:pgSz w:w="23811" w:h="16838" w:orient="landscape"\/>/);
    expect(Object.keys(pupil.files).filter((f) => f.endsWith(".odttf"))).toHaveLength(3);
    expect(Object.keys(pupil.files).some((f) => f.endsWith(".svg"))).toBe(true);
    expect(Object.keys(pupil.files).some((f) => f.endsWith(".png"))).toBe(true);
    // Saved answers print only in the answers file.
    expect(pupil.xml).not.toContain(">Walk<");
    expect(answers.xml).toContain(">Walk<");
  });

  it("signs Word links for booklets too", async () => {
    const downloads = new WorksheetDownloads("http://127.0.0.1", { test: key }, "test");
    const link = downloads.link(renderable(a7Booklet), "docx", "pupil");
    await expect(downloads.verify(new URL(link.url))).resolves.toMatchObject({ format: "docx", view: "pupil" });
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

  it("signs download links and rejects tampering", async () => {
    const d = new WorksheetDownloads("http://127.0.0.1:1/", { test: key }, "test");
    const link = new URL(d.link(treeDiagrams, "pdf", "answers", 1_000_000).url);
    expect(link.href.length).toBeLessThan(7500);
    await expect(d.verify(link, 1_000_000)).resolves.toMatchObject({ format: "pdf", view: "answers" });
    const forged = new URL(link);
    forged.searchParams.set("signature", "A".repeat(43));
    await expect(d.verify(forged, 1_000_000)).rejects.toThrow(/signature/);
    await expect(d.verify(link, 1_000_000 + 8 * 86_400_000)).rejects.toThrow(/expired/);
  });
});

type BookletReply = {
  printReady: boolean;
  pages: number;
  issues: { lesson: number; message: string }[];
  files: Record<string, string>;
  downloads: Record<string, { url: string }>;
  lessons: { lesson: number; title: string; firstPage: number; pupilPdf?: { url: string }; answersPdf?: { url: string }; pupilDocx?: { url: string }; answersDocx?: { url: string } }[];
};
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/** A booklet Word file: its pages (one per page-opening paragraph), first page number and parts. */
async function bookletWord(url: string) {
  const res = await fetch(url);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe(DOCX);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const xml = strFromU8(files["word/document.xml"]);
  return {
    disposition: res.headers.get("content-disposition") ?? "",
    files,
    xml,
    pages: (xml.match(/<w:pageBreakBefore\/>/g) ?? []).length + 1,
    start: Number(xml.match(/<w:pgNumType w:start="(\d+)"\/>/)?.[1]),
  };
}

describe("booklet tool", () => {
  it("produces previews, whole-booklet files and a PDF link for every lesson", async () => {
    const { client } = await start();
    expect((await client.listTools()).tools.map((t) => t.name)).toContain("create_booklet");
    const r = await client.callTool({ name: "create_booklet", arguments: { booklet: a7Booklet } });
    expect(r.isError, JSON.stringify(r.content).slice(0, 400)).not.toBe(true);
    const reply = r.structuredContent as unknown as BookletReply;
    const full = renderBooklet(a7Booklet);
    expect(reply).toMatchObject({ printReady: true, pages: full.pages.length, issues: [] });
    expect(reply.files.pupilPdf).toBe("A7_Algebraic proficiency visualising_Booklet_A4.pdf");
    const content = r.content as { type: string; resource?: { mimeType: string; blob?: string; text?: string } }[];
    // Cover plus the first page of each lesson (two lessons in the example).
    expect(content.filter((c) => c.type === "image")).toHaveLength(3);
    const bookletText = (r.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    for (const link of Object.values(reply.downloads)) expect(bookletText).toContain((link as { url: string }).url);
    for (const lesson of reply.lessons) for (const link of [lesson.pupilPdf, lesson.answersPdf, lesson.pupilDocx, lesson.answersDocx]) if (link) expect(bookletText).toContain(link.url);

    // The whole booklet is either a link or an included file, for each of the five outputs.
    const included = content.filter((c) => c.type === "resource").map((c) => c.resource!);
    expect(Object.keys(reply.downloads).length + included.length).toBe(5);
    expect(reply.files.pupilDocx).toBe("A7_Algebraic proficiency visualising_Booklet_A4.docx");
    expect(reply.files.answersDocx).toBe("A7_Algebraic proficiency visualising_Booklet_Answers_A4.docx");
    const wholePupil = reply.downloads.pupilPdf
      ? new Uint8Array(await (await fetch(reply.downloads.pupilPdf.url)).arrayBuffer())
      : Buffer.from(included.find((f) => f.mimeType === "application/pdf")!.blob!, "base64");
    const pdf = await PDFDocument.load(wholePupil);
    expect(pdf.getPageCount()).toBe(full.pages.length);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo((210 * 72) / 25.4, 1);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo((297 * 72) / 25.4, 1);

    // The Word files have the PDF's pages: A4 portrait, a fixed page per planned page, the cover
    // without a footer, and saved answers only in the answers file.
    const pupilWord = await bookletWord(reply.downloads.pupilDocx.url);
    const answersWord = await bookletWord(reply.downloads.answersDocx.url);
    expect(pupilWord.disposition).toContain(".docx");
    expect(pupilWord.xml).toMatch(/<w:pgSz w:w="11906" w:h="16838"\/>/);
    expect(pupilWord.pages).toBe(full.pages.length);
    expect(answersWord.pages).toBe(full.pages.length);
    expect(pupilWord.start).toBe(1);
    expect(pupilWord.xml).toContain("<w:titlePg/>");
    expect(Object.keys(pupilWord.files).filter((f) => f.endsWith(".odttf"))).toHaveLength(3);
    expect(pupilWord.xml).not.toContain("B0125B");
    expect(answersWord.xml).toContain("B0125B");

    expect(reply.lessons.map((l) => l.firstPage)).toEqual(full.lessonPages);
    for (const [i, lesson] of reply.lessons.entries()) {
      for (const view of ["pupil", "answers"] as const) {
        const res = await fetch(lesson[`${view}Pdf`]!.url);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-disposition")).toContain(encodeURIComponent(`_Lesson ${i + 1}`));
        const one = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()));
        expect(one.getPageCount()).toBe(lessonPagesOf(a7Booklet, i, { view }).pages.length);
        // The lesson's Word file: its pages, numbered from the lesson's first page, no cover.
        const word = await bookletWord(lesson[`${view}Docx`]!.url);
        expect(word.disposition).toContain(encodeURIComponent(`_Lesson ${i + 1}`));
        expect(word.disposition).toContain(".docx");
        expect(word.pages).toBe(one.getPageCount());
        expect(word.start).toBe(lesson.firstPage);
        expect(word.xml).not.toContain("<w:titlePg/>");
      }
    }
  }, 90_000);

  it("makes no files and names the place when a lesson does not fit", async () => {
    const { client } = await start();
    const doc = structuredClone(a7Booklet);
    doc.document.lessons[1].sections[0].cards[0].items.push({ type: "space", kind: "working", heightMm: 200 }, { type: "space", kind: "working", heightMm: 200 });
    const r = await client.callTool({ name: "create_booklet", arguments: { booklet: doc } });
    expect(r.isError).not.toBe(true);
    const reply = r.structuredContent as unknown as BookletReply;
    expect(reply.printReady).toBe(false);
    expect(reply.issues[0]).toMatchObject({ lesson: 2 });
    expect(reply.downloads).toEqual({});
    expect(reply.lessons.every((l) => !l.pupilPdf)).toBe(true);
    expect(JSON.stringify(r.content)).toContain("NOT print-ready");
  });

  it("refuses an invalid booklet and a lesson link that was not made by the service", async () => {
    const { client } = await start();
    const doc = structuredClone(a7Booklet) as unknown as { document: { lessons: unknown[] } };
    doc.document.lessons = [];
    expect((await client.callTool({ name: "create_booklet", arguments: { booklet: doc } })).isError).toBe(true);
    const d = new WorksheetDownloads("http://127.0.0.1:1/", { test: key }, "test");
    // Numbering is only valid on a one-lesson PDF or Word file.
    const forged = new URL(d.link(a7Booklet, "pdf", "pupil", 1_000_000, { lessonOffset: 1, pageOffset: 3 }).url);
    await expect(d.verify(forged, 1_000_000)).rejects.toThrow(/token/);
    const one = renderable({ ...a7Booklet, document: { ...a7Booklet.document, intro: null, lessons: [a7Booklet.document.lessons[1]] } });
    const json = new URL(d.link(one, "json", "pupil", 1_000_000, { lessonOffset: 1, pageOffset: 3 }).url);
    await expect(d.verify(json, 1_000_000)).rejects.toThrow(/token/);
    const word = new URL(d.link(one, "docx", "answers", 1_000_000, { lessonOffset: 1, pageOffset: 3 }).url);
    await expect(d.verify(word, 1_000_000)).resolves.toMatchObject({ format: "docx", numbering: { lessonOffset: 1, pageOffset: 3 } });
  });

  it("takes a whole 11-lesson unit in one call and links its whole-booklet files from the store", async () => {
    const { client, base } = await start();
    const doc = structuredClone(a7Booklet);
    const [l1, l2] = doc.document.lessons;
    doc.document.lessons = Array.from({ length: 11 }, (_, i) => ({ ...structuredClone(i % 2 ? l2 : l1), code: `A7.${String(i + 1).padStart(2, "0")}`, teacherNotes: noise(i) }));
    const size = JSON.stringify({ booklet: doc }).length;
    expect(size).toBeGreaterThan(64 * 1024);
    const r = await client.callTool({ name: "create_booklet", arguments: { booklet: doc } }, undefined, { timeout: 120_000 });
    expect(r.isError, JSON.stringify(r.content).slice(0, 400)).not.toBe(true);
    const reply = r.structuredContent as unknown as BookletReply;
    expect(reply.printReady).toBe(true);
    // No files are pushed into the reply; every output is a link.
    expect((r.content as { type: string }[]).some((c) => c.type === "resource")).toBe(false);
    expect(Object.keys(reply.downloads).sort()).toEqual(["answersDocx", "answersPdf", "json", "pupilDocx", "pupilPdf"]);
    // Too big to carry, so the link names the stored copy.
    expect(reply.downloads.pupilPdf.url.length).toBeLessThan(600);
    const pdf = await PDFDocument.load(new Uint8Array(await (await fetch(reply.downloads.pupilPdf.url)).arrayBuffer()));
    expect(pdf.getPageCount()).toBe(reply.pages);
    expect(await (await fetch(reply.downloads.json.url)).json()).toEqual(renderable(doc));
    expect(reply.lessons).toHaveLength(11);
    expect(reply.lessons.every((l) => l.pupilPdf && l.answersPdf && l.pupilDocx && l.answersDocx)).toBe(true);
    // Lesson Word links name the stored booklet and a lesson, so they stay short.
    expect(Math.max(...reply.lessons.map((l) => l.pupilDocx!.url.length))).toBeLessThan(600);
    const whole = await bookletWord(reply.downloads.pupilDocx.url);
    expect(whole.pages).toBe(reply.pages);
    const last = reply.lessons[10];
    const word = await bookletWord(last.answersDocx!.url);
    expect(word.disposition).toContain(encodeURIComponent("_Lesson 11"));
    expect(word.start).toBe(last.firstPage);
    expect(word.pages).toBe(reply.pages - last.firstPage + 1);

    // Other tools keep the 64 KiB limit.
    const big = structuredClone(treeDiagrams) as unknown as { document: { title: string } };
    big.document.title = "x".repeat(70 * 1024);
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "create_worksheet", arguments: { resource: big } } }),
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("64 KiB");
  }, 180_000);

  it("gives short links from a durable store and self-contained links without one", async () => {
    const durable = { ...memoryDocumentStore(), durable: true };
    const day = 86_400_000;
    let puts = 0;
    const counting = { ...durable, put: async (id: string, text: string, ttl: number) => (puts++, durable.put(id, text, ttl)) };
    const d = new WorksheetDownloads("http://127.0.0.1:1/", { test: key }, "test", counting);
    const pdf = new URL((await d.shortLink(treeDiagrams, "pdf", "pupil", 1_000_000)).url);
    const docx = new URL((await d.shortLink(treeDiagrams, "docx", "answers", 1_000_000)).url);
    expect(pdf.href.length).toBeLessThan(400);
    expect(puts).toBe(1);
    // A later request saves again, so a fresh 7-day link never outlives its 8-day stored copy.
    await d.shortLink(treeDiagrams, "pdf", "pupil", 1_000_000 + day);
    expect(puts).toBe(2);
    await expect(d.verify(pdf, 1_000_000)).resolves.toMatchObject({ format: "pdf", view: "pupil" });
    await expect(d.verify(docx, 1_000_000)).resolves.toMatchObject({ format: "docx", view: "answers" });
    const failing = { ...durable, put: async () => Promise.reject(Error("down")) };
    const fallback = new WorksheetDownloads("http://127.0.0.1:1/", { test: key }, "test", failing);
    const inline = new URL((await fallback.shortLink(treeDiagrams, "pdf", "pupil", 1_000_000)).url);
    expect(inline.href.length).toBeGreaterThan(400);
    await expect(fallback.verify(inline, 1_000_000)).resolves.toMatchObject({ format: "pdf" });
  });

  it("gives short booklet and lesson links from a durable store, saving the booklet once", async () => {
    const store = memoryDocumentStore();
    let puts = 0;
    const { client } = await start({ ...store, durable: true, put: (id: string, text: string, ttl: number) => (puts++, store.put(id, text, ttl)) });
    const r = await client.callTool({ name: "create_booklet", arguments: { booklet: a7Booklet } }, undefined, { timeout: 120_000 });
    expect(r.isError, JSON.stringify(r.content).slice(0, 400)).not.toBe(true);
    const reply = r.structuredContent as unknown as BookletReply;
    expect(puts).toBe(1);
    const all = [...Object.values(reply.downloads), ...reply.lessons.flatMap((l) => [l.pupilPdf, l.answersPdf, l.pupilDocx, l.answersDocx])] as { url: string }[];
    expect(all).toHaveLength(13);
    expect(Math.max(...all.map((l) => l.url.length))).toBeLessThan(600);
    const second = reply.lessons[1];
    const word = await bookletWord(second.pupilDocx!.url);
    expect(word.start).toBe(second.firstPage);
    const pdf = await PDFDocument.load(new Uint8Array(await (await fetch(second.answersPdf!.url)).arrayBuffer()));
    expect(pdf.getPageCount()).toBe(word.pages);
  }, 180_000);

  it("refuses a stored-document link that was tampered with or has gone", async () => {
    const store = memoryDocumentStore();
    const d = new WorksheetDownloads("http://127.0.0.1:1/", { test: key }, "test", store);
    const link = new URL((await d.storedLink(a7Booklet, "pdf", "pupil", 1_000_000)).url);
    await expect(d.verify(link, 1_000_000)).resolves.toMatchObject({ format: "pdf", view: "pupil" });
    const ref = JSON.parse(new TextDecoder().decode(inflateSync(Buffer.from(link.searchParams.get("token")!, "base64url")))).ref;
    await store.put(ref, JSON.stringify({ ...a7Booklet, document: { ...a7Booklet.document, title: "Changed" } }), 60);
    await expect(d.verify(link, 1_000_000)).rejects.toThrow(/token/);
    const empty = new WorksheetDownloads("http://127.0.0.1:1/", { test: key }, "test", memoryDocumentStore());
    await expect(empty.verify(link, 1_000_000)).rejects.toThrow(/no longer available/);
  });

  it("prints one lesson of a stored booklet, numbered as in the booklet, and saves the booklet once", async () => {
    const store = memoryDocumentStore();
    let puts = 0;
    const counting = { ...store, durable: store.durable, put: (id: string, text: string, ttl: number) => (puts++, store.put(id, text, ttl)) };
    const d = new WorksheetDownloads("http://127.0.0.1:1/", { test: key }, "test", counting);
    const link = new URL((await d.storedLink(a7Booklet, "docx", "answers", 1_000_000, 1)).url);
    await d.storedLink(a7Booklet, "pdf", "pupil", 1_000_000);
    expect(puts).toBe(1);
    const got = await d.verify(link, 1_000_000);
    expect(got).toMatchObject({ format: "docx", view: "answers", numbering: { lessonOffset: 1, pageOffset: renderBooklet(a7Booklet).lessonPages[1] - 2 } });
    expect((got.resource as typeof a7Booklet).document.lessons).toHaveLength(1);
    // A lesson the booklet does not have, or a lesson of the editable file, is refused.
    await expect(d.verify(new URL((await d.storedLink(a7Booklet, "docx", "pupil", 1_000_000, 5)).url), 1_000_000)).rejects.toThrow(/token/);
    await expect(d.verify(new URL((await d.storedLink(a7Booklet, "json", "pupil", 1_000_000, 0)).url), 1_000_000)).rejects.toThrow(/token/);
  });
});
