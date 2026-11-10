import { describe, expect, it } from "vitest";
import { create, revise } from "./interchange";
import { forView, hash, layout } from "./index";

describe("frequency tree connector adapter", () => {
  it("builds a nested spec, keeping hidden counts and calculating only on request", () => {
    const e = create({
      spec: {
        total: "80",
        groups: [
          { name: "men", count: "32", countHidden: true, children: [{ name: "like coffee", count: "24" }, { name: "do not like coffee", count: "" }] },
          { name: "women", count: "", countHidden: true, children: [{ name: "like coffee", count: "37", countHidden: true }, { name: "do not like coffee", count: "11", countHidden: true }] },
        ],
        questions: [{ text: "P(woman) =", top: ["women"] }],
      },
    });
    expect(e.document.nodes.map((b) => b.count.text)).toEqual(["32", "24", "", "", "37", "11"]);
    expect(e.document.questions[0].answer).toEqual({ text: "", show: "hidden" });
    const filled = create({ spec: { total: "80", groups: [{ name: "a", count: "30" }, { name: "b", count: "", countHidden: true }], fillCounts: true, questions: [{ text: "P(b) =", top: ["b"], calculate: true }] } });
    expect(filled.document.nodes[1].count).toEqual({ text: "50", show: "hidden" });
    expect(filled.document.questions[0].answer.text).toBe("50/80");
    expect(layout(e).issues).toEqual([]);
  });

  it("opens examples, refuses mixed input and names unknown groups", () => {
    expect(create({ spec: { example: "lunches" } }).document.total.show).toBe("hidden");
    expect(() => create({ spec: { example: "coffee", total: "9" } })).toThrow(/Examples already/);
    expect(() => create({ spec: { questions: [{ text: "x", top: ["nobody"] }] } })).toThrow(/not in the tree/);
  });

  it("revises against the exact hash with stable IDs", async () => {
    const e = create({});
    const baseHash = await hash(e);
    const next = await revise({
      envelope: e,
      baseHash,
      operations: [
        { op: "set_count", groupId: "total", text: "100" },
        { op: "set_name", groupId: "n2", text: "drink coffee" },
        { op: "end_path", groupId: "n4" },
        { op: "show_all" },
        { op: "hide_counts" },
        { op: "set_settings", settings: { labelPlace: "node", nodeShape: "box" } },
      ],
    });
    expect(next.document.total).toEqual({ text: "100", show: "show" });
    expect(next.document.nodes.filter((b) => b.category.text === "drink coffee")).toHaveLength(1);
    expect(next.document.nodes).toHaveLength(4);
    expect(next.document.nodes.every((b) => b.count.show === "hidden")).toBe(true);
    await expect(revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/base_hash_mismatch/);
    await expect(revise({ envelope: e, baseHash, operations: [{ op: "split_group", groupId: "n2" }] })).rejects.toThrow(/at most 2 levels/);
    // The answer view never changes the saved document.
    expect(forView(e, "answer").document.nodes[0].count.show).toBe("show");
    expect(e.document.nodes[0].count.show).toBe("hidden");
  });
});
