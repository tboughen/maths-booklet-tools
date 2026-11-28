import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { coverTagLines, lessonLabels, shortUkDate, validateBooklet, type Booklet } from "./booklet";
import { coverTag, renderBooklet, startBlockHeight, startTextWidth } from "./booklet-render";
import { writeBookletDocx } from "./booklet-docx";

// The cover booklet template (Tim, 27 November 2026): the check-in is the "Silent starter" numbered 1 to 8,
// and the start block's top right shows the class, room and date.

const q = (title: string) => ({ title, items: [{ type: "text", text: "Work it out." }] });
const section = (kind: string, cards: number, extra: Record<string, unknown> = {}) => ({ kind, columns: 2, cards: Array.from({ length: cards }, (_, i) => q(`Card ${i + 1}`)), ...extra });
const sections = [
  section("check-in", 8, { numbering: "restart", instruction: "Answer each question." }),
  section("worked", 2, { startBanner: "Stage 1" }),
  section("practice", 2, { endBanner: "End of stage 1", numbering: "restart" }),
];
const cover = { className: "10X2", room: "M4", date: "2026-11-27" };

function booklet(lesson: Record<string, unknown> = {}): Booklet {
  return validateBooklet({
    tool: "resource",
    schemaVersion: 1,
    document: { kind: "booklet-a4", title: "Cover lesson", lessonName: "Cover lesson", lessonNumbered: false, lessons: [{ title: "Area, angles and scale drawings", sections, ...lesson }] },
  });
}

describe("cover booklet template", () => {
  it("leaves cover out by default, so saved lessons are unchanged", () => {
    expect(booklet().document.lessons[0].cover).toBeUndefined();
  });

  it("checks the class, room and date", () => {
    expect(() => booklet({ cover: { ...cover, className: "" } })).toThrow();
    expect(() => booklet({ cover: { ...cover, room: "R".repeat(21) } })).toThrow();
    expect(() => booklet({ cover: { ...cover, date: "2026-02-30" } })).toThrow();
    expect(() => booklet({ cover: { ...cover, date: "27/11/2026" } })).toThrow();
    expect(() => booklet({ cover: { ...cover, extra: 1 } })).toThrow();
  });

  it("writes the date the UK way", () => {
    expect(shortUkDate("2026-11-27")).toBe("Fri 27 Nov");
    expect(coverTagLines(cover)).toEqual(["Class 10X2", "Room M4 · Fri 27 Nov"]);
  });

  it("numbers the silent starter 1 to 8 and restarts the stage questions", () => {
    expect(lessonLabels(booklet({ cover }).document.lessons[0])).toEqual([[1, 2, 3, 4, 5, 6, 7, 8], [null, null], [1, 2]]);
  });

  it("prints Silent starter banners and the class, room and date in the PDF pages", () => {
    const { pages, issues } = renderBooklet(booklet({ cover }));
    expect(issues).toEqual([]);
    const all = pages.join("");
    expect(all).toContain(">Silent starter<");
    expect(all).toContain(">End of silent starter<");
    expect(all).not.toContain(">Check in<");
    expect(pages[1]).toContain(">Class 10X2<");
    expect(pages[1]).toContain(">Room M4 · Fri 27 Nov<");
    const plain = renderBooklet(booklet()).pages.join("");
    expect(plain).toContain(">Check in<");
    expect(plain).not.toContain("Class 10X2");
  });

  it("puts a long room on its own line, never shrinking it, and flags names too long to fit", () => {
    const lab = booklet({ cover: { ...cover, room: "Science Lab 3", date: "2026-11-25" } });
    expect(coverTag(lab.document.lessons[0])).toEqual(["Class 10X2", "Room Science Lab 3", "Wed 25 Nov"]);
    expect(startTextWidth(lab.document.lessons[0])).toBeGreaterThan(60);
    expect(startBlockHeight(lab.document, lab.document.lessons[0])).toBeLessThan(startBlockHeight(booklet().document, booklet().document.lessons[0]) + 2);
    expect(renderBooklet(lab).issues).toEqual([]);
    const silly = booklet({ cover: { className: "W".repeat(20), room: "M4", date: "2026-11-27" } });
    expect(renderBooklet(silly).issues.map((i) => i.message)).toContain("The class or room name is too long to print beside the title. Shorten it.");
  });

  it("prints the same words in Word", async () => {
    const out = await writeBookletDocx(booklet({ cover }), { view: "answers", fonts: { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) }, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
    const files = unzipSync(out.bytes);
    const xml = Object.entries(files).filter(([k]) => k.startsWith("word/")).map(([, v]) => strFromU8(v)).join("");
    expect(xml).toContain("Silent starter");
    expect(xml).toContain("End of silent starter");
    expect(xml).toContain("Class 10X2");
    expect(xml).toContain("Room M4 · Fri 27 Nov");
    expect(xml).not.toContain(">End of check in<");
  });
});
