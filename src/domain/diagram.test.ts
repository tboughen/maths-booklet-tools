import { describe, expect, it } from "vitest";
import {
  adjustAxis,
  clientPointToSvg,
  clipInfiniteLine,
  clipSegment,
  cloneDefaultDocument,
  createEditorLayout,
  deleteSelectedObject,
  getBounds,
  setAxisScale,
  snapCoordinate,
  updateObject,
} from "./diagram";
import type { DiagramDocumentV1, PointObject } from "./types";

describe("diagram domain", () => {
  it("creates an independent default 10 by 10 grid", () => {
    const first = cloneDefaultDocument();
    const second = cloneDefaultDocument();

    expect(first).not.toBe(second);
    expect(getBounds(first)).toEqual({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 });
    first.axes.x.positiveSquares = 8;
    expect(second.axes.x.positiveSquares).toBe(5);
  });

  it("reserves clear space around all four axis-control groups", () => {
    const layout = createEditorLayout(cloneDefaultDocument());

    expect(layout.plotLeft).toBe(148);
    expect(layout.width - layout.plotRight).toBe(172);
    expect(layout.plotTop).toBe(120);
    expect(layout.height - layout.plotBottom).toBe(112);
  });

  it("snaps each axis to half a square at the selected scale", () => {
    expect(snapCoordinate({ x: 0.74, y: -1.26 }, 1, 0.5)).toEqual({ x: 0.5, y: -1.25 });
    expect(snapCoordinate({ x: 1.1, y: 2.9 }, 2, 2)).toEqual({ x: 1, y: 3 });
  });

  it("maps pointer positions through the SVG's centred aspect-ratio margins", () => {
    const document = cloneDefaultDocument();
    const layout = createEditorLayout(document);
    const svgPoint = { x: 568, y: 360 };
    const viewport = { left: 100, top: 50, width: 1100, height: 680 };
    const scale = viewport.height / layout.height;
    const horizontalMargin = (viewport.width - layout.width * scale) / 2;
    const clientPoint = {
      x: viewport.left + horizontalMargin + svgPoint.x * scale,
      y: viewport.top + svgPoint.y * scale,
    };

    const mappedPoint = clientPointToSvg(clientPoint, viewport, layout);
    expect(mappedPoint.x).toBeCloseTo(svgPoint.x, 10);
    expect(mappedPoint.y).toBeCloseTo(svgPoint.y, 10);
  });

  it("changes one axis end by one square while respecting grid limits", () => {
    const document = cloneDefaultDocument();
    const expanded = adjustAxis(document, "x", "positive", 1);
    expect(expanded.axes.x.positiveSquares).toBe(6);
    expect(expanded.axes.x.negativeSquares).toBe(5);

    const minimum: DiagramDocumentV1 = {
      ...document,
      axes: { ...document.axes, x: { ...document.axes.x, negativeSquares: 1, positiveSquares: 1 } },
    };
    expect(adjustAxis(minimum, "x", "negative", -1)).toBe(minimum);
  });

  it("changes scale without changing mathematical object coordinates", () => {
    const point: PointObject = { id: "point-1", kind: "point", position: { x: 2, y: 3 } };
    const document = { ...cloneDefaultDocument(), objects: [point] };
    const changed = setAxisScale(document, "x", 2);

    expect(changed.axes.x.unitsPerSquare).toBe(2);
    expect(changed.objects[0]).toEqual(point);
    expect(getBounds(changed).xMax).toBe(10);
  });

  it("clips infinite lines and finite segments to the visible grid", () => {
    const bounds = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 };
    expect(clipInfiniteLine({ x: -1, y: -1 }, { x: 1, y: 1 }, bounds)).toEqual([
      { x: -2, y: -2 },
      { x: 2, y: 2 },
    ]);
    expect(clipInfiniteLine({ x: 1, y: -1 }, { x: 1, y: 1 }, bounds)).toEqual([
      { x: 1, y: -2 },
      { x: 1, y: 2 },
    ]);
    expect(clipSegment({ x: -3, y: 0 }, { x: 1, y: 0 }, bounds)).toEqual([
      { x: -2, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(clipSegment({ x: 3, y: 3 }, { x: 4, y: 4 }, bounds)).toBeNull();
  });

  it("updates and deletes only the selected object", () => {
    const first: PointObject = { id: "point-1", kind: "point", position: { x: 0, y: 0 } };
    const second: PointObject = { id: "point-2", kind: "point", position: { x: 1, y: 1 } };
    const document = { ...cloneDefaultDocument(), objects: [first, second], selectedObjectId: first.id };
    const moved = { ...first, position: { x: 2, y: 2 } };
    const updated = updateObject(document, moved);

    expect(updated.objects).toEqual([moved, second]);
    expect(deleteSelectedObject(updated)).toMatchObject({ objects: [second], selectedObjectId: null });
  });
});
