import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { comparativeBarCharts, treeDiagrams } from "./fixtures";
import { obfuscateFont, writeWorksheetDocx, WORD_FOOT_MM, type DocxOptions } from "./docx";
import { renderResource, styles, validate, type Resource } from "./index";
import { wordSample } from "./word-sample";
import { layoutSample } from "./layout-sample";

// Stand-ins: the real fonts and picture maker live in the service (services/graph-mcp/worksheet-docx.ts).
const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
const options = (view: "pupil" | "answers" = "pupil"): DocxOptions => ({
  view,
  fonts: { regular: font(1), semiBold: font(2), italic: font(3) },
  picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }),
});
async function open(doc: Resource, view: "pupil" | "answers" = "pupil") {
  const { bytes, issues } = await writeWorksheetDocx(doc, options(view));
  const files = unzipSync(bytes);
  const text = (name: string) => strFromU8(files[name]);
  return { bytes, issues, files, text, document: text("word/document.xml") };
}
const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

describe("Word output for worksheets", () => {
  const sheets: [string, Resource][] = [
    ["comparative bar charts", comparativeBarCharts],
    ["tree diagrams", treeDiagrams],
    ["the Word rendering test", wordSample],
    ["the layout test", layoutSample],
    ["tree diagrams sharing spare space", { ...treeDiagrams, document: { ...treeDiagrams.document, spareSpace: "share" } }],
  ];

  for (const [name, doc] of sheets) {
    it(`writes a well-formed Word package for ${name} with the same layout checks as the PDF`, async () => {
      for (const view of ["pupil", "answers"] as const) {
        const { files, text, issues } = await open(doc, view);
        for (const part of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/settings.xml", "word/fontTable.xml", "word/_rels/document.xml.rels", "word/_rels/fontTable.xml.rels", "docProps/core.xml"])
          expect(files[part], part).toBeDefined();
        for (const xml of Object.keys(files).filter((f) => f.endsWith(".xml") || f.endsWith(".rels")))
          expect(parse(text(xml)).getElementsByTagName("parsererror"), xml).toHaveLength(0);
        expect(issues).toEqual(renderResource(doc, { view }).issues);
        expect(issues).toEqual([]);
        // Every picture the document uses is in the package, as PNG and SVG.
        const rels = text("word/_rels/document.xml.rels");
        for (const id of text("word/document.xml").match(/r:embed="[^"]+"/g) ?? []) expect(rels).toContain(`Id="${id.slice(9, -1)}"`);
      }
    });
  }

  it("keeps saved answers out of the pupil copy and prints them in the answers copy", async () => {
    const colour = styles.mathsdock.answer.slice(1).toUpperCase();
    for (const doc of [comparativeBarCharts, treeDiagrams, wordSample]) {
      expect((await open(doc)).document).not.toContain(colour);
      expect((await open(doc, "answers")).document).toContain(colour);
    }
    expect((await open(treeDiagrams)).document).not.toContain("HHH, HHT");
    expect((await open(treeDiagrams, "answers")).document).toContain("HHH, HHT");
  });

  it("sets two A3 landscape sides of fixed tables with pinned card heights", async () => {
    const { document } = await open(comparativeBarCharts);
    const xml = parse(document);
    // One section, whose settings are the body's last child: a paragraph-level sectPr would make
    // Word add a default-size page at the end (found in real Word, 11 November 2026).
    const sections = [...xml.getElementsByTagNameNS(W, "sectPr")];
    expect(sections).toHaveLength(1);
    expect((sections[0].parentNode as Element | null)?.localName).toBe("body");
    expect(sections[0].nextSibling).toBeNull();
    const size = xml.getElementsByTagNameNS(W, "pgSz")[0];
    expect([size.getAttribute("w:w"), size.getAttribute("w:h"), size.getAttribute("w:orient")]).toEqual(["23811", "16838", "landscape"]);
    // The bottom margin gives back WORD_FOOT_MM so a fractionally taller card stays on its side.
    expect(xml.getElementsByTagNameNS(W, "pgMar")[0].getAttribute("w:bottom")).toBe(String(Math.round(((8 - WORD_FOOT_MM) * 1440) / 25.4)));
    expect(document.match(/<w:br w:type="page"\/>/g)).toHaveLength(1);
    const tables = [...xml.getElementsByTagNameNS(W, "tbl")];
    expect(tables.every((t) => t.getElementsByTagNameNS(W, "tblLayout")[0]?.getAttribute("w:type") === "fixed")).toBe(true);
    // Twelve question cards, each a bordered one-cell table with a minimum height.
    expect(document.match(/<w:top w:val="single" w:sz="10"/g)).toHaveLength(12);
    expect(document.match(/w:hRule="atLeast"/g)!.length).toBeGreaterThanOrEqual(12);
    // No paragraph uses automatic line spacing except pictures.
    const auto = document.match(/w:lineRule="auto"/g)?.length ?? 0;
    expect(auto).toBe((document.match(/<w:drawing>/g) ?? []).length);
  });

  it("sizes cards and answer rows as real Word draws them", async () => {
    const xml = parse((await open(layoutSample)).document);
    const mm = (v: string | null) => (Number(v) * 25.4) / 1440;
    const cards = [...xml.getElementsByTagNameNS(W, "tc")].filter((c) => c.getElementsByTagNameNS(W, "top")[0]?.getAttribute("w:sz") === "10");
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      // One border narrower than its column, so Word's right border is not cut off by the column.
      const column = c.parentNode!.parentNode!.parentNode as Element;
      expect(column.localName).toBe("tc");
      const width = mm(c.getElementsByTagNameNS(W, "tcW")[0].getAttribute("w:w"));
      const colW = mm(column.getElementsByTagNameNS(W, "tcW")[0].getAttribute("w:w"));
      expect(colW - width).toBeCloseTo(0.45, 1);
      // The card's last paragraph never directly follows a nested table: Word drops that one.
      const kids = [...c.childNodes].filter((k): k is Element => k.nodeType === 1);
      expect(kids.at(-1)!.localName).toBe("p");
      expect(kids.at(-2)!.localName).toBe("p");
    }
    // Each answer line: an exact writing row with the line as its bottom border, then the space below.
    const lines = [...xml.getElementsByTagNameNS(W, "tc")].filter((c) => c.getElementsByTagNameNS(W, "bottom")[0]?.getAttribute("w:sz") === "7" && c.getElementsByTagNameNS(W, "vAlign").length);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      const tr = l.parentNode as Element;
      const next = tr.nextSibling as Element;
      const h = (r: Element) => mm(r.getElementsByTagNameNS(W, "trHeight")[0].getAttribute("w:val"));
      expect(h(tr) + h(next)).toBeCloseTo(9 - 0.08, 1);
      expect(l.getElementsByTagNameNS(W, "tcMar")[0]?.getElementsByTagNameNS(W, "bottom")[0]?.getAttribute("w:w") ?? "0").toBe("0");
    }
  });

  it("embeds Inter, obfuscated with a stable key, and marks the fonts for embedding", async () => {
    const a = await open(comparativeBarCharts);
    const table = a.text("word/fontTable.xml");
    expect(table).toMatch(/<w:font w:name="Inter">.*<w:embedRegular r:id="rIdFont1" w:fontKey="\{[0-9A-F-]{36}\}"\/><w:embedItalic/);
    expect(table).toContain('<w:font w:name="Inter SemiBold">');
    expect(a.text("word/settings.xml")).toContain("<w:embedTrueTypeFonts/>");
    const key = table.match(/w:fontKey="([^"]+)"/)![1];
    expect(obfuscateFont(a.files["word/fonts/font1.odttf"], key)).toEqual(font(1));
    expect(a.files["word/fonts/font1.odttf"].slice(32)).toEqual(font(1).slice(32));
    // The same worksheet always makes the same file.
    expect((await open(comparativeBarCharts)).bytes).toEqual(a.bytes);
  });

  it("writes stacked fractions as native Word equations only when the sheet uses maths notation", async () => {
    const { document } = await open(wordSample);
    expect(document).toContain("<m:f><m:num>");
    expect(document.match(/<m:f>/g)!.length).toBeGreaterThan(15);
    expect(document).not.toContain("{3/4}");
    const plain = validate({ ...structuredClone(wordSample), document: { ...wordSample.document, notation: "plain" } });
    const p = await open(plain);
    expect(p.document).not.toContain("<m:f>");
    expect(p.document).toContain("{3/4}");
  });

  it("names its properties and keeps the version given", async () => {
    const { bytes } = await writeWorksheetDocx(treeDiagrams, { ...options("answers"), version: "test 1" });
    const core = strFromU8(unzipSync(bytes)["docProps/core.xml"]);
    expect(core).toContain("<dc:title>List outcomes of combined events using a tree diagram (answers)</dc:title>");
    expect(core).toContain("<cp:version>test 1</cp:version>");
  });
});

