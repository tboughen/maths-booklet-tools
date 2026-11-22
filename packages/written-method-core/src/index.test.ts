import { describe, expect, it } from "vitest";
import * as wm from "./index";
import * as io from "./interchange";
import { examples } from "./examples";

const make = (method: wm.Method, numbers: string[], extra: Record<string, unknown> = {}) =>
  io.create({ spec: { method, numbers, ...extra } });
const done = (e: wm.Envelope, decimals = false) => wm.complete(e, true, decimals).envelope.document;

describe("written methods", () => {
  it("starts with pupil blanks and keeps blank, zero and hidden distinct", () => {
    const e = wm.create("add");
    expect(e.document.numbers.map((n) => n.value.text)).toEqual(["", ""]);
    expect(e.document.answer).toEqual({ text: "", show: "show" });
    expect(() => wm.setRow(e, "answer", { show: "hidden" })).toThrow(/blank/i);
    const zero = wm.setRow(e, "answer", { text: "0" });
    expect(zero.document.answer.text).toBe("0");
    const hidden = wm.setRow(make("add", ["12", "30"]), "answer", { text: "42", show: "hidden" });
    expect(wm.renderSvg(hidden)).not.toContain(">42<");
    expect(wm.renderSvg(wm.forView(hidden, "answer", true))).toContain(wm.ANSWER_COLOUR);
  });

  it("never works anything out until asked", () => {
    const e = make("add", ["4758", "2696"]);
    expect(e.document.answer.text).toBe("");
    expect(e.document.marks).toEqual([]);
  });

  it("adds with carries, lining decimals up on the point", () => {
    const d = done(make("add", ["4758", "2696"]));
    expect(d.answer).toEqual({ text: "7454", show: "hidden" });
    expect(d.marks.filter((m) => m.row === "answer").length).toBeGreaterThan(0);
    expect(done(make("add", ["37.25", "8.6"])).answer.text).toBe("45.85");
    expect(done(make("add", ["125", "250", "300"])).answer.text).toBe("675");
  });

  it("subtracts with exchanges across zeros, crossing out digits", () => {
    const d = done(make("subtract", ["6003", "2478"]));
    expect(d.answer.text).toBe("3525");
    expect(d.marks.some((m) => m.cross)).toBe(true);
    expect(d.marks.every((m) => m.show === "hidden")).toBe(true);
  });

  it("multiplies with partial products and their sum", () => {
    const d = done(make("multiply", ["546", "43"]));
    expect(d.working.map((w) => w.value.text)).toEqual(["1638", "21840"]);
    expect(d.answer.text).toBe("23478");
    expect(() => make("multiply", ["5.4", "3"])).toThrow(/whole/);
  });

  it("divides: short division with carried remainders, a remainder, and long division to a decimal", () => {
    const s = done(make("short-division", ["2172", "6"]));
    expect(s.answer.text).toBe("362");
    expect(s.marks.length).toBeGreaterThan(0);
    const r = done(make("short-division", ["145", "6"], { remainder: true }));
    expect(r.answer.text).toBe("24");
    expect(r.remainder?.text).toBe("1");
    const l = done(make("long-division", ["846", "15"]), true);
    expect(l.answer.text).toBe("56.4");
    expect(l.working.length).toBeGreaterThan(0);
    expect(() => make("short-division", ["84", "1.5"])).toThrow(/10, 100 or 1000|whole/);
  });

  it("shows a digit exchanged twice at its final value, and the unwritten zeros of a decimal", () => {
    const m = done(make("subtract", ["512", "39"])).marks;
    expect(m).toContainEqual(expect.objectContaining({ place: 1, text: "10", cross: true }));
    expect(m).toContainEqual(expect.objectContaining({ place: 2, text: "4", cross: true }));
    const dm = done(make("subtract", ["5.2", "3.75"]));
    expect(dm.answer.text).toBe("1.45");
    expect(dm.marks).toContainEqual(expect.objectContaining({ place: -1, text: "11", cross: true }));
    expect(dm.marks).toContainEqual(expect.objectContaining({ place: -2, text: "10", cross: true }));
  });

  it("keeps dividing past the point only when asked and no zeros are written, carrying every remainder", () => {
    const s = wm.complete(make("short-division", ["7", "4"]), true, true).envelope.document;
    expect([s.answer.text, s.extend.text, s.remainder]).toEqual(["1.75", "00", null]);
    expect(s.marks.map((m) => [m.row, m.place, m.text])).toEqual([["extend", -1, "3"], ["extend", -2, "2"]]);
    const third = wm.complete(make("short-division", ["1", "3"]), true, true).envelope.document;
    expect([third.answer.text, third.remainder]).toEqual(["0.333333", null]);
    expect(wm.complete(make("short-division", ["0.25", "3"]), true, true).envelope.document.answer.text).toBe("0.083333");
    expect(wm.complete(make("long-division", ["1234", "7"]), true, true).envelope.document.working.length).toBeLessThanOrEqual(wm.MAX_ROWS);
    const typed = wm.complete(make("long-division", ["7", "4"], { extend: "0" }), true, true).envelope.document;
    expect([typed.answer.text, typed.extend.text]).toEqual(["1.7", "0"]);
    expect(() => wm.complete(make("short-division", ["2000", "201"]))).toThrow(/long division/);
  });

  it("raises a teacher note for a wrong answer, unless the error is deliberate", () => {
    expect(wm.warnings(make("short-division", ["1", "3"], { extend: "00", answer: "0.33" }))).toEqual([]);
    expect(wm.warnings(make("short-division", ["7", "4"], { extend: "0", answer: "1.7" }))).toEqual([]);
    const shifted = done(make("multiply", ["546", "43"]));
    const moved = wm.shiftRow(wm.forView({ ...make("multiply", ["546", "43"]), document: { ...shifted, intentionalError: false } } as wm.Envelope, "answer"), "w2", 1);
    expect(wm.warnings(moved)).toEqual(["Working row 2 should be 21840, not 21840 moved 1 column left."]);
    const e = make("add", ["12", "30"], { answer: "52" });
    expect(wm.warnings(e).length).toBe(1);
    expect(wm.warnings(make("add", ["12", "30"], { answer: "52", intentionalError: true }))).toEqual([]);
  });

  it("keeps the pupil and answer copies the same size", () => {
    for (const x of examples) {
      const worked = x.make(true);
      const pupil = wm.forView(worked, "pupil");
      const a = wm.layout(pupil),
        b = wm.layout(wm.forView(worked, "answer"));
      expect([a.width, a.height], x.id).toEqual([b.width, b.height]);
    }
  });

  it("round-trips links, files and every example", async () => {
    for (const x of examples)
      for (const worked of [false, true]) {
        const e = x.make(worked);
        expect(wm.parseFile(wm.canonical(e))).toEqual(e);
        expect(wm.decodeLinkHash(wm.linkHash(e))).toEqual(e);
        expect(wm.exportIssue(e), x.id).toBeNull();
        expect(wm.warnings(e), x.id).toEqual([]);
      }
    const e = examples[0].make(false);
    expect(wm.editorLink(e, "https://mathsdock.co.uk/tools/graph")).toMatch(/\/tools\/written-method#written-method=/);
    expect(await wm.hash(e)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("revises through the connector operations against the exact hash", async () => {
    const e = make("add", ["125", ""]);
    const next = await io.revise({
      envelope: e,
      baseHash: await wm.hash(e),
      operations: [
        { op: "set_row", row: "n2", text: "38" },
        { op: "add_number", text: "7" },
        { op: "complete" },
      ],
    });
    expect(next.document.numbers.map((n) => n.value.text)).toEqual(["125", "38", "7"]);
    expect(next.document.answer).toEqual({ text: "170", show: "hidden" });
    await expect(io.revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/stale_hash/);
  });
  it("leaves out a row in both copies, and working it out keeps a left-out blank left out", () => {
    let e = wm.setRow(wm.setRow(wm.create("add"), "n1", { text: "12" }), "n2", { text: "30" });
    e = wm.setRow(e, "answer", { show: "omit" });
    expect(e.document.answer).toEqual({ text: "", show: "omit" });
    const done = wm.complete(e, false).envelope;
    expect(done.document.answer).toEqual({ text: "42", show: "omit" });
    expect(wm.renderSvg(wm.forView(done, "answer", true))).not.toMatch(/>4</);
  });
});
