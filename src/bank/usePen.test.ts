// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useReducer } from "react";
import { describe, expect, it } from "vitest";
import { annotationReducer, type Stroke } from "./annotations";
import { usePen } from "./usePen";

const stroke = (id: string): Stroke => ({ id, kind: "pen", colour: "#1b1b1b", size: 3.5, scale: 1, points: [[0, 0], [10, 10]] });
const setup = () => renderHook(() => { const [ink, dispatch] = useReducer(annotationReducer, {}); return { ink, pen: usePen(ink, dispatch) }; });
const key = (k: string, extra: Partial<KeyboardEventInit> = {}) => new KeyboardEvent("keydown", { key: k, cancelable: true, ...extra });

describe("the shared pen", () => {
  it("undoes and redoes in drawing order, only in the views it is told are on screen", () => {
    const { result } = setup();
    act(() => { result.current.pen.commit("a", [stroke("1")]); });
    act(() => { result.current.pen.commit("b", [stroke("2")]); });
    const onlyA = (k: string) => k === "a";
    expect(result.current.pen.canUndo(onlyA)).toBe(true);
    act(() => { result.current.pen.undo(onlyA); });
    expect(result.current.ink.a.strokes).toEqual([]);
    expect(result.current.ink.b.strokes).toHaveLength(1);
    act(() => { result.current.pen.redo(onlyA); });
    expect(result.current.ink.a.strokes).toHaveLength(1);
  });

  it("clears each view with ink as its own undoable step, and forgets history on a reload", () => {
    const { result } = setup();
    act(() => { result.current.pen.commit("a", [stroke("1")]); result.current.pen.commit("b", [stroke("2")]); });
    act(() => { result.current.pen.clear(["a", "b", "c"]); });
    expect(result.current.ink.a.strokes).toEqual([]);
    expect(result.current.ink.c).toBeUndefined();
    act(() => { result.current.pen.undo(); });
    expect(result.current.ink.b.strokes).toHaveLength(1);
    act(() => { result.current.pen.resetHistory(); });
    expect(result.current.pen.canUndo(() => true)).toBe(false);
  });

  it("has the same keys everywhere: P picks up and puts down the pen, tool letters and colour numbers only while annotating", () => {
    const { result } = setup();
    let handled = false;
    act(() => { handled = result.current.pen.handleKey(key("e")); });
    expect(handled).toBe(false);
    act(() => { result.current.pen.handleKey(key("p")); });
    expect(result.current.pen.annotating).toBe(true);
    act(() => { result.current.pen.handleKey(key("3")); });
    expect(result.current.pen.prefs.penColour).toBe("#e8343a");
    act(() => { result.current.pen.handleKey(key("e")); });
    expect(result.current.pen.prefs.tool).toBe("eraser");
    expect(result.current.pen.drawing).toBe(true);
    act(() => { result.current.pen.handleKey(key("p")); result.current.pen.handleKey(key("p")); });
    expect(result.current.pen.annotating).toBe(false);
  });
});