describe("stacked fractions in the SVG pages", () => {
  it("draws {a/b} stacked and keeps plain sheets unchanged", () => {
    const svg = renderResource(wordSample).pages.join("");
    expect(svg).toContain('data-fraction="stacked"');
    expect(svg).not.toContain("{3/4}");
    const plain = validate({ ...structuredClone(wordSample), document: { ...wordSample.document, notation: "plain" } });
    expect(renderResource(plain).pages.join("")).not.toContain("data-fraction");
  });

  it("reports a brace that is not a fraction", () => {
    const doc = structuredClone(wordSample);
    doc.document.sides[0].columns[0].cards[0].items.unshift({ type: "text", text: "Gradient {1/2} and {oops}" });
    expect(renderResource(doc).issues.some((i) => /brace is not part of a fraction/.test(i.message))).toBe(true);
  });

  it("reports a saved answer longer than its answer line", () => {
    const doc = structuredClone(treeDiagrams);
    doc.document.sides[1].columns[2].cards[1].items[2] = {
      type: "part",
      text: "List every possible outcome.",
      items: [{ type: "answerLine", prefix: "", suffix: "", answer: "HHH, HHT, HTH, HTT, THH, THT, TTH, TTT", inline: false }],
    };
    expect(renderResource(doc).issues.some((i) => /saved answer is [\d.]+ mm wider than its answer line/.test(i.message))).toBe(true);
  });
});

