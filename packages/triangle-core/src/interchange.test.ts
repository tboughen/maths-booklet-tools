import { describe, expect, it } from "vitest";
import * as core from "./index";
import * as ti from "./interchange";
import { examples } from "./examples";
import { calculationContexts } from "./context";
import { parseTriangleLink } from "./links";

export const scaffold = () => ti.create({ spec: { labels: [
  { ref: "e:AB", label: { text: "3", state: "value" } },
  { ref: "e:AC", label: { text: "4", state: "value" } },
  { ref: "e:BC", label: { text: "x", state: "symbol" } },
] } });
const edit = async (e: core.Envelope, operations: unknown[]) => ti.revise({ envelope: e, baseHash: await ti.hash(e), operations });
const calc = { op: "calculate_and_store", ref: "e:BC", triangleId: "T1", method: "pythagoras-hypotenuse", rounding: { kind: "exact", digits: 0 } };
describe("Triangle interchange", () => {
  it.each(["right", "scalene", "isosceles", "equilateral"])("uses the unchanged %s default", shape => {
    const e = ti.create({ spec: { shape } });
    expect(e).toEqual(core.create(shape as Parameters<typeof core.create>[0]));
    expect(parseTriangleLink(ti.editorLink(e, "https://mathsdock.co.uk/")!)).toEqual(e);
  });
  it.each(examples.map(e => e.key))("preserves existing %s example bytes and pupil state", async key => {
    const e = ti.create({ spec: { example: key } });
    expect(core.canonical(e)).toBe(core.canonical(examples.find(e => e.key === key)!.build()));
    const copy = await edit(e, []);
    expect(core.canonical(copy)).toBe(core.canonical(e));
    expect(core.renderSvg(copy)).toBe(core.renderSvg(e));
  });
  it("does not infer answers; revisions are atomic and hash bound", async () => {
    const e = scaffold(), before = core.canonical(e);
    expect(core.getLabel(e, "e:BC").answer).toBe("");
    await expect(ti.revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow("base_hash_mismatch");
    await expect(edit(e, [{ op: "set_label", ref: "e:AB", patch: { text: "6" } }, { op: "set_label", ref: "e:no", patch: { text: "2" } }])).rejects.toThrow();
    expect(core.canonical(e)).toBe(before);
  });
  it("saves an explicit answer hidden, reveals a copy and refuses stale answers", async () => {
    const e = scaffold(), saved = await edit(e, [calc]);
    expect(core.getLabel(saved, "e:BC")).toMatchObject({ answer: "5", answerVisible: false, state: "symbol", text: "x" });
    expect(core.renderSvg(saved)).toBe(core.renderSvg(e));
    const worked = await edit(saved, [{ op: "worked_copy" }]);
    expect(core.getLabel(worked, "e:BC").answerVisible).toBe(true);
    expect(core.getLabel(saved, "e:BC").answerVisible).toBe(false);
    const stale = await edit(saved, [{ op: "set_label", ref: "e:AB", patch: { text: "6" } }]);
    await expect(edit(stale, [{ op: "worked_copy" }])).rejects.toThrow("stale");
    const manual = await edit(stale, [{ op: "keep_answer_manual", ref: "e:BC" }, { op: "worked_copy" }]);
    expect(core.getLabel(manual, "e:BC").answerVisible).toBe(true);
    await expect(edit(saved, [calc])).rejects.toThrow("overwrite");
  });
  it("refuses hidden measurements, invalid targets, mixed units and given overrides", async () => {
    const e = scaffold();
    await expect(edit(e, [{ ...calc, inputs: { p: "30" } }])).rejects.toThrow("disagrees");
    await expect(edit(e, [{ ...calc, ref: "a:T1-A" }])).rejects.toThrow("method");
    await expect(edit(e, [{ ...calc, triangleId: "missing" }])).rejects.toThrow("Unknown");
    const hidden = await edit(e, [{ op: "set_label", ref: "e:AB", patch: { state: "hidden" } }]);
    await expect(edit(hidden, [calc])).rejects.toThrow("missing");
    const mixed = await edit(e, [{ op: "set_label", ref: "e:AB", patch: { unit: "mm" } }]);
    await expect(edit(mixed, [calc])).rejects.toThrow("one unit");
    await expect(edit(e, [{ ...calc, inputs: { bogus: "1" } }])).rejects.toThrow("Unknown calculation");
  });
  it.each(["joined", "split", "separate"])("creates and restores %s without guessing side IDs", async layout => {
    const e = scaffold();
    const paired = await edit(e, [{ op: "add_triangle", layout, ...(layout === "separate" ? {} : { edgeId: "AC" }) }]);
    expect(paired.document.layout).toBe(layout);
    expect(paired.document.widthCm).toBe(16);
    const restored = await edit(paired, [{ op: "remove_second" }]);
    expect(restored.document.layout).toBe("single");
    expect(core.getLabel(restored, "e:AB").text).toBe("3");
    await expect(edit(e, [{ op: "add_triangle", layout: "joined", edgeId: "missing" }])).rejects.toThrow("Unknown");
    await expect(edit(e, [{ op: "add_triangle", layout: "split" }])).rejects.toThrow("explicitly");
  });
  it("keeps angle marks independent and refuses incompatible right marks", async () => {
    const e = ti.create({ spec: { shape: "scalene" } });
    await expect(edit(e, [{ op: "set_angle_mark", id: "T1-A", mark: "right" }])).rejects.toThrow("perpendicular");
    const mark = await edit(e, [{ op: "set_angle_mark", id: "T1-A", mark: "double" }]);
    expect(mark.document.angles[0].label.state).toBe("blank");
    const labelled = await edit(mark, [{ op: "set_label", ref: "a:T1-B", patch: { text: "x", state: "symbol" } }]);
    expect(labelled.document.angles[1].mark).toBe("none");
  });
  it("upgrades only when adding an area, preserves no-op v2 and restores version on removal", async () => {
    const e = scaffold();
    const area = await edit(e, [{ op: "set_area", triangleId: "T1", label: { state: "answer-line", prefix: "Area = " } }]);
    expect(area.schemaVersion).toBe(2);
    expect(area.rendererVersion).toBe("triangle-2");
    expect((await edit(area, [])).schemaVersion).toBe(2);
    expect((await edit(area, [{ op: "set_area", triangleId: "T1", label: null }])).schemaVersion).toBe(1);
    const oldV2 = { ...e, schemaVersion: 2, rendererVersion: "triangle-2" };
    expect(ti.create({ envelope: oldV2 })).toEqual(oldV2);
    expect(() => ti.create({ envelope: { ...area, schemaVersion: 1 } })).toThrow();
  });
  it("edits shared text, unlinks without losing it and retains hidden answers", async () => {
    const e = await edit(scaffold(), [
      { op: "set_shared_label", id: "shared", text: "x" },
      { op: "link_label", ref: "a:T1-B", sharedId: "shared" },
      { op: "link_label", ref: "a:T1-C", sharedId: "shared" },
      { op: "set_label", ref: "a:T1-B", patch: { text: "y" } },
      { op: "set_saved_answer", ref: "e:BC", answer: "5" },
    ]);
    expect(core.textOf(e, core.getLabel(e, "a:T1-C"))).toBe("y");
    const unlinked = await edit(e, [{ op: "link_label", ref: "a:T1-C", sharedId: null }]);
    expect(core.getLabel(unlinked, "a:T1-C").text).toBe("y");
    expect(core.getLabel(unlinked, "e:BC").answerVisible).toBe(false);
  });
  it("rejects oversized batches, invalid tuples, unknown fields and forged provenance", async () => {
    await expect(edit(scaffold(), Array.from({ length: 31 }, () => ({ op: "worked_copy" })))).rejects.toThrow();
    const e = scaffold();
    (e.document.triangles[0].vertices as string[]).push("D");
    expect(() => ti.create({ envelope: e })).toThrow();
    await expect(edit(scaffold(), [{ op: "set_label", ref: "e:BC", patch: { calculation: { basis: "forged", formula: "x" } } }])).rejects.toThrow();
  });
  it("constructs explicitly while retaining unknowns; never treats labels as geometry", async () => {
    const e = scaffold(), before = structuredClone(e.document.vertices);
    const changed = await edit(e, [{ op: "set_label", ref: "e:AB", patch: { text: "6" } }]);
    expect(changed.document.vertices).toEqual(before);
    const made = await edit(e, [{ op: "construct", triangleId: "T1", method: "SSS", inputs: { a: "5", b: "4", c: "3" } }]);
    expect(core.getLabel(made, "e:BC").state).toBe("symbol");
    expect(core.getLabel(made, "e:BC").answer).toBe("");
  });
  it("uses contextual height/area ownership and explicit inputs", async () => {
    let e = await edit(scaffold(), [{ op: "add_height", triangleId: "T1", apex: "B" }, { op: "set_area", triangleId: "T1", label: { state: "value", text: "6" } }]);
    e = await edit(e, [{ op: "calculate_and_store", ref: "h:H1", triangleId: "T1", method: "height-area", rounding: { kind: "dp", digits: 0 } }]);
    expect(core.getLabel(e, "h:H1").answer).toBe("3");
    expect(calculationContexts(e, "h:H1", "T1").find(c => c.method === "height-area")!.raw).toEqual({ area: "6", base: "4" });
  });
  it.each([
    ["pythagoras-leg", "e:AB", "right", { "e:AC": "4", "e:BC": "5" }, {}, 3],
    ["right-side", "e:AC", "right", { "e:AB": "6", "a:T1-B": "30" }, {}, 3.4641],
    ["right-angle", "a:T1-B", "right", { "e:AC": "3", "e:BC": "5" }, {}, 36.8699],
    ["sine-side", "e:BC", "scalene", { "e:AC": "5", "a:T1-B": "30", "a:T1-A": "60" }, {}, 8.6603],
    ["sine-angle", "a:T1-A", "scalene", { "e:AC": "5", "a:T1-B": "30", "e:BC": "8" }, {}, 53.1301],
    ["cosine-side", "e:BC", "scalene", { "e:AC": "4", "e:AB": "3", "a:T1-A": "60" }, {}, 3.6056],
    ["cosine-angle", "a:T1-A", "scalene", { "e:AC": "4", "e:AB": "3", "e:BC": "5" }, {}, 90],
    ["area-height", "r:T1", "scalene", {}, {base:"4",height:"3"}, 6],
    ["area-sine", "r:T1", "scalene", { "e:AC": "4", "e:AB": "3", "a:T1-A": "60" }, {}, 5.1962],
    ["area-angle", "a:T1-A", "scalene", { "e:AC": "4", "e:AB": "3" }, {}, 56.4427],
    ["angle-sum", "a:T1-A", "scalene", { "a:T1-B": "30", "a:T1-C": "60" }, {}, 90],
  ] as const)("uses the named context for %s", async (method, ref, shape, labels, inputs, expected) => {
    let e = ti.create({spec:{shape,labels:Object.entries(labels).map(([ref,text])=>({ref,label:{state:"value",text}}))}});
    if (ref.startsWith("r:") || method === "area-angle") e = await edit(e,[{op:"set_area",triangleId:"T1",label:method === "area-angle" ? {state:"value",text:"5"} : {state:"answer-line"}}]);
    const operation = {op:"calculate_and_store",ref,triangleId:"T1",method,inputs,rounding:{kind:"dp",digits:4},...(method === "sine-angle" ? {branch:"Acute B"} : method === "area-angle" ? {branch:"Acute included angle"} : {})};
    if (method === "sine-angle" || method === "area-angle") await expect(edit(e,[{...operation,branch:undefined}])).rejects.toThrow("branch");
    const saved = await edit(e,[operation]);
    expect(Number(core.getLabel(saved,ref).answer)).toBeCloseTo(expected,3);
    expect(core.getLabel(saved,ref).answerVisible).toBe(false);
  });
});
