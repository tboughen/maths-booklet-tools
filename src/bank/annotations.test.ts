import { describe, expect, it } from "vitest";
import { addPoint, annotationReducer, hasInk, isFistTouch, isStylusEraser, layerOf, readAnnotationPreferences, strokePath, toolCursor, touchesStroke, type AnnotationState, type Stroke } from "./annotations";

const stroke = (id: string, points: [number, number][], size = 2): Stroke => ({ id, kind: "pen", colour: "#000", size, points });

describe("screen-only annotations", () => {
  it("keeps one undoable history per view and never mixes views", () => {
    let state: AnnotationState = {};
    state = annotationReducer(state, { type: "set", key: "q|question|1", strokes: [stroke("a", [[0, 0], [10, 0]])] });
    state = annotationReducer(state, { type: "set", key: "q|question|1", strokes: [...layerOf(state, "q|question|1").strokes, stroke("b", [[0, 5], [10, 5]])] });
    state = annotationReducer(state, { type: "set", key: "q|scheme|1", strokes: [stroke("c", [[1, 1]])] });
    expect(layerOf(state, "q|question|1").strokes.map(s => s.id)).toEqual(["a", "b"]);
    expect(layerOf(state, "q|scheme|1").strokes.map(s => s.id)).toEqual(["c"]);
    state = annotationReducer(state, { type: "undo", key: "q|question|1" });
    expect(layerOf(state, "q|question|1").strokes.map(s => s.id)).toEqual(["a"]);
    expect(layerOf(state, "q|scheme|1").strokes.map(s => s.id)).toEqual(["c"]);
    state = annotationReducer(state, { type: "redo", key: "q|question|1" });
    expect(layerOf(state, "q|question|1").strokes.map(s => s.id)).toEqual(["a", "b"]);
    // A new change clears redo.
    state = annotationReducer(state, { type: "undo", key: "q|question|1" });
    state = annotationReducer(state, { type: "set", key: "q|question|1", strokes: [] });
    expect(annotationReducer(state, { type: "redo", key: "q|question|1" })).toBe(state);
  });
  it("Clear all empties every view and each view can undo it", () => {
    let state: AnnotationState = {};
    state = annotationReducer(state, { type: "set", key: "one", strokes: [stroke("a", [[0, 0]])] });
    state = annotationReducer(state, { type: "set", key: "two", strokes: [stroke("b", [[0, 0]])] });
    state = annotationReducer(state, { type: "clearAll" });
    expect(hasInk(state)).toBe(false);
    state = annotationReducer(state, { type: "undo", key: "two" });
    expect(layerOf(state, "two").strokes.map(s => s.id)).toEqual(["b"]);
    expect(layerOf(state, "one").strokes).toEqual([]);
  });
  it("undo and redo with nothing to do change nothing", () => {
    const state: AnnotationState = {};
    expect(annotationReducer(state, { type: "undo", key: "x" })).toBe(state);
    expect(annotationReducer(state, { type: "redo", key: "x" })).toBe(state);
  });
  it("erases whole strokes the eraser touches, allowing for the stroke's width", () => {
    const line = stroke("a", [[0, 0], [100, 0]], 4);
    expect(touchesStroke(line, [50, 8], 6)).toBe(true);
    expect(touchesStroke(line, [50, 9], 6)).toBe(false);
    expect(touchesStroke(line, [110, 0], 9)).toBe(true);
    expect(touchesStroke(stroke("dot", [[5, 5]]), [5, 9], 3)).toBe(true);
  });
  it("draws smooth paths and drops points that are too close", () => {
    expect(strokePath([[0, 0], [10, 10]])).toBe("M0 0L10 10");
    expect(strokePath([[0, 0], [10, 0], [20, 10]])).toBe("M0 0Q10 0 15 5L20 10");
    expect(strokePath([[1, 1]])).toMatch(/^M1 1L/);
    const points: [number, number][] = [[0, 0]];
    expect(addPoint(points, [0.2, 0.2], 0.5)).toBe(points);
    expect(addPoint(points, [1, 0], 0.5)).toEqual([[0, 0], [1, 0]]);
  });
  it("treats a fist-sized touch or a stylus eraser as erasing, but not a fingertip or a board that reports no size", () => {
    expect(isFistTouch({ pointerType: "touch", width: 80, height: 60 })).toBe(true);
    expect(isFistTouch({ pointerType: "touch", width: 24, height: 24 })).toBe(false);
    expect(isFistTouch({ pointerType: "touch", width: 1, height: 1 })).toBe(false);
    expect(isFistTouch({ pointerType: "pen", width: 80, height: 80 })).toBe(false);
    expect(isStylusEraser({ pointerType: "pen", buttons: 32, button: -1 })).toBe(true);
    expect(isStylusEraser({ pointerType: "pen", buttons: 1, button: 0 })).toBe(false);
    expect(isStylusEraser({ pointerType: "mouse", buttons: 32, button: 0 })).toBe(false);
  });
  it("remembers tool choices safely", () => {
    localStorage.setItem("qb-annotate", JSON.stringify({ tool: "laser", penColour: "#e8343a", size: "huge", fistEraser: false }));
    expect(readAnnotationPreferences()).toMatchObject({ tool: "laser", penColour: "#e8343a", size: "medium", fistEraser: false });
    localStorage.setItem("qb-annotate", "not json");
    expect(readAnnotationPreferences().tool).toBe("pen");
    localStorage.removeItem("qb-annotate");
  });
  it("draws a pointer for each tool, and none for Move", () => {
    const pen = decodeURIComponent(toolCursor("pen", "#e8343a", 3.5, 2)!);
    expect(pen).toContain("#e8343a");
    expect(pen).toMatch(/\) 16 16, crosshair$/);
    expect(decodeURIComponent(toolCursor("highlighter", "#fffc00", 18, 1)!)).toContain("#fffc00");
    expect(toolCursor("eraser", "", 0, 1)).toMatch(/\) 6 27, cell$/);
    expect(toolCursor("laser", "", 0, 1)).toContain("crosshair");
    expect(toolCursor("hand", "", 0, 1)).toBeUndefined();
  });
});