describe("Word answer canary", () => {
  // Answer canary for the Word files (gate 7 does the same for diagram artwork): plant a sentinel in
  // one hidden slot at a time and look for it in every part of the pupil package and in every
  // picture handed to the picture maker. A control shows the same slot, so a slot only counts when
  // the writer would have printed it. Hidden working must not print in either file.
  it("keeps every hidden slot out of every part of the pupil file", async () => {
    type Json = Record<string, unknown>;
    type Slot = { path: (string | number)[]; hide: (o: Json, s: string) => void; show?: (o: Json, s: string) => void; kind: string };
    const SENTINELS = ["Qzx7canary", "917"];
    const diagramRules: Omit<Slot, "path">[] = [
      { kind: "diagram value", hide: (o, s) => { o.value = s; o.hidden = true; }, show: (o, s) => { o.value = s; o.hidden = false; } },
      { kind: "diagram answer", hide: (o, s) => { o.answer = s; o.answerVisible = false; }, show: (o, s) => { o.answer = s; o.answerVisible = true; } },
      { kind: "diagram label", hide: (o, s) => { o.text = s; o.show = "hidden"; }, show: (o, s) => { o.text = s; o.show = "show"; } },
      { kind: "diagram label", hide: (o, s) => { o.text = s; o.visibility = "hidden"; }, show: (o, s) => { o.text = s; o.visibility = "show"; } },
      { kind: "diagram label", hide: (o, s) => { o.text = s; o.state = "hidden"; }, show: (o, s) => { o.text = s; o.state = "value"; } },
    ];
    const matches = (o: Json, kind: number) =>
      [
        typeof o.hidden === "boolean" && "value" in o,
        typeof o.answerVisible === "boolean" && typeof o.answer === "string",
        typeof o.show === "string" && typeof o.text === "string",
        typeof o.visibility === "string" && typeof o.text === "string",
        typeof o.state === "string" && typeof o.text === "string",
      ][kind];
    function slots(value: unknown, path: (string | number)[] = [], inDiagram = false): Slot[] {
      if (!value || typeof value !== "object") return [];
      const o = value as Json, found: Slot[] = [];
      if (!Array.isArray(value)) {
        if (inDiagram) diagramRules.forEach((r, i) => matches(o, i) && found.push({ ...r, path }));
        else if (o.type === "answerLine") found.push({ kind: "answer line", path, hide: (n, s) => { n.answer = s; } });
        else if (Array.isArray(o.rows) && o.type === "table")
          (o.rows as Json[][]).forEach((row, r) => row.forEach((_, c) =>
            found.push({ kind: "table cell", path: [...path, "rows", r, c], hide: (n, s) => { n.text = s; n.state = "hidden"; }, show: (n, s) => { n.text = s; n.state = "supplied"; } })));
        if (!inDiagram && Array.isArray(o.items) && (typeof o.title === "string" || o.type === "part"))
          found.push({ kind: "working", path, hide: (n, s) => { n.working = s; } });
      }
      for (const [k, v] of Object.entries(o)) {
        if (!inDiagram && k === "rows" && o.type === "table") continue;
        found.push(...slots(v, [...path, Array.isArray(value) ? Number(k) : k], inDiagram || k === "envelope"));
      }
      return found;
    }
    const planted = (doc: Resource, slot: Slot, how: "hide" | "show", s: string) => {
      const copy = structuredClone(doc) as unknown as Json;
      let node: unknown = copy;
      for (const key of slot.path) node = (node as Json)[key as string];
      (how === "hide" ? slot.hide : slot.show!)(node as Json, s);
      return copy;
    };
    /** Every package part as text, plus the drawn text of each picture the writer asked for. */
    async function everything(raw: unknown, view: "pupil" | "answers") {
      let doc: Resource;
      try { doc = validate(raw); } catch { return null; }
      const pictures: string[] = [];
      const { bytes } = await writeWorksheetDocx(doc, { ...options(view), picture: (svg) => (pictures.push(svg), { svg, png: new Uint8Array([137, 80, 78, 71]) }) });
      const parts = Object.values(unzipSync(bytes)).map((b) => Buffer.from(b).toString("latin1"));
      return [...parts, ...pictures.map((svg) => [...svg.matchAll(/>([^<]*)</g)].map((m) => m[1]).join(" "))].join("\n");
    }
    const checked: Record<string, number> = {}, leaks: string[] = [];
    for (const [name, doc] of [["comparative bar charts", comparativeBarCharts], ["tree diagrams", treeDiagrams], ["Word test", wordSample], ["layout test", layoutSample]] as const) {
      for (const slot of slots(doc)) {
        for (const s of SENTINELS) {
          const pupil = await everything(planted(doc, slot, "hide", s), "pupil");
          if (pupil === null) continue;
          if (slot.kind === "working") {
            const answers = await everything(planted(doc, slot, "hide", s), "answers");
            if (pupil.includes(s) || answers!.includes(s)) leaks.push(`${name} ${slot.path.join(".")} working`);
          } else {
            // The control: the same text where it should print (shown, or the answers file).
            const control = slot.show ? await everything(planted(doc, slot, "show", s), "pupil") : await everything(planted(doc, slot, "hide", s), "answers");
            if (!control?.includes(s)) continue;
            if (pupil.includes(s)) leaks.push(`${name} ${slot.path.join(".")} (${slot.kind})`);
          }
          checked[slot.kind] = (checked[slot.kind] ?? 0) + 1;
          break;
        }
      }
    }
    expect(leaks).toEqual([]);
    for (const kind of ["answer line", "table cell", "working", "diagram label"]) expect(checked[kind] ?? 0, JSON.stringify(checked)).toBeGreaterThan(0);
  }, 120_000);
});
