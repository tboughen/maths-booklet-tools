import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { validateBooklet, type Booklet } from "./booklet";
import { A4, BADGE_HEAD, BANNER, BOOKEND, cornerBadge, didYouKnowBox, planBooklet, renderBooklet, sectionStages, stageSquares, unitLabel } from "./booklet-render";
import { styles } from "./style";
import { writeBookletDocx } from "./booklet-docx";

// Keeping pupils on the right page (Tim, 17 November 2026, after teaching A7.03 and SP8.04):
// a bold, larger, centred page number and nothing else in the footer (with no rule above it, N11); navy START and STOP banners
// at the start and end of each teaching cycle, and each cycle opens a new page.

const q = (title: string) => ({ title, items: [{ type: "text", text: "Work it out." }] });
const section = (kind: string, cards: number, extra: Record<string, unknown> = {}) => ({ kind, columns: 2, cards: Array.from({ length: cards }, (_, i) => q(`Card ${i + 1}`)), ...extra });

function booklet(sections: unknown[], lesson: Record<string, unknown> = {}): Booklet {
  return validateBooklet({
    tool: "resource",
    schemaVersion: 1,
    document: { kind: "booklet-a4", title: "Presentation of data", code: "SP8", lessons: [{ title: "Construct and interpret frequency polygons", code: "SP8.04", keyIdea: "", sections, ...lesson }] },
  });
}

const cycles = [
  section("check-in", 2, { numbering: "letters" }),
  section("worked", 2, { startBanner: "Stage 1" }),
  section("diagnostic", 2, { endBanner: "End of stage 1" }),
  section("worked", 2, { startBanner: "Stage 2" }),
  section("diagnostic", 2, { endBanner: "End of stage 2" }),
];

