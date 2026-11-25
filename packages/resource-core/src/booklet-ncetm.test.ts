import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { validateBooklet, type Booklet } from "./booklet";
import { headingLineRoom, planBooklet, renderBooklet } from "./booklet-render";
import { writeBookletDocx } from "./booklet-docx";

// NCETM links (Tim, 25 November 2026): one to three optional links a lesson, as a small chip at the
// right-hand end of a stage's first heading or the Challenge heading, clickable in the teacher's
// answers copy (PDF and Word) and absent from the pupil copy. Links only; nothing moves.

const q = (title: string) => ({ title, items: [{ type: "text", text: "Work it out." }] });
const STAIRS = { label: "Checkpoint 10: Staircases (slide 31)", url: "https://www.ncetm.org.uk/media/dsab43rx/y8_checkpoints_3_graphical_representations_of_linear_relationships.pptx" };
const PAGE9 = { label: "Gradient as a rate of change (page 9)", url: "https://www.ncetm.org.uk/media/s05nyur0/ncetm_ks3_cc_4_2.pdf#page=9" };

function booklet(sections: unknown[]): Booklet {
  return validateBooklet({
    tool: "resource",
    schemaVersion: 1,
    document: { kind: "booklet-a4", title: "Visualising", code: "A7", lessons: [{ title: "Find the gradient of a straight line (positive)", code: "A7.03", sections }] },
  });
}
const lesson = (links: Record<string, unknown>[]) =>
  booklet([
    { kind: "worked", title: "Whole-number gradients", columns: 2, startBanner: "Stage 1", cards: [q("Worked example"), q("Our turn")], ...(links[0] ? { ncetm: links[0] } : {}) },
    { kind: "challenge", instruction: "Show your working.", columns: 2, cards: [q("Challenge A"), q("Challenge B")], ...(links[1] ? { ncetm: links[1] } : {}) },
  ]);
const docx = async (b: Booklet, view: "pupil" | "answers") => {
  const { bytes } = await writeBookletDocx(b, { view, fonts: { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) }, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
  const files = unzipSync(bytes);
  return { body: strFromU8(files["word/document.xml"]), rels: strFromU8(files["word/_rels/document.xml.rels"]) };
};

describe("NCETM links", () => {
  it("prints a clickable chip in the answers copy only", () => {
    const b = lesson([STAIRS, PAGE9]);
    const answers = renderBooklet(b, { view: "answers" });
    const svg = answers.pages.join("");
    expect(svg).toContain(`<a href="${STAIRS.url}">`);
    expect(svg).toContain(`<a href="${PAGE9.url}">`);
    expect(svg).toContain("Staircases (slide 31)");
    expect(answers.issues.filter((i) => /NCETM/.test(i.message))).toEqual([]);
    const pupil = renderBooklet(b, { view: "pupil" }).pages.join("");
    expect(pupil).not.toContain("ncetm.org.uk");
    expect(pupil).not.toContain("NCETM");
  });

  it("never moves the page layout", () => {
    const plain = planBooklet(lesson([]));
    const linked = planBooklet(lesson([STAIRS, PAGE9]), { view: "answers" });
    expect(linked.pages.map((p) => p.blocks.map((x) => [x.kind, x.y, x.h]))).toEqual(plain.pages.map((p) => p.blocks.map((x) => [x.kind, x.y, x.h])));
  });

  it("writes real Word hyperlinks in the answers copy and none in the pupil copy", async () => {
    const b = lesson([STAIRS, PAGE9]);
    const a = await docx(b, "answers");
    expect(a.body.match(/<w:hyperlink r:id="rIdLink\d"/g)).toHaveLength(2);
    expect(a.rels).toContain(`Target="${STAIRS.url}" TargetMode="External"`);
    expect(a.rels).toContain(`Target="${PAGE9.url.replace("&", "&amp;")}" TargetMode="External"`);
    const p = await docx(b, "pupil");
    expect(p.body).not.toContain("w:hyperlink");
    expect(p.rels).not.toContain("ncetm");
  });

  it("accepts only NCETM addresses", () => {
    expect(() => lesson([{ label: "Elsewhere", url: "https://example.com/x" }])).toThrow(/ncetm\.org\.uk/);
    expect(() => lesson([{ label: "Plain", url: "http://www.ncetm.org.uk/x" }])).toThrow();
  });

  it("warns when a lesson has more than three links", () => {
    const many = booklet(
      Array.from({ length: 4 }, (_, i) => ({ kind: "practice", title: `Part ${i + 1}`, columns: 2, cards: [q("A"), q("B")], ncetm: STAIRS })),
    );
    expect(renderBooklet(many, { view: "answers" }).issues.some((i) => /4 NCETM links/.test(i.message))).toBe(true);
  });

  it("drops a chip that cannot fit beside a long heading line and says so", () => {
    // The longest instruction that still prints beside the heading leaves too little room for a chip.
    const make = (ins: string) => booklet([{ kind: "practice", title: "Practice", instruction: ins, columns: 2, cards: [q("A"), q("B")], ncetm: STAIRS }]);
    let ins = "Show";
    while (headingLineRoom(make(ins + " more").document.lessons[0].sections[0]) > 10) ins += " more";
    expect(headingLineRoom(make(ins).document.lessons[0].sections[0])).toBeGreaterThan(0);
    const b = make(ins);
    const r = renderBooklet(b, { view: "answers" });
    expect(r.pages.join("")).not.toContain("<a href");
    expect(r.issues.some((i) => /no room for the NCETM link/.test(i.message))).toBe(true);
  });

  it("rejects addresses that are not written in full", () => {
    expect(() => lesson([{ label: "Odd", url: "https://www.ncetm.org.uk/a b" }])).toThrow();
    expect(() => lesson([{ label: "Host", url: "https://www.ncetm.org.uk.evil.com/x" }])).toThrow();
  });
});
