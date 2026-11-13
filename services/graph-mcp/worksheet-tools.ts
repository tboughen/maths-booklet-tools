import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { deflateSync, inflateSync } from "fflate";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import { DIAGRAM_KINDS } from "../../packages/diagram-core/src/registry";
import {
  A4,
  bookletFileName,
  bookletSchema,
  columnBoxes,
  fileName,
  isBooklet,
  issuePlace,
  LAYOUTS,
  lessonFileName,
  renderBooklet,
  renderResource,
  resourceSchema,
  singleLessonBooklet,
  SIZE,
  validate,
  validateBooklet,
  type Booklet,
  type Resource,
  type View,
} from "../../packages/resource-core/src/index";
import { GraphError } from "../../packages/graph-core/src/interchange";
import type { RasterQueue } from "./raster";
import type { TrafficLimits } from "./limits";
import { memoryDocumentStore, type DocumentStore } from "./document-store";

/** Word (docx) is made for worksheets only; booklets print as PDFs. */
export type WorksheetFormat = "pdf" | "docx" | "json";
/** A worksheet or a booklet: both travel through the same signed download links. */
export type PrintDocument = Resource | Booklet;
export interface Numbering {
  lessonOffset: number;
  pageOffset: number;
}
const validateDocument = (input: unknown): PrintDocument => (isBooklet(input) ? validateBooklet(input) : validate(input));
const MAX_LINK = 7500;
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PREVIEW_WIDTH = 1400;

const tokenSchema = z
  .object({
    v: z.literal(1),
    key: z.string().max(32),
    expires: z.number().int(),
    format: z.enum(["pdf", "docx", "json"]),
    view: z.enum(["pupil", "answers"]),
    // The document itself, or `ref`: the sha256 of a document kept in the document store.
    resource: z.unknown().optional(),
    ref: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    // A one-lesson booklet printed as that lesson of the full booklet (cover left out).
    numbering: z.object({ lessonOffset: z.number().int().min(0).max(11), pageOffset: z.number().int().min(0).max(500) }).strict().optional(),
  })
  .strict();

/**
 * Signed, stateless download links. The worksheet travels in the link, deflated; the signature
 * covers the compressed token and is checked before anything is decompressed.
 */
