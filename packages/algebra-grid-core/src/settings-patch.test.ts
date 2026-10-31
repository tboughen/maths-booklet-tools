import { describe, expect, it } from "vitest";
import { create as blankGrid, example } from "./index";
import { create, createSchema, hash, operationSchema, revise } from "./interchange";

// Regression: under zod 4, `.partial()` kept field defaults, so set_settings reset the compact
// headings and grid-line weight (a physical print change) whenever a patch omitted them.
describe("algebra-grid settings patches change only the keys they send", () => {
  it("set_settings keeps compact headings and grid-line weight", async () => {
    const e = blankGrid();
    expect(e.document).toMatchObject({ compactHeadings: true, gridLineMm: 0.5 });
    const r = await revise({ envelope: e, baseHash: await hash(e), operations: [{ op: "set_settings", settings: { questionVisible: false } }] });
    expect(r.document).toMatchObject({ compactHeadings: true, gridLineMm: 0.5, questionVisible: false });
  });

  it("spec settings keep the example's layout", () => {
    const e = create({ spec: { example: "single", settings: { questionVisible: false } } });
    expect(e.document.compactHeadings).toBe(example("single").document.compactHeadings);
    expect(e.document.gridLineMm).toBe(example("single").document.gridLineMm);
    expect(e.document.questionVisible).toBe(false);
  });

  it("parses settings without inventing omitted keys", () => {
    expect(operationSchema.parse({ op: "set_settings", settings: { questionVisible: false } })).toEqual({ op: "set_settings", settings: { questionVisible: false } });
    expect(createSchema.parse({ spec: { settings: {} } })).toEqual({ spec: { settings: {} } });
  });
});
