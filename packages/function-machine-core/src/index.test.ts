import { describe, expect, it } from "vitest";
import * as fm from "./index";
import * as io from "./interchange";
import { examples } from "./examples";
import { format, parse } from "./rational";
import { pieces, typeset } from "./maths-text";

const machine = (start: string, ops: string[], end: string) =>
  io.create({ spec: { machines: [{ start, ops, end }] } });

describe("function machines", () => {
  it("creates an empty two-box machine by default and keeps blanks distinct from hidden answers", () => {
    const e = fm.create();
    expect(e.document.machines[0].steps.map((s) => s.op.text)).toEqual(["", ""]);
    expect(e.document.machines[0].start.text).toBe("input");
    expect(() => fm.setSlot(e, "m1", "op:0", { show: "hidden" })).toThrow(/blank cannot hold a hidden answer/);
    const hidden = fm.setSlot(e, "m1", "op:0", { text: "× 3", show: "hidden" });
    expect(fm.renderSvg(hidden)).not.toContain("× 3");
    expect(fm.renderSvg(fm.forView(hidden, "answer", true))).toContain(fm.ANSWER_COLOUR);
  });

  it("refuses a value after the last box", () => {
    const e = fm.create();
    expect(() => fm.setSlot(e, "m1", "out:1", { text: "4" })).toThrow(/between two boxes/);
    const bad = structuredClone(e);
    bad.document.machines[0].steps[1].out = fm.value("4");
    expect(() => fm.validate(bad)).toThrow(/last box/);
  });

  it("reads operations and writes their inverses", () => {
    expect(fm.inverseText("x3")).toBe("÷ 3");
    expect(fm.inverseText("-8")).toBe("+ 8");
    expect(fm.inverseText("÷ 1/2")).toBe("× 1/2");
    expect(fm.inverseText("square")).toBe("√");
    expect(fm.inverseText("")).toBeNull();
  });

  it("works forwards only when asked, keeping what is entered, as hidden answers", () => {
    const e = machine("6", ["× 3", "− 8"], "");
    expect(e.document.machines[0].end.text).toBe("");
    const done = fm.complete(e).envelope;
    expect(done.document.machines[0].steps[0].out).toEqual({ text: "18", show: "hidden" });
    expect(done.document.machines[0].end).toEqual({ text: "10", show: "hidden" });
    expect(fm.complete(e, undefined, false, false).envelope.document.machines[0].steps[0].out).toBeNull();
  });

  it("works backwards from a numeric end through the inverse operations, exactly", () => {
    const done = fm.complete(machine("", ["× 3", "− 8"], "−11")).envelope.document.machines[0];
    expect(done.start.text).toBe("−1");
    expect(fm.complete(machine("", ["× 3"], "7")).envelope.document.machines[0].start.text).toBe("7/3");
  });

  it("adds the inverse machine beneath, running right to left", () => {
    const e = fm.addInverse(machine("input", ["× 5", "− 2"], "28"), "m1");
    const inv = e.document.machines[1];
    expect(inv.direction).toBe("left");
    expect(inv.steps.map((s) => s.op.text)).toEqual(["+ 2", "÷ 5"]);
    expect(inv.start.text).toBe("28");
    expect(fm.complete(e, "m2").envelope.document.machines[1].end.text).toBe("input");
    expect(() => fm.addInverse(fm.create(), "m1")).toThrow(/no inverse/);
  });

  it("raises a teacher note for a value that does not follow, unless the error is deliberate", () => {
    const e = machine("6", ["× 3", "− 8"], "12");
    expect(fm.warnings(e)).toEqual(["6 × 3 − 8 is 10, not 12."]);
    expect(fm.warnings(io.create({ envelope: { ...e, document: { ...e.document, intentionalError: true } } }))).toEqual([]);
  });

  it("prints maths: true minus, times, italic letters and stacked fractions", () => {
    expect(typeset("x3")).toBe("× 3");
    expect(typeset("-8")).toBe("−8");
    expect(pieces("× 1/3").map((p) => p.kind)).toEqual(["text", "fraction"]);
    expect(pieces("3n + 2").some((p) => p.kind === "text" && p.italic && p.text === "n")).toBe(true);
    const svg = fm.renderSvg(machine("n", ["× 1/3"], "output"));
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain("<line");
  });

  it("reads and formats exact values", () => {
    expect(format(parse("2.5")!)).toBe("2.5");
    expect(format(parse("1 1/2")!)).toBe("1.5");
    expect(format(parse("−4/6")!)).toBe("−2/3");
    expect(parse("input")).toBeNull();
  });

  it("round-trips links, files and every example", async () => {
    for (const x of examples)
      for (const worked of [false, true]) {
        const e = x.make(worked);
        expect(fm.parseFile(fm.canonical(e))).toEqual(e);
        expect(fm.decodeLinkHash(fm.linkHash(e))).toEqual(e);
        expect(fm.exportIssue(e)).toBeNull();
        if (!x.id.startsWith("spot")) expect(fm.warnings(e), x.id).toEqual([]);
      }
    const e = examples[0].make(false);
    expect(fm.editorLink(e, "https://mathsdock.co.uk/tools/graph")).toMatch(/\/tools\/function-machine#function-machine=/);
    expect(await fm.hash(e)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("revises through the connector operations against the exact hash", async () => {
    const e = io.create({ spec: { ops: ["× 3", ""], start: "4", end: { text: "20", hidden: true } } });
    const next = await io.revise({
      envelope: e,
      baseHash: await fm.hash(e),
      operations: [
        { op: "set_item", machineId: "m1", slot: "op:1", text: "+ 8" },
        { op: "add_box", machineId: "m1", text: "÷ 2" },
        { op: "complete", machineId: "m1" },
      ],
    });
    expect(next.document.machines[0].steps.map((s) => s.op.text)).toEqual(["× 3", "+ 8", "÷ 2"]);
    expect(next.document.machines[0].steps[1].out?.text).toBe("20");
    expect(next.document.machines[0].end.text).toBe("20");
    await expect(io.revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/stale_hash/);
  });
});
