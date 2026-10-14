import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { verifyCatalogue } from "../bank/model";
import { withPerformance } from "../bank/performance";
import { exportClass } from "./export";
import { generateClass } from "./select";
import { paperMappings, questionLabel } from "./import";
import { defaults } from "./types";
import { layoutPack } from "./layout";

const bank = withPerformance(verifyCatalogue(JSON.parse(await readFile("public/bank/catalogue.json", "utf8"))));
const items = paperMappings(bank, "1MA1_NOV_2019_1H");
const pupils = [0, 1, null].map((score, i) => ({ key: `row${i}`, identifier: `S00${i + 1}`, profile: {}, scores: Object.fromEntries(items.map(item => [questionLabel(item.label), score])) }));
beforeEach(() => {
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, arrayBuffer: async () => new Uint8Array(await readFile("public/" + url.replace(/^\//, ""))).buffer })));
});
afterEach(() => vi.unstubAllGlobals());
describe("actual class PDF", () => {
  it.each([1, 2, 4, 8] as const)("exports exactly %i A4 pages per pupil with complete inverted answers", async pageLimit => {
    const settings = { ...defaults, pageLimit }, plan = generateClass(bank, items, pupils, settings);
    const blob = await exportClass(plan, settings, bank.version, () => undefined), bytes = new Uint8Array(await blob.arrayBuffer()), doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(pageLimit * pupils.length);
    expect(doc.getPages().every(p => Math.abs(p.getWidth() - 595.276) < .01 && Math.abs(p.getHeight() - 841.89) < .01)).toBe(true);
    expect(doc.catalog.getOrCreateViewerPreferences().getPrintScaling()).toBe("None");
    const streams = doc.getPages().flatMap(page => {
      const contents = page.node.Contents() as PDFArray;
      return Array.from({ length: contents.size() }, (_, i) => new TextDecoder().decode(decodePDFRawStream(contents.lookup(i, PDFRawStream)).decode()));
    }).join("\n");
    expect(streams).toMatch(/-1 .*cm/);
    expect(plan.packs.every(p => layoutPack(p.entries, pageLimit).valid)).toBe(true);
    await mkdir("coverage/assessment", { recursive: true });
    await writeFile(`coverage/assessment/class-${pageLimit}-pages.pdf`, bytes);
    await writeFile(`coverage/assessment/class-${pageLimit}-pages.json`, JSON.stringify(plan, null, 2));
  });
  it("does not return a partial class PDF when an asset fails or a generation is cancelled", async () => {
    const plan = generateClass(bank, items, pupils, defaults), controller = new AbortController(); controller.abort();
    await expect(exportClass(plan, defaults, bank.version, () => undefined, controller.signal)).rejects.toThrow(/cancelled/);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    await expect(exportClass(plan, defaults, bank.version, () => undefined)).rejects.toThrow(/No incomplete/);
  });
  it("keeps thirty pupil printing blocks separate without duplicating common artwork thirty times", async () => {
    const thirty = Array.from({ length: 30 }, (_, i) => ({ ...pupils[0], key: `row-${i}`, identifier: `S${String(i + 1).padStart(3, "0")}` }));
    const settings = { ...defaults, common: true }, plan = generateClass(bank, items, thirty, settings);
    const blob = await exportClass(plan, settings, bank.version, () => undefined);
    const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
    expect(doc.getPageCount()).toBe(120); expect(blob.size).toBeLessThan(15_000_000);
    await writeFile("coverage/assessment/class-30-pupils.pdf", new Uint8Array(await blob.arrayBuffer()));
  });
});