describe("booklet page finding", () => {
  it("prints only the page number in the footer: bold, larger and centred", () => {
    const page = renderBooklet(booklet(cycles)).pages[1];
    expect(page).toContain(`text-anchor="middle"`);
    expect(page).toMatch(/font-weight="(600|700|bold)">Page 2</);
    expect(page).not.toContain("SP8 · Presentation of data");
    expect(A4.pageNumber).toBeGreaterThan(A4.small);
  });

  it("opens every cycle on a new page with a START banner and closes it with a STOP banner after its last card", () => {
    const b = booklet(cycles);
    const plan = planBooklet(b);
    const banners = plan.pages.flatMap((p, i) => p.blocks.filter((x) => x.kind === "banner").map((x) => ({ page: i, end: x.kind === "banner" && x.end, y: x.y })));
    expect(banners.map((x) => [x.page, x.end])).toEqual([
      [1, false],
      [1, true],
      [2, false],
      [2, true],
    ]);
    // A start banner is the first thing under the corner badge; an end banner follows the last row.
    for (const p of plan.pages.slice(1)) {
      expect(p.blocks[0].kind).toBe("banner");
      const last = p.blocks[p.blocks.length - 1];
      expect(last.kind).toBe("banner");
      expect(last.y + last.h).toBeLessThanOrEqual(A4.bottom);
    }
    const svg = renderBooklet(b).pages.join("");
    // Two stage banners each, and the lesson's own START (start block) and STOP (end band), N11.
    expect(svg.match(/>START</g)).toHaveLength(3);
    expect(svg.match(/>STOP</g)).toHaveLength(3);
    expect(svg).toContain("End of stage 1");
    expect(BANNER.h).toBeGreaterThan(0);
  });

  it("prints the same banners and footer in Word", async () => {
    const { bytes } = await writeBookletDocx(booklet(cycles), { view: "pupil", fonts: { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) }, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
    const files = unzipSync(bytes);
    const body = strFromU8(files["word/document.xml"]);
    // Two stage banners and the start block's START; the end band's STOP is in the last page's footer (N11).
    expect(body.match(/>START</g)).toHaveLength(3);
    expect(body.match(/>STOP</g)).toHaveLength(2);
    expect(strFromU8(files["word/footer-end1.xml"])).toContain(">STOP<");
    const footer = strFromU8(files["word/footer1.xml"]);
    expect(footer).toContain(`w:jc w:val="center"`);
    expect(footer).not.toContain("Presentation of data");
  });
});

// Lesson bookends, the lesson badge and stage squares (BOOKLET-STANDARD N11, Tim 18 November 2026).
describe("booklet lesson bookends", () => {
  const exam = section("practice", 2, { title: "Exam-style question and challenge" });
  const withExam = [...cycles, exam];

  it("opens a lesson with a start block naming the lesson, the unit, the title and START", () => {
    const page = renderBooklet(booklet(withExam)).pages[1];
    expect(page).toContain(">SP8<");
    expect(page).toContain(">Presentation<");
    expect(page).toContain(">Lesson<");
    expect(page).toContain(">START<");
    expect(page).not.toContain("Start of lesson");
    expect(unitLabel({ ...booklet(withExam).document, title: "SP7 Understanding risk", code: "SP7.06" })).toBe("SP7 Understanding risk");
  });

  it("closes a lesson with an end band in place of the last page's footer", () => {
    const pages = renderBooklet(booklet(withExam)).pages;
    const last = pages[pages.length - 1];
    expect(last).toContain(">End of lesson 1<");
    expect(last).toContain(">STOP<");
    expect(last).toContain(`>Page ${pages.length}<`);
    for (const p of pages.slice(1, -1)) expect(p).not.toContain("End of lesson");
  });

  it("shows one square per stage and C for the Challenge work after the last stage, lighting the page's stage", () => {
    const b = booklet(withExam);
    expect(stageSquares(b.document.lessons[0])).toEqual(["1", "2", "C"]);
    expect(stageSquares(booklet(cycles).document.lessons[0])).toEqual(["1", "2"]);
    expect(sectionStages(b.document.lessons[0])).toEqual([null, "1", "1", "2", "2", "C"]);
    const plan = planBooklet(b);
    expect(plan.pages[0].continued).toBe(false);
    const lit = plan.pages.slice(1).map((p) => p.stage);
    expect(lit[0]).toBe("1");
    expect(lit).toContain("2");
    expect(plan.pages.filter((p) => p.last)).toHaveLength(1);
  });

  it("adds C only for work after the last stage's own STOP, and shows no squares without stages", () => {
    const noStop = [section("check-in", 2), section("worked", 2, { startBanner: "Stage 1" }), section("diagnostic", 2, { endBanner: "End of stage 1" }), section("worked", 2, { startBanner: "Stage 2" }), exam];
    expect(stageSquares(booklet(noStop).document.lessons[0])).toEqual(["1", "2"]);
    expect(stageSquares(booklet([section("check-in", 2), exam]).document.lessons[0])).toEqual([]);
  });

  it("draws the Word corner badge with the stage squares, the page's stage lit", async () => {
    const { bytes } = await writeBookletDocx(booklet(withExam), { view: "pupil", fonts: { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) }, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
    const body = strFromU8(unzipSync(bytes)["word/document.xml"]);
    expect(body.match(/>Lesson</g)?.length).toBe(planBooklet(booklet(withExam)).pages.length);
    expect(body).toContain(">C<");
    expect(body).not.toContain(">E<");
    expect(body).toContain(`w:fill="${styles.mathsdock.navy.slice(1).toUpperCase()}"`);
  });

  it("puts the corner badge on the outer side: right on odd pages, left on even", () => {
    const right = cornerBadge(6, ["1", "2", "3", "C"], "2", 3, styles.mathsdock);
    const left = cornerBadge(6, ["1", "2", "3", "C"], "2", 4, styles.mathsdock);
    const badgeX = (svg: string) => Number(svg.match(/<rect x="([\d.]+)"/)?.[1]);
    expect(badgeX(right)).toBeCloseTo(A4.page.width - A4.marginX - BOOKEND.badgeW, 1);
    expect(badgeX(left)).toBeCloseTo(A4.marginX, 1);
    // Four squares, one lit navy; the badge sits clear of the content below it.
    expect(right.match(new RegExp(`width="${BOOKEND.square}"`, "g"))).toHaveLength(4);
    expect(BOOKEND.top + BOOKEND.badgeH).toBeLessThan(A4.top + BADGE_HEAD);
  });
});

// Did you know (BOOKLET-STANDARD N12, Tim 18 November 2026 12:22).
describe("booklet Did you know bubble", () => {
  const fact = "Doctors use frequency polygons to compare how fast children grow.";

  it("prints a small bubble on the lesson's first side only, under the start block", () => {
    const pages = renderBooklet(booklet(cycles, { didYouKnow: fact })).pages;
    // pages[0] is the cover; the lesson opens on pages[1].
    expect(pages[1]).toContain(">Did<");
    expect(pages[1]).toContain("Doctors use frequency polygons");
    for (const p of [pages[0], ...pages.slice(2)]) expect(p).not.toContain("Doctors use");
    expect(renderBooklet(booklet(cycles)).pages[1]).not.toContain(">Did<");
  });

  it("hugs a short fact and stays within the text width for a long one", () => {
    const short = didYouKnowBox("Bees use hexagons.");
    const long = didYouKnowBox("x ".repeat(78));
    expect(short.lines).toBe(1);
    expect(short.w).toBeLessThan(100);
    expect(long.w).toBeLessThanOrEqual(A4.page.width - 2 * A4.marginX + 1e-6);
  });

  it("costs page 1 only the bubble's height, and Word draws it too", async () => {
    const plain = planBooklet(booklet(cycles)).pages[0];
    const withFact = planBooklet(booklet(cycles, { didYouKnow: fact })).pages[0];
    const head = (p: typeof plain) => p.blocks.find((b) => b.kind === "head")?.h ?? 0;
    expect(head(withFact) - head(plain)).toBeCloseTo(2.5 + didYouKnowBox(fact).h, 3);
    const { bytes } = await writeBookletDocx(booklet(cycles, { didYouKnow: fact }), { view: "pupil", fonts: { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) }, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
    const body = strFromU8(unzipSync(bytes)["word/document.xml"]);
    expect(body).toContain("Did you know?");
    expect(body).toContain("Doctors use frequency polygons");
  });
});