export class WorksheetDownloads {
  constructor(
    private base: string,
    private keys: Record<string, string>,
    private active: string,
    private store: DocumentStore = memoryDocumentStore(),
  ) {
    if (!Object.hasOwn(keys, active)) throw Error("Use a valid active worksheet signing key.");
  }
  get durableStore() {
    return this.store.durable;
  }
  private sign(token: string, key: string) {
    return createHmac("sha256", key).update("worksheet:" + token).digest("base64url");
  }
  /** A link for a document too large to carry: it is saved in the store and the link names its hash. */
  async storedLink(resource: PrintDocument, format: WorksheetFormat, view: View, now = Date.now()) {
    const ref = worksheetHash(resource).slice(7);
    // One write per document per call: a save under an hour old still has more than the 7-day
    // link lifetime left (documents are kept 8 days), so the links it signs cannot outlive it.
    const at = this.saved.get(ref);
    if (at === undefined || now - at > 3600_000 || now < at) {
      await this.store.put(ref, JSON.stringify(resource), 8 * 86400);
      this.saved.delete(ref);
      this.saved.set(ref, now);
      if (this.saved.size > 200) this.saved.delete(this.saved.keys().next().value as string);
    }
    return this.signed({ format, view, ref }, now);
  }
  private saved = new Map<string, number>();
  /**
   * A short link when the store survives restarts (the document is saved for 8 days and the link
   * names its hash), otherwise the document travels in the link. Short links are about 300
   * characters instead of 1,000 or more, so a chat can pass them on without breaking them.
   */
  async shortLink(resource: PrintDocument, format: WorksheetFormat, view: View, now = Date.now()) {
    if (this.store.durable) {
      try {
        return await this.storedLink(resource, format, view, now);
      } catch (error) {
        // The store is unavailable: fall back to a self-contained link, and say so in the log.
        console.warn(`Document store write failed; using a self-contained link. ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return this.link(resource, format, view, now);
  }
  link(resource: PrintDocument, format: WorksheetFormat, view: View, now = Date.now(), numbering?: Numbering) {
    return this.signed({ format, view, resource, ...(numbering ? { numbering } : {}) }, now);
  }
  private signed(body: { format: WorksheetFormat; view: View; resource?: PrintDocument; ref?: string; numbering?: Numbering }, now: number) {
    const expires = Math.floor(now / 1000) + 7 * 86400;
    const json = JSON.stringify({ v: 1, key: this.active, expires, ...body });
    const token = Buffer.from(deflateSync(new TextEncoder().encode(json), { level: 9 })).toString("base64url");
    const url = new URL("/worksheet/download", this.base);
    url.searchParams.set("token", token);
    url.searchParams.set("signature", this.sign(token, this.keys[this.active]));
    if (url.href.length > MAX_LINK) throw new GraphError("size_limit", "The worksheet link exceeds its limit; use the included file.");
    return { url: url.href, expiresAt: new Date(expires * 1000).toISOString() };
  }
  async verify(url: URL, now = Date.now()) {
    const token = url.searchParams.get("token") ?? "",
      signature = url.searchParams.get("signature") ?? "";
    if (token.length > MAX_LINK || !/^[-_A-Za-z0-9]+$/.test(token) || !/^[-_A-Za-z0-9]{43}$/.test(signature))
      throw new GraphError("invalid_download", "Invalid worksheet download.");
    // Any listed key may have signed it; the key id inside is only readable after inflating.
    const known = Object.values(this.keys).some((key) => timingSafeEqual(Buffer.from(signature), Buffer.from(this.sign(token, key))));
    if (!known) throw new GraphError("invalid_download", "Invalid worksheet signature.");
    let parsed: z.infer<typeof tokenSchema>;
    try {
      parsed = tokenSchema.parse(JSON.parse(new TextDecoder().decode(inflateSync(Buffer.from(token, "base64url")))));
    } catch {
      throw new GraphError("invalid_download", "Invalid worksheet token.");
    }
    if (!Object.hasOwn(this.keys, parsed.key)) throw new GraphError("invalid_download", "Invalid worksheet key.");
    if (parsed.expires * 1000 < now) throw new GraphError("expired_download", "The worksheet link has expired. Create the worksheet again.");
    if ((parsed.resource === undefined) === (parsed.ref === undefined)) throw new GraphError("invalid_download", "Invalid worksheet token.");
    let source = parsed.resource;
    if (parsed.ref) {
      const text = await this.store.get(parsed.ref);
      if (text === null)
        throw new GraphError("expired_download", "This file is no longer available (it expired or the service restarted). Create the booklet again.");
      try {
        source = JSON.parse(text);
      } catch {
        throw new GraphError("invalid_download", "Invalid worksheet token.");
      }
    }
    let resource: PrintDocument;
    try {
      resource = validateDocument(source);
    } catch {
      throw new GraphError("invalid_download", "Invalid worksheet token.");
    }
    // A stored document must still be exactly the one the link was signed for.
    if (parsed.ref && worksheetHash(resource).slice(7) !== parsed.ref) throw new GraphError("invalid_download", "Invalid worksheet token.");
    if (parsed.numbering && (!("lessons" in resource.document) || resource.document.lessons.length !== 1 || parsed.format !== "pdf"))
      throw new GraphError("invalid_download", "Invalid worksheet token.");
    if (parsed.format === "docx" && isBooklet(resource)) throw new GraphError("invalid_download", "Invalid worksheet token.");
    return { resource, format: parsed.format, view: parsed.view, numbering: parsed.numbering };
  }
}

const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
          .join(",")}}`
      : JSON.stringify(v);
export const worksheetHash = (r: PrintDocument) => "sha256:" + createHash("sha256").update(canonical(r)).digest("hex");

const link = z.object({ url: z.string().url(), expiresAt: z.string() }).strict();
const output = z
  .object({
    resource: resourceSchema,
    contentHash: z.string(),
    rendererVersion: z.literal("worksheet-a3-1"),
    printReady: z.boolean(),
    issues: z.array(
      z.object({ side: z.number(), column: z.number(), question: z.number().optional(), message: z.string() }).strict(),
    ),
    notes: z
      .array(z.object({ side: z.number(), column: z.number(), question: z.number().optional(), message: z.string() }).strict())
      .describe("Columns more than a third blank. The sheet is still print-ready; offer the teacher another question for each, and add it only if they agree."),
    files: z.object({ pupilPdf: z.string(), answersPdf: z.string(), pupilDocx: z.string(), answersDocx: z.string(), json: z.string() }).strict(),
    downloads: z
      .object({ pupilPdf: link.optional(), answersPdf: link.optional(), pupilDocx: link.optional(), answersDocx: link.optional(), json: link.optional() })
      .strict(),
    physicalSizeMm: z.object({ width: z.literal(420), height: z.literal(297) }).strict(),
    sides: z.literal(2),
  })
  .strict();

const BOOKLET_PREVIEWS = 4;
const BOOKLET_PREVIEW_WIDTH = 1000;
const bookletOutput = z
  .object({
    // The validated booklet, same shape as the input; not repeated as a schema to keep tools/list small.
    booklet: z.record(z.string(), z.unknown()).describe("The validated booklet, in the create_booklet input shape. Edit it and call create_booklet again to change the booklet."),
    contentHash: z.string(),
    rendererVersion: z.literal("booklet-a4-1"),
    printReady: z.boolean(),
    pages: z.number().int(),
    issues: z.array(
      z
        .object({ lesson: z.number(), section: z.number().optional(), question: z.number().optional(), page: z.number().optional(), message: z.string() })
        .strict(),
    ),
    files: z.object({ pupilPdf: z.string(), answersPdf: z.string(), json: z.string() }).strict(),
    downloads: z.object({ pupilPdf: link.optional(), answersPdf: link.optional(), json: link.optional() }).strict(),
    lessons: z.array(
      z.object({ lesson: z.number().int(), title: z.string(), firstPage: z.number().int(), pupilPdf: link.optional(), answersPdf: link.optional() }).strict(),
    ),
    physicalSizeMm: z.object({ width: z.literal(210), height: z.literal(297) }).strict(),
  })
  .strict();

const BOOKLET_LAYOUT = [
  "A4 portrait (210 x 297 mm), 12 mm margins. Cover with contents (made from the real layout), optional unit introduction page, then each lesson starting on a new page.",
  "Body text Inter 11 pt (nothing below 10 pt); cards never split; a section heading stays with its first row of cards and repeats with '(continued)' after a page break.",
  "Text never shrinks to fit. A card taller than a page, or a diagram too wide for its card, is returned as an issue naming lesson, section, question and page.",
  "Spare page height goes to working and drawing space (up to 40 mm extra each).",
];

const BOOKLET_DESCRIPTION =
  "PRODUCE an A4 portrait unit booklet (one lesson per objective) in the MathsDock house style from FINALISED lessons. " +
  "Supply booklet:{tool:'resource',schemaVersion:1,document:{kind:'booklet-a4',title,code,group?,coverNote?,nameLine?,intro:{remember[],learn[],next[],keywords:[{word,meaning}]}|null,lessons:[1-12 lessons, each {title,code,objective,keyIdea,teacherNotes?,sections:[{kind,title?,instruction?,columns:1|2,cards:[{title,items}]}]}]}}. " +
  "Section kinds: check-in, worked, practice, diagnostic, mistake, challenge, discover, notes; an empty title uses the kind's heading (Check in, Worked example, Your turn, Diagnostic questions, Spot the mistake, Challenge, Discover, Notes). " +
  "Recommended lesson shape: a one-sentence key idea naming the new words; check in (4-5 retrieval questions on this lesson's prerequisites); worked example with columns:2 as pairs, left the worked example with steps and saved answers, right 'Our turn' with the same steps left blank; Your turn (several near-identical questions with the same pre-drawn diagram or empty table); diagnostic multiple choice with choice mode letters (A-D, each wrong option one misconception); practice that fades; spot the mistake (a named pupil's wrong working); a challenge. " +
  "Cards use the same items as create_worksheet (text, info, claim, bullets, table, choice, steps, checklist, answerLine, space, diagram, part); worked and notes cards are not numbered, other cards are numbered within their section. Half-width cards (columns:2) are 90.5 mm wide, so a diagram there must fit about 84 mm. " +
  "Saved answers print only in the answers PDF; never invent answers the teacher did not give. " +
  "For a ratio or x → / y ↑ movement table (scaling, gradients, rates) use a ratio-table diagram rather than a plain table, so the curved scaling arrows show the method, in its compact form: {type:'diagram',diagram:{tool:'ratio-table',spec:{columns:['x →','y ↑'],table:[['2','4'],['1','[2]']],steps:['÷ 2']}}}. Cells: '4' printed, '' blank, '_' answer line, '[2]' hidden answer (answers PDF only); headings end in → ↑ or ↓ (y ↓ for negative gradients); steps '× 3' or '÷ 2', '[÷ 2]' hidden for pupils. " +
  "A whole unit (up to 12 lessons) goes in one call; requests may be up to 512 KiB, so send diagrams as specs rather than full envelopes. Returns previews of the cover and first lesson pages, whole-booklet pupil and answers PDF and editable JSON links (kept for 7 days), a pupil and answers PDF link for every lesson, contentHash and layout issues. When issues are returned no files are made: report them and revise. To change a booklet, edit the returned booklet and call create_booklet again.";

const LAYOUT = [
  "A3 landscape (420 x 297 mm), exactly two sides. Each side's layout is three (three columns, the default), two (two wide), wide-narrow, narrow-wide or one (full-width cards); each column has a titled stage heading, and a card with stage starts a new stage band within its column.",
  "Body text Inter 11 pt (nothing below 10 pt); cards never split; diagrams keep their native size.",
  "Text never shrinks to fit. Overflow is returned as issues naming side, column and the millimetres needed; fix by moving a card, trimming wording or reducing working space, then create again.",
  "Spare column height goes to working and drawing spaces. Set document.spareSpace 'share' on every new worksheet: a column with none then shares it as working room at the foot of every card. Without spareSpace (older saved sheets, kept as they are) the last card takes it all.",
  "A column more than a third blank is returned as a note (not an issue): the sheet is still print-ready, but offer the teacher another question for that column.",
  "side.score n prints 'Score ____ / n' in the header (one mark per answer). card.working and part.working store a hidden worked solution that is never printed.",
];

const DESCRIPTION =
  "PRODUCE a two-sided A3 landscape worksheet in the MathsDock house style from a FINALISED question set. " +
  "Supply resource:{tool:'resource',schemaVersion:1,document:{kind:'worksheet-a3',title,code,objective,group?,nameLine?,spareSpace:'share' (always on a new worksheet; leave a returned or saved sheet's value as it is),sides:[2 sides, each {instruction?,layout?,score?,columns:[1-3 columns to match layout, each {heading,cards:[{title,stage?,items,working?}]}]}]}}. " +
  "Cards are numbered automatically across both sides. Items: text, info (pale key-fact card), claim (a pupil's statement), bullets, table (cells with state supplied|blank|hidden), choice (circle|tick|letters options), steps (worked method lines), checklist (pupil tick boxes), answerLine {prefix,suffix,answer,inline}, space {kind:working|drawing,heightMm}, paper {style:squared|dotted|graph,widthMm,heightMm,axes?:{originMm:{x,y}}} (blank grid, optional unnumbered axes), diagram {diagram:{tool:<diagram kind>, envelope}} using the exact envelope a create_diagram call returned, or {tool, spec} with that family's create_diagram spec, and part {text,items} for lettered parts. Text markup is only **bold** and *italic*. " +
  "Saved answers (answerLine.answer, hidden cells, hidden diagram values) print only in the answers files (PDF and Word); never invent answers the teacher did not give. " +
  "Returns side previews, pupil and answers vector PDFs, pupil and answers Word files (.docx, A3, fonts embedded, same layout as the PDFs; editing the pupil .docx does not change the answers .docx or the JSON), editable JSON, contentHash, layout issues and notes. Give the teacher the returned PDF and Word links as links; do not try to download them yourself. A note names a column more than a third blank: the sheet is print-ready, but offer the teacher an extra question there and add it only if they agree. When issues are returned the sheet is not print-ready: report them and revise the document; do not claim it fits. To change a worksheet, edit the returned resource and call create_worksheet again.";

export function worksheetTools(raster: RasterQueue, downloads: WorksheetDownloads, limits: TrafficLimits) {
  async function artifacts(doc: PrintDocument, format: WorksheetFormat, view: View, signal?: AbortSignal, numbering?: Numbering) {
    if (isBooklet(doc)) return bookletArtifacts(doc as Booklet, format, view, signal, numbering);
    const resource = doc as Resource;
    if (format === "json")
      return { body: Buffer.from(JSON.stringify(resource, null, 2)), type: "application/json", name: fileName(resource, view).replace(/_A3\.pdf$/, ".json") };
    if (format === "docx") {
      const docx = await raster.worksheetDocx(resource, view, signal);
      return { body: Buffer.from(docx), type: DOCX_TYPE, name: fileName(resource, view).replace(/\.pdf$/, ".docx") };
    }
    const r = renderResource(resource, { view });
    const pdf = await raster.worksheetPdf(r.pages, resource.document.title, signal);
    return { body: Buffer.from(pdf), type: "application/pdf", name: fileName(resource, view) };
  }

  async function bookletArtifacts(booklet: Booklet, format: WorksheetFormat, view: View, signal?: AbortSignal, numbering?: Numbering) {
    if (format === "docx") throw new GraphError("unsupported", "Booklets print as PDFs; Word files are made for worksheets only.");
    if (format === "json")
      return { body: Buffer.from(JSON.stringify(booklet, null, 2)), type: "application/json", name: bookletFileName(booklet).replace(/_A4\.pdf$/, ".json") };
    const r = renderBooklet(booklet, { view, numbering });
    if (r.issues.length) throw new GraphError("layout", `The booklet does not fit its pages yet: ${issuePlace(r.issues[0])}: ${r.issues[0].message}`);
    // A one-lesson link prints only that lesson's pages, numbered as in the full booklet.
    const pages = numbering ? r.pages.slice(1) : r.pages;
    const pdf = await raster.worksheetPdf(pages, booklet.document.title, signal);
    return { body: Buffer.from(pdf), type: "application/pdf", name: numbering ? lessonFileName(booklet, numbering.lessonOffset, view) : bookletFileName(booklet, view) };
  }

  async function bookletResult(booklet: Booklet, signal: AbortSignal) {
    const pupil = renderBooklet(booklet, { view: "pupil" });
    const hash = worksheetHash(booklet);
    const doc = booklet.document;
    const printReady = pupil.issues.length === 0;
    const content: ContentBlock[] = [
      {
        type: "text",
        text: printReady
          ? `Booklet "${doc.title}" is ${pupil.pages.length} A4 pages with no layout issues.`
          : `Booklet "${doc.title}" is NOT print-ready: ${pupil.issues.length} layout issue(s). ${pupil.issues.map((i) => `${issuePlace(i)}: ${i.message}`).join(" ")}`,
      },
    ];
    // Previews: the cover and the first page of up to three lessons, to keep replies small.
    const shown = [1, ...pupil.lessonPages.slice(0, BOOKLET_PREVIEWS - 1)];
    const height = Math.round((BOOKLET_PREVIEW_WIDTH * A4.page.height) / A4.page.width);
    for (const pageNo of shown) {
      const svg = pupil.pages[pageNo - 1].replace(/width="210mm" height="297mm"/, `width="${BOOKLET_PREVIEW_WIDTH}" height="${height}"`);
      const png = await raster.worksheetPng(svg, BOOKLET_PREVIEW_WIDTH, height, signal);
      limits.output(png.byteLength);
      content.push({ type: "text", text: `Preview of page ${pageNo} (pupil view, screen resolution; print from the PDF).` });
      content.push({ type: "image", mimeType: "image/png", data: Buffer.from(png).toString("base64") });
    }
    const base = bookletFileName(booklet);
    const files = { pupilPdf: base, answersPdf: bookletFileName(booklet, "answers"), json: base.replace(/_A4\.pdf$/, ".json") };
    const links: z.infer<typeof bookletOutput>["downloads"] = {};
    const lessons: z.infer<typeof bookletOutput>["lessons"] = doc.lessons.map((l, i) => ({ lesson: i + 1, title: l.title, firstPage: pupil.lessonPages[i] }));
    let storeFailed = false;
    if (printReady) {
      const wanted = [
        ["pupilPdf", "pdf", "pupil"],
        ["answersPdf", "pdf", "answers"],
        ["json", "json", "pupil"],
      ] as const;
      for (const [slot, format, view] of wanted) {
        try {
          links[slot] = downloads.link(booklet, format, view);
        } catch (error) {
          if (!(error instanceof GraphError) || error.code !== "size_limit") throw error;
          // Too big to carry in a link (a whole unit usually is): keep it for a week and link to it.
          try {
            links[slot] = await downloads.storedLink(booklet, format, view);
          } catch {
            storeFailed = true;
          }
        }
      }
      // Each lesson on its own: small links that work even when the whole booklet is too big for one.
      doc.lessons.forEach((_, i) => {
        const one = singleLessonBooklet(booklet, i);
        for (const [slot, view] of [["pupilPdf", "pupil"], ["answersPdf", "answers"]] as const) {
          try {
            lessons[i][slot] = downloads.link(one.booklet, "pdf", view, Date.now(), one.numbering);
          } catch (error) {
            if (!(error instanceof GraphError) || error.code !== "size_limit") throw error;
          }
        }
      });
      if (storeFailed)
        content.push({ type: "text", text: "The whole-booklet files could not be saved just now, so only the lesson links below are available. Try create_booklet again in a minute for the whole-booklet files." });
      else if (!downloads.durableStore && Object.keys(links).length)
        content.push({ type: "text", text: "Note: this service is not keeping files across restarts, so the whole-booklet links stop working if it restarts; download them soon." });
      const unlinked = lessons.filter((l) => !l.pupilPdf).map((l) => l.lesson);
      if (unlinked.length)
        content.push({ type: "text", text: `Lesson ${unlinked.join(", ")} ${unlinked.length > 1 ? "are" : "is"} too large for a single-lesson link; print ${unlinked.length > 1 ? "them" : "it"} from the whole-booklet PDF (lesson pages are listed in lessons[].firstPage).` });
    }
    content.push({
      type: "text",
      text: printReady
        ? "Print the PDFs on A4 at 100% (actual size). Each lesson starts on a new page, so single lessons can be printed from the lesson links. The answers PDF shows saved answers in dark pink; keep it away from pupils. Keep the JSON to make changes later."
        : "No files were made because the booklet does not fit yet. Fix the issues above (move a card, trim wording or reduce working space; text is never shrunk) and call create_booklet again.",
    });
    return {
      structuredContent: {
        booklet,
        contentHash: hash,
        rendererVersion: "booklet-a4-1" as const,
        printReady,
        pages: pupil.pages.length,
        issues: pupil.issues,
        files,
        downloads: links,
        lessons,
        physicalSizeMm: { width: 210 as const, height: 297 as const },
      },
      content,
    };
  }

  async function result(resource: Resource, signal: AbortSignal) {
    const pupil = renderResource(resource, { view: "pupil" });
    const hash = worksheetHash(resource);
    const height = Math.round((PREVIEW_WIDTH * SIZE.page.height) / SIZE.page.width);
    const content: ContentBlock[] = [];
    const printReady = pupil.issues.length === 0;
    const notes = printReady ? pupil.notes : [];
    const advice = notes.length
      ? ` Space notes: ${notes.map((i) => i.message).join(" ")} Spare height is printed as working room; ask the teacher before adding questions.`
      : "";
    content.push({
      type: "text",
      text: printReady
        ? `Worksheet "${resource.document.title}" fits two A3 sides with no layout issues.${advice}`
        : `Worksheet "${resource.document.title}" is NOT print-ready: ${pupil.issues.length} layout issue(s). ${pupil.issues.map((i) => `Side ${i.side}, column ${i.column}${i.question ? `, question ${i.question}` : ""}: ${i.message}`).join(" ")}`,
    });
    for (const [i, svg] of pupil.pages.entries()) {
      const png = await raster.worksheetPng(svg.replace(/width="420mm" height="297mm"/, `width="${PREVIEW_WIDTH}" height="${height}"`), PREVIEW_WIDTH, height, signal);
      limits.output(png.byteLength);
      content.push({ type: "text", text: `Preview of side ${i + 1} (pupil view, screen resolution; print from the PDF).` });
      content.push({ type: "image", mimeType: "image/png", data: Buffer.from(png).toString("base64") });
    }
    const docxName = (view: View) => fileName(resource, view).replace(/\.pdf$/, ".docx");
    const files = {
      pupilPdf: fileName(resource, "pupil"),
      answersPdf: fileName(resource, "answers"),
      pupilDocx: docxName("pupil"),
      answersDocx: docxName("answers"),
      json: fileName(resource).replace(/_A3\.pdf$/, ".json"),
    };
    const links: z.infer<typeof output>["downloads"] = {};
    const wanted = [
      ["pupilPdf", "pdf", "pupil"],
      ["answersPdf", "pdf", "answers"],
      ["pupilDocx", "docx", "pupil"],
      ["answersDocx", "docx", "answers"],
      ["json", "json", "pupil"],
    ] as const;
    for (const [slot, format, view] of wanted) {
      try {
        links[slot] = await downloads.shortLink(resource, format, view);
      } catch (error) {
        if (!(error instanceof GraphError) || error.code !== "size_limit") throw error;
        const file = await artifacts(resource, format, view, signal);
        limits.output(file.body.length);
        content.push({
          type: "resource",
          resource: {
            uri: `worksheet://${hash.slice(7, 23)}/${encodeURIComponent(file.name)}`,
            mimeType: file.type,
            ...(format === "json" ? { text: file.body.toString("utf8") } : { blob: file.body.toString("base64") }),
          },
        });
      }
    }
    content.push({
      type: "text",
      text: "Give the teacher these download links exactly as returned; they open in a browser, so there is no need to download them yourself. Print the PDFs on A3 at 100% (actual size), double-sided, flipping on the short edge. The answers files show saved answers in dark pink; keep them away from pupils. The Word files open in desktop Word with the same layout, for small edits such as changing a number. Keep the JSON to make changes later.",
    });
    return {
      structuredContent: {
        resource,
        contentHash: hash,
        rendererVersion: "worksheet-a3-1" as const,
        printReady,
        issues: pupil.issues,
        notes,
        files,
        downloads: links,
        physicalSizeMm: { width: 420 as const, height: 297 as const },
        sides: 2 as const,
      },
      content,
    };
  }

  function register(server: McpServer, connection: AbortSignal) {
    const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
    server.registerTool(
      "worksheet_capabilities",
      {
        description: "Read the A3 worksheet and A4 booklet layouts, item types and limits before PRODUCE. Use with create_worksheet or create_booklet.",
        inputSchema: z.object({}).strict(),
        annotations,
      },
      async () => ({
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              rendererVersion: "worksheet-a3-1",
              kinds: ["worksheet-a3", "booklet-a4"],
              layout: LAYOUT,
              columnWidthsMm: Object.fromEntries(
                (Object.keys(LAYOUTS) as (keyof typeof LAYOUTS)[]).map((layout) => [layout, columnBoxes({ layout }).map((b) => Math.round(b.w * 10) / 10)]),
              ),
              limits: { sides: 2, columnsPerSide: 3, cardsPerColumn: 6, itemsPerCard: 16, itemsPerPart: 8, cardTitleChars: 60, headingChars: 40 },
              items: ["text", "info", "claim", "bullets", "table", "choice", "answerLine", "space", "diagram", "paper", "steps", "checklist", "part"],
              diagrams: { kinds: DIAGRAM_KINDS, source: "envelope returned by create_diagram, or spec as diagram_capabilities describes; diagrams print at their own size and are never shrunk" },
              cellStates: ["supplied", "blank", "hidden"],
              markup: "**bold** and *italic* only; no HTML",
              outputs: ["pupil PDF", "answers PDF", "pupil Word file (.docx)", "answers Word file (.docx)", "editable JSON", "side previews"],
              fileNames: "[code]_[objective]_A3.pdf and [code]_[objective]_Answers_A3.pdf, with the same names ending .docx for Word",
              booklet: {
                tool: "create_booklet",
                rendererVersion: "booklet-a4-1",
                layout: BOOKLET_LAYOUT,
                limits: { lessons: 12, sectionsPerLesson: 12, cardsPerSection: 16, keyIdeaChars: 500, keywords: 16 },
                sectionKinds: ["check-in", "worked", "practice", "diagnostic", "mistake", "challenge", "discover", "notes"],
                cardWidthsMm: { full: 186, half: 90.5 },
                fileNames: "[code]_[title]_Booklet_A4.pdf, [code]_[title]_Booklet_Answers_A4.pdf and [code]_[title]_Lesson N_A4.pdf",
              },
            }),
          },
        ],
      }),
    );
    server.registerTool(
      "create_worksheet",
      {
        description: DESCRIPTION,
        inputSchema: z.object({ resource: resourceSchema }).strict(),
        outputSchema: output,
        annotations,
      },
      async (args, extra) => {
        try {
          // spareSpace is never filled in here: a saved sheet sent back keeps its own layout.
          return await result(validate(args.resource), AbortSignal.any([connection, extra.signal]));
        } catch (e) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  code: e instanceof GraphError ? e.code : "invalid_worksheet",
                  message: e instanceof Error ? e.message : "The worksheet could not be made.",
                }),
              },
            ],
          };
        }
      },
    );
    server.registerTool(
      "create_booklet",
      {
        description: BOOKLET_DESCRIPTION,
        inputSchema: z.object({ booklet: bookletSchema }).strict(),
        outputSchema: bookletOutput,
        annotations,
      },
      async (args, extra) => {
        try {
          return await bookletResult(validateBooklet(args.booklet), AbortSignal.any([connection, extra.signal]));
        } catch (e) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  code: e instanceof GraphError ? e.code : "invalid_booklet",
                  message: e instanceof Error ? e.message : "The booklet could not be made.",
                }),
              },
            ],
          };
        }
      },
    );
  }
  return { register, artifacts };
}
