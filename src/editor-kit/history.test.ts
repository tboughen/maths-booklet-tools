import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createHistory, EDITOR_HISTORY_LIMIT, pushHistory, redoHistory, redoLabel, replacePresent, undoHistory, undoLabel, undoCommand, useDocumentHistory } from ".";

const key = (init: Partial<KeyboardEvent> & { key: string }, target: EventTarget | null = document.body) =>
  ({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, target, ...init }) as KeyboardEvent;

describe("shared editor history", () => {
  it("records steps, undoes and redoes them with their names", () => {
    let h = createHistory(1);
    h = pushHistory(h, 2, { label: "add row" });
    h = pushHistory(h, 3, { label: "remove row" });
    expect(undoLabel(h)).toBe("remove row");
    expect(redoLabel(h)).toBe("");
    h = undoHistory(h);
    expect(h.present).toBe(2);
    expect(undoLabel(h)).toBe("add row");
    expect(redoLabel(h)).toBe("remove row");
    h = undoHistory(h);
    expect(h.present).toBe(1);
    expect(undoHistory(h)).toBe(h);
    h = redoHistory(redoHistory(h));
    expect(h.present).toBe(3);
    expect(undoLabel(h)).toBe("remove row");
    expect(redoHistory(h)).toBe(h);
  });

  it("clears redo on a new change and ignores changes equal to the present", () => {
    let h = pushHistory(pushHistory(createHistory("a"), "b"), "c");
    h = undoHistory(h);
    h = pushHistory(h, "d", { label: "type" });
    expect(h.future).toEqual([]);
    expect(h.past).toEqual(["a", "b"]);
    expect(pushHistory(h, "d")).toBe(h);
    const same = (x: { v: number }, y: { v: number }) => x.v === y.v;
    const o = createHistory({ v: 1 });
    expect(pushHistory(o, { v: 1 }, { equals: same })).toBe(o);
  });

  it("keeps one limit for every editor and drops the oldest steps with their names", () => {
    let h = createHistory(0);
    for (let i = 1; i <= EDITOR_HISTORY_LIMIT + 5; i++) h = pushHistory(h, i, { label: `step ${i}` });
    expect(h.past).toHaveLength(EDITOR_HISTORY_LIMIT);
    expect(h.past[0]).toBe(5);
    expect(h.done).toHaveLength(EDITOR_HISTORY_LIMIT);
    expect(h.done?.[0]).toBe("step 6");
    expect(pushHistory(createHistory(0), 1, { limit: 1 }).past).toEqual([0]);
  });

  it("copes with histories made without names", () => {
    const h = undoHistory({ past: [1, 2], present: 3, future: [4] });
    expect(h).toMatchObject({ past: [1], present: 2, future: [3, 4], done: [""], undone: ["", ""] });
    expect(replacePresent(h, 9)).toMatchObject({ past: [1], present: 9, future: [3, 4] });
  });

  it("reads the same undo keys everywhere, but not while typing or behind a dialog", () => {
    expect(undoCommand(key({ key: "z", ctrlKey: true }))).toBe("undo");
    expect(undoCommand(key({ key: "Z", metaKey: true, shiftKey: true }))).toBe("redo");
    expect(undoCommand(key({ key: "y", ctrlKey: true }))).toBe("redo");
    expect(undoCommand(key({ key: "z" }))).toBeNull();
    expect(undoCommand(key({ key: "z", ctrlKey: true, altKey: true }))).toBeNull();
    const input = document.createElement("input");
    expect(undoCommand(key({ key: "z", ctrlKey: true }, input))).toBeNull();
    const dialog = document.createElement("div");
    dialog.setAttribute("aria-modal", "true");
    document.body.append(dialog);
    expect(undoCommand(key({ key: "z", ctrlKey: true }))).toBeNull();
    dialog.remove();
  });

  it("gives pages one hook with commit, replace, undo and redo", () => {
    const { result } = renderHook(() => useDocumentHistory(() => ({ n: 0 }), { equals: (a, b) => a.n === b.n }));
    act(() => result.current.commit({ n: 1 }, "add"));
    act(() => result.current.commit({ n: 1 }, "same"));
    expect(result.current.history.past).toHaveLength(1);
    expect(result.current.undoLabel).toBe("add");
    act(() => result.current.replace({ n: 2 }));
    expect(result.current.history.past).toHaveLength(1);
    act(() => result.current.undo());
    expect(result.current.present).toEqual({ n: 0 });
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.present).toEqual({ n: 2 });
  });
});
