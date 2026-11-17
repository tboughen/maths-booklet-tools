import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { validateBooklet, type Booklet } from "./booklet";
import { A4, BANNER, planBooklet, renderBooklet } from "./booklet-render";
import { writeBookletDocx } from "./booklet-docx";

// Keeping pupils on the right page (Tim, 17 November 2026, after teaching A7.03 and SP8.04):
// a bold, larger, centred page number and nothing else in the footer; navy START and STOP banners
// at the start and end of each teaching cycle, and each cycle opens a new page.

const q = (title: string) => ({ title, items: [{ type: "text", text: "Work it out." }] });
const section = (kind: string, cards: number, extra: Record<string, unknown> = {}) => ({ kind, columns: 2, cards: Array.from({ length: cards }, (_, i) => q(`Card ${i + 1}`)), ...extra });

function booklet(sections: unknown[]): Booklet {
  return validateBooklet({
    tool: "resource",
    schemaVersion: 1,
    document: { kind: "booklet-a4", title: "Presentation of data", code: "SP8", lessons: [{ title: "Construct and interpret frequency polygons", code: "SP8.04", keyIdea: "", sections }] },
  });
}

const cycles = [
  section("check-in", 2, { numbering: "letters" }),
  section("worked", 2, { startBanner: "Part 1" }),
  section("diagnostic", 2, { endBanner: "End of part 1" }),
  section("worked", 2, { startBanner: "Part 2" }),
  section("diagnostic", 2, { endBanner: "End of part 2" }),
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
    // A start banner is the first thing under the running header; an end banner follows the last row.
    for (const p of plan.pages.slice(1)) {
      expect(p.blocks[0].kind).toBe("banner");
      const last = p.blocks[p.blocks.length - 1];
      expect(last.kind).toBe("banner");
      expect(last.y + last.h).toBeLessThanOrEqual(A4.bottom);
    }
    const svg = renderBooklet(b).pages.join("");
    expect(svg.match(/>START</g)).toHaveLength(2);
    expect(svg.match(/>STOP</g)).toHaveLength(2);
    expect(svg).toContain("End of part 1");
    expect(BANNER.h).toBeGreaterThan(0);
  });

  it("prints the same banners and footer in Word", async () => {
    const { bytes } = await writeBookletDocx(booklet(cycles), { view: "pupil", fonts: { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) }, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
    const files = unzipSync(bytes);
    const body = strFromU8(files["word/document.xml"]);
    expect(body.match(/>START</g)).toHaveLength(2);
    expect(body.match(/>STOP</g)).toHaveLength(2);
    const footer = strFromU8(files["word/footer1.xml"]);
    expect(footer).toContain(`w:jc w:val="center"`);
    expect(footer).not.toContain("Presentation of data");
  });
});
