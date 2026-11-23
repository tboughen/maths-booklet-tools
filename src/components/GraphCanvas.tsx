import { fitResource } from "../site/useResourceFit";
import {
  NAME_SUBSCRIPT_FONT_POINTS,
  axisTextPlacement,
  coordinatesAnchor,
  coordinatesText,
  getExportMetrics,
  nameBox,
  GRADIENT_BLANK,
  axisNumberBands,
  gradientLabelPlacement,
  nameCentre,
  nameStyle,
  pointLabelPlacement,
} from "../export/svg";
import { polygonVisible } from "../../packages/graph-core/src/polygon";
import { headHalfWidthAt, plotClipBleed } from "../../packages/graph-core/src/svg";
import { arrowheadPath } from "../../packages/graph-core/src/arrow";
import { axesCrossing, circleVisible, readingLegs, smoothCurvePath } from "../../packages/graph-core/src/curve";
import { functionNameAnchor, functionPathData, functionRuns } from "../../packages/graph-core/src/function";
import { vectorArrowEnds } from "../../packages/graph-core/src/diagram";
import { GRID_STROKE_POINTS, READING_ARROWHEAD_POINTS, VECTOR_ARROWHEAD_POINTS } from "../../packages/graph-core/src/graphStyle";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  regionBoundaries,
  regionHalfPlanes,
  regionPolygon,
} from "../../packages/graph-core/src/region";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  axisTicks,
  mathsDigits,
  mathsLetter,
  nameParts,
  sharedOriginLabel,
} from "../../packages/graph-core/src/axes";
import {
  AXIS_LIMITS,
  axisOrigin,
  clampToBounds,
  clipSegment,
  coordinateToSvg,
  createEditorLayout,
  getObjectById,
  getSelectedObject,
  gridDivisions,
  isSketch,
  makeId,
  pointInBounds,
  pointToSegmentDistance,
  snapCoordinate,
  squaredDistance,
  svgToCoordinate,
  updateObject,
  visibleStraightPoints,
} from "../domain/diagram";
import { equationForObject } from "../domain/equations";
import { gradientTriangleCorners, gradientTriangleValues } from "../../packages/graph-core/src/gradient-triangle";
import {
  AXIS_ARROW_EXTRA_SHAFT_CENTIMETRES,
  AXIS_LABEL_FONT_POINTS,
  axisLetter,
  MATHS_FONT_FAMILY,
  PORTABLE_FONT_FAMILY,
  STRAIGHT_DASH_GAP_CENTIMETRES,
  STRAIGHT_DASH_LENGTH_CENTIMETRES,
  Y_AXIS_LABEL_GAP_CENTIMETRES,
  axisLabelBoxHeight,
  axisLabelBoxWidth,
  axisNameYGapCentimetres,
  pointsToDiagramUnits,
} from "../domain/graphStyle";
import type {
  Coordinate,
  GraphEditorDocument,
  DrawingTool,
  GraphObject,
  PointObject,
  PolygonObject,
  StraightObject,
  SvgLayout,
} from "../domain/types";

/** The editor draws a 1 cm grid square 60 units wide; at 100% zoom it is 1 cm of screen (96 px to the inch). */
const PRINT_SIZE = 96 / 2.54 / 60;

interface GraphCanvasProps {
  /** Double-click on the graph (the Select tool turns an object into one pupils draw). */
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  document: GraphEditorDocument;
  /** 0 fits the graph to its space; 1 draws it at print size. */
  zoom?: number;
  disabled?: boolean;
  tool: DrawingTool;
  onCommit: (document: GraphEditorDocument) => void;
  onSelect: (id: string | null) => void;
  onAxisAdjust: (
    axis: "x" | "y",
    end: "negative" | "positive",
    delta: -1 | 1,
  ) => void;
  /** Told the scale the graph is drawn at, so the page can show it beside the zoom. */
  onScale?: (scale: number) => void;
}

type ObjectDrag = {
  kind: "point" | "start" | "end" | "label" | "name";
  objectId: string;
  baseDocument: GraphEditorDocument;
  pointerId: number;
};

type SegmentDrag = {
  kind: "new-segment";
  start: Coordinate;
  current: Coordinate;
  pointerId: number;
};

type DragState = ObjectDrag | SegmentDrag;

const EDITOR_UNITS_PER_CENTIMETRE = 60;
const AXIS_LABEL_FONT_SIZE = pointsToDiagramUnits(
  AXIS_LABEL_FONT_POINTS,
  EDITOR_UNITS_PER_CENTIMETRE,
);
/** A cross's stroke in print units, as the export draws it, for its reach past the arms. */
const GRID_STROKE_POINTS_UNITS = pointsToDiagramUnits(GRID_STROKE_POINTS, 100);
const AXIS_ARROW_EXTENSION =
  12 + EDITOR_UNITS_PER_CENTIMETRE * AXIS_ARROW_EXTRA_SHAFT_CENTIMETRES;
/** The editor draws at 60 units per cm; print geometry is 100 units per cm. */
const FROM_PRINT = EDITOR_UNITS_PER_CENTIMETRE / 100;
const NAME_SUBSCRIPT_FONT_SIZE =
  AXIS_LABEL_FONT_SIZE * (NAME_SUBSCRIPT_FONT_POINTS / AXIS_LABEL_FONT_POINTS);
const STRAIGHT_DASH_ARRAY = [
  EDITOR_UNITS_PER_CENTIMETRE * STRAIGHT_DASH_LENGTH_CENTIMETRES,
  EDITOR_UNITS_PER_CENTIMETRE * STRAIGHT_DASH_GAP_CENTIMETRES,
]
  .map((value) => Number(value.toFixed(3)))
  .join(" ");
interface AxisTickLabelProps {
  text: string;
  x: number;
  baseline: number;
  textAnchor?: "start" | "middle" | "end";
  origin?: boolean;
}

function AxisTickLabel({
  text,
  x,
  baseline,
  textAnchor = "middle",
  origin = false,
}: AxisTickLabelProps) {
  const width = axisLabelBoxWidth(text, AXIS_LABEL_FONT_SIZE);
  const height = axisLabelBoxHeight(AXIS_LABEL_FONT_SIZE);
  const rectX =
    textAnchor === "middle"
      ? x - width / 2
      : textAnchor === "end"
        ? x - width
        : x;
  const rectY = baseline - AXIS_LABEL_FONT_SIZE * 0.82;
  return (
    <g className={`axis-number${origin ? " axis-number--origin" : ""}`}>
      <rect
        x={rectX}
        y={rectY}
        width={width}
        height={height}
        rx={AXIS_LABEL_FONT_SIZE * 0.05}
      />
      <text
        x={x}
        y={baseline}
        textAnchor={textAnchor}
      >
        {text}
      </text>
    </g>
  );
}

function editorAutoLabelPosition(
  object: StraightObject,
  layout: SvgLayout,
): Coordinate {
  const visible = visibleStraightPoints(object, layout.bounds);
  if (!visible) return { x: layout.plotLeft + 12, y: layout.plotTop + 28 };
  const start = coordinateToSvg(visible[0], layout);
  const end = coordinateToSvg(visible[1], layout);
  return {
    x: Math.min(
      layout.plotRight - 108,
      Math.max(layout.plotLeft + 8, start.x + (end.x - start.x) * 0.72),
    ),
    y: Math.min(
      layout.plotBottom - 8,
      Math.max(layout.plotTop + 24, start.y + (end.y - start.y) * 0.72 - 13),
    ),
  };
}

function objectHitIds(
  document: GraphEditorDocument,
  layout: SvgLayout,
  pointer: Coordinate,
): string[] {
  const hits: Array<{ id: string; distance: number; priority: number }> = [];
  for (const object of document.objects) {
    if (object.kind === "point") {
      if (!pointInBounds(object.position, layout.bounds)) continue;
      const point = coordinateToSvg(object.position, layout);
      const distance = Math.sqrt(squaredDistance(pointer, point));
      if (distance <= 17) hits.push({ id: object.id, distance, priority: 0 });
      continue;
    }
    if (object.kind === "polygon") {
      const corners = object.vertices.map((p) => coordinateToSvg(p, layout));
      const edge = Math.min(...corners.map((p, i) => pointToSegmentDistance(pointer, p, corners[(i + 1) % corners.length])));
      // Inside the shape counts too, so a shape is easy to pick on a touch screen.
      let inside = false;
      for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
        const a = corners[i], b = corners[j];
        if (a.y > pointer.y !== b.y > pointer.y && pointer.x < ((b.x - a.x) * (pointer.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
      }
      if (edge <= 13 || inside) hits.push({ id: object.id, distance: inside ? Math.min(edge, 13) : edge, priority: 2 });
      continue;
    }
    if (object.kind === "region") {
      // Anywhere inside the region picks it; lines and points on top still win.
      const corners = regionPolygon(regionHalfPlanes(object), layout.bounds).map((p) => coordinateToSvg(p, layout));
      let inside = false;
      for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
        const a = corners[i], b = corners[j];
        if (a.y > pointer.y !== b.y > pointer.y && pointer.x < ((b.x - a.x) * (pointer.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
      }
      if (inside) hits.push({ id: object.id, distance: 13, priority: 3 });
      continue;
    }
    if (object.kind === "curve") {
      // Near any piece of the curve picks it (smooth curves are close enough to their chords here).
      // Only the parts on the grid can be picked, as only they are drawn.
      const pieces = object.points.slice(1).flatMap((p, i) => {
        const visible = clipSegment(object.points[i], p, layout.bounds);
        return visible ? [visible.map((q) => coordinateToSvg(q, layout))] : [];
      });
      const distance = Math.min(Infinity, ...pieces.map(([a, b]) => pointToSegmentDistance(pointer, a, b)));
      if (distance <= 13) hits.push({ id: object.id, distance, priority: 1 });
      continue;
    }
    if (object.kind === "circle") {
      // Near the circle's edge picks it (true to both scales).
      const c = coordinateToSvg(object.centre, layout);
      const rx = (object.radius / document.axes.x.unitsPerSquare) * layout.square, ry = (object.radius / document.axes.y.unitsPerSquare) * layout.square;
      const dx = (pointer.x - c.x) / rx, dy = (pointer.y - c.y) / ry;
      const distance = Math.abs(Math.hypot(dx, dy) - 1) * Math.min(rx, ry);
      if (distance <= 13) hits.push({ id: object.id, distance, priority: 1 });
      continue;
    }
    if (object.kind === "function") {
      // Near any short piece of the curve on the grid picks it.
      const pieces = functionRuns(object, layout.bounds).flatMap((run) =>
        run.slice(1).flatMap((p, i) => {
          const visible = clipSegment(run[i], p, layout.bounds);
          return visible ? [visible.map((q) => coordinateToSvg(q, layout))] : [];
        }),
      );
      const distance = Math.min(Infinity, ...pieces.map(([a, b]) => pointToSegmentDistance(pointer, a, b)));
      if (distance <= 13) hits.push({ id: object.id, distance, priority: 1 });
      continue;
    }
    if (object.kind === "reading") {
      if (!pointInBounds(object.at, layout.bounds)) continue;
      const legs = readingLegs(object, axesCrossing(document.axes)).map((l) => [coordinateToSvg(l.start, layout), coordinateToSvg(l.end, layout)] as const);
      const distance = Math.min(Infinity, ...legs.map(([a, b]) => pointToSegmentDistance(pointer, a, b)));
      if (distance <= 13) hits.push({ id: object.id, distance, priority: 1 });
      continue;
    }
    const visible = visibleStraightPoints(object, layout.bounds);
    if (!visible) continue;
    const start = coordinateToSvg(visible[0], layout);
    const end = coordinateToSvg(visible[1], layout);
    const distance = pointToSegmentDistance(pointer, start, end);
    if (distance <= 13) hits.push({ id: object.id, distance, priority: 1 });
  }
  return hits
    .sort(
      (first, second) =>
        first.priority - second.priority || first.distance - second.distance,
    )
    .map((hit) => hit.id);
}

function Cross({
  point,
  size = 8,
  className = "graph-point",
}: {
  point: Coordinate;
  size?: number;
  className?: string;
}) {
  return (
    <path
      className={className}
      d={`M ${point.x - size} ${point.y - size} L ${point.x + size} ${point.y + size} M ${point.x - size} ${point.y + size} L ${point.x + size} ${point.y - size}`}
    />
  );
}

export function GraphCanvas({
  document,
  tool,
  onCommit,
  onSelect,
  onAxisAdjust,
  disabled = false,
  zoom = 0,
  onScale,
  onDoubleClick,
}: GraphCanvasProps) {
  const fontFamily =
    document.styleProfile === "portable-v1"
      ? PORTABLE_FONT_FAMILY
      : MATHS_FONT_FAMILY;
  const svgRef = useRef<SVGSVGElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(1000);
  const [availableHeight, setAvailableHeight] = useState(700);
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      if (element.clientWidth) setAvailableWidth(element.clientWidth);
      if (element.clientHeight) setAvailableHeight(element.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const dragRef = useRef<DragState | null>(null);
  const cycleRef = useRef<{ key: string; index: number }>({
    key: "",
    index: 0,
  });
  const [draftDocument, setDraftDocument] = useState<GraphEditorDocument | null>(
    null,
  );
  const [segmentPreview, setSegmentPreview] = useState<SegmentDrag | null>(
    null,
  );
  const visibleDocument = draftDocument ?? document;
  const layout = useMemo(() => createEditorLayout(document), [document]);
  const selected = getSelectedObject(visibleDocument);
  const metrics = getExportMetrics(document);
  const paper = {
    x: layout.plotLeft - metrics.layout.plotLeft * 0.6,
    y: layout.plotTop - metrics.layout.plotTop * 0.6,
    width: metrics.width * 0.6,
    height: metrics.height * 0.6,
  };
  const compact = availableWidth < 600;
  // Fit stops at 400% of print size, the largest step the zoom offers.
  const scale =
    zoom * PRINT_SIZE ||
    Math.min(
      4 * PRINT_SIZE,
      fitResource(
        paper.width,
        paper.height,
        availableWidth,
        availableHeight,
        compact ? 168 : 264,
        144,
      ),
    );
  useEffect(() => onScale?.(scale / PRINT_SIZE), [onScale, scale]);
  const paperWidth = paper.width * scale,
    paperHeight = paper.height * scale;
  // Small/tall fitted artwork still needs room for native-size button pairs.
  const controlWidth = Math.max(paperWidth, 104),
    controlHeight = Math.max(paperHeight, compact ? 112 : 64),
    gutter = compact ? 72 : 120,
    left = gutter + (controlWidth - paperWidth) / 2,
    top = 72 + (controlHeight - paperHeight) / 2;
  const axisX =
    left + (coordinateToSvg(axisOrigin(document), layout).x - paper.x) * scale;
  const axisY =
    top + (coordinateToSvg(axisOrigin(document), layout).y - paper.y) * scale;
  const controls = (
    [
      ["x", "negative"],
      ["x", "positive"],
      ["y", "positive"],
      ["y", "negative"],
    ] as const
  ).map(([axis, end]) => ({
    axis,
    end,
    x:
      axis === "x"
        ? end === "negative"
          ? 8
          : gutter + controlWidth + 12
        : Math.max(gutter, Math.min(gutter + controlWidth - 100, axisX - 50)),
    y:
      axis === "x"
        ? Math.max(
            72,
            Math.min(72 + controlHeight - (compact ? 100 : 48), axisY - 24),
          )
        : end === "positive"
          ? 8
          : 72 + controlHeight + 16,
  }));
  const origin = coordinateToSvg(axisOrigin(document), layout);
  const horizontalSquares =
    document.axes.x.negativeSquares + document.axes.x.positiveSquares;
  const verticalSquares =
    document.axes.y.negativeSquares + document.axes.y.positiveSquares;

  function svgPointer(event: ReactPointerEvent<SVGSVGElement>): Coordinate {
    const matrix = event.currentTarget.getScreenCTM();
    if (matrix)
      return new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: paper.x + ((event.clientX - rect.left) / rect.width) * paper.width,
      y: paper.y + ((event.clientY - rect.top) / rect.height) * paper.height,
    };
  }

  function graphPointer(
    event: ReactPointerEvent<SVGSVGElement>,
    snap = true,
  ): Coordinate {
    const raw = clampToBounds(
      svgToCoordinate(svgPointer(event), layout),
      layout.bounds,
    );
    return snap
      ? snapCoordinate(
          raw,
          document.axes.x.unitsPerSquare,
          document.axes.y.unitsPerSquare,
          gridDivisions(document),
          axisOrigin(document),
        )
      : raw;
  }

  function capturePointer(pointerId: number) {
    try {
      svgRef.current?.setPointerCapture(pointerId);
    } catch {
      /* Pointer capture is best effort. */
    }
  }

  function startObjectDrag(
    event: ReactPointerEvent<SVGElement>,
    kind: ObjectDrag["kind"],
    objectId: string,
  ) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(objectId);
    dragRef.current = {
      kind,
      objectId,
      baseDocument: { ...document, selectedObjectId: objectId },
      pointerId: event.pointerId,
    };
    capturePointer(event.pointerId);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (disabled || event.button !== 0) return;
    const pointer = svgPointer(event);
    const coordinate = graphPointer(event);
    if (tool === "segment") {
      const drag: SegmentDrag = {
        kind: "new-segment",
        start: coordinate,
        current: coordinate,
        pointerId: event.pointerId,
      };
      dragRef.current = drag;
      setSegmentPreview(drag);
      capturePointer(event.pointerId);
      return;
    }
    if (tool === "point") {
      const point: GraphObject = {
        id: makeId("point"),
        kind: "point",
        position: coordinate,
      };
      onCommit({
        ...document,
        objects: [...document.objects, point],
        selectedObjectId: point.id,
      });
      return;
    }

    const hits = objectHitIds(document, layout, pointer);
    if (!hits.length) {
      onSelect(null);
      return;
    }
    const key = `${Math.round(pointer.x / 8)}:${Math.round(pointer.y / 8)}:${hits.join(",")}`;
    // The second press of a double-click keeps the object the first press chose, so the double-click acts on it.
    const index =
      cycleRef.current.key === key
        ? event.detail > 1
          ? cycleRef.current.index
          : (cycleRef.current.index + 1) % hits.length
        : 0;
    cycleRef.current = { key, index };
    const id = hits[index];
    onSelect(id);
    const hitObject = getObjectById(document, id);
    if (hitObject?.kind === "point") {
      dragRef.current = {
        kind: "point",
        objectId: id,
        baseDocument: { ...document, selectedObjectId: id },
        pointerId: event.pointerId,
      };
      capturePointer(event.pointerId);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === "new-segment") {
      const updated = { ...drag, current: graphPointer(event) };
      dragRef.current = updated;
      setSegmentPreview(updated);
      return;
    }

    const existing = getObjectById(drag.baseDocument, drag.objectId);
    if (!existing) return;
    if (drag.kind === "name") {
      setDraftDocument(
        updateObject(drag.baseDocument, {
          ...existing,
          namePosition: graphPointer(event, false),
        }),
      );
      return;
    }
    if (drag.kind === "point" && existing.kind === "point") {
      setDraftDocument(
        updateObject(drag.baseDocument, {
          ...existing,
          position: graphPointer(event),
        }),
      );
      return;
    }
    if (existing.kind !== "straight") return;
    if (drag.kind === "label") {
      setDraftDocument(
        updateObject(drag.baseDocument, {
          ...existing,
          equationLabelPosition: graphPointer(event, false),
        }),
      );
      return;
    }
    const coordinate = graphPointer(event);
    const updated =
      drag.kind === "start"
        ? { ...existing, start: coordinate, equationLabelPosition: undefined }
        : { ...existing, end: coordinate, equationLabelPosition: undefined };
    setDraftDocument(updateObject(drag.baseDocument, updated));
  }

  function finishPointer(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === "new-segment") {
      if (squaredDistance(drag.start, drag.current) > 1e-8) {
        const object: StraightObject = {
          id: makeId(),
          kind: "straight",
          display: "segment",
          strokeStyle: "solid",
          start: drag.start,
          end: drag.current,
          equationVisible: false,
        };
        onCommit({
          ...document,
          objects: [...document.objects, object],
          selectedObjectId: object.id,
        });
      }
    } else if (draftDocument) {
      const changed = getObjectById(draftDocument, drag.objectId);
      if (
        changed?.kind !== "straight" ||
        squaredDistance(changed.start, changed.end) > 1e-8
      )
        onCommit(draftDocument);
    }
    dragRef.current = null;
    setDraftDocument(null);
    setSegmentPreview(null);
    try {
      svgRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* Already released. */
    }
  }

  const placement = axisTextPlacement(document);
  const xLabels = [];
  const xNumberBaseline = origin.y + placement.xNumberDrop * FROM_PRINT;
  // A cross on or beside an axis would print over a number, so the number moves clear of it,
  // away from the axis (the export does the same, svg.ts axesMarkup).
  // Hidden answer points are left out, so the preview places numbers as the pupil copy prints them.
  const crossReach = (14 + GRID_STROKE_POINTS_UNITS) * FROM_PRINT;
  const crosses = visibleDocument.objects.flatMap((o) => {
    if (o.kind !== "point" || o.answerOnly || !pointInBounds(o.position, layout.bounds)) return [];
    const p = coordinateToSvg(o.position, layout);
    return [{ l: p.x - crossReach, r: p.x + crossReach, t: p.y - crossReach, b: p.y + crossReach }];
  });
  // The same boxes AxisTickLabel draws.
  const labelHeight = axisLabelBoxHeight(AXIS_LABEL_FONT_SIZE);
  const hits = (l: number, r: number, t: number, b: number) => crosses.filter((c) => c.l < r && c.r > l && c.t < b && c.b > t);
  for (const tick of axisTicks(document, "x")) {
    const x = layout.plotLeft + tick.index * layout.square;
    const half = axisLabelBoxWidth(tick.label, AXIS_LABEL_FONT_SIZE) / 2;
    const top = xNumberBaseline - AXIS_LABEL_FONT_SIZE * 0.82;
    const hit = hits(x - half, x + half, top, top + labelHeight);
    xLabels.push(
      <AxisTickLabel
        key={tick.index}
        text={tick.label}
        x={x}
        baseline={xNumberBaseline + (hit.length ? Math.max(...hit.map((c) => c.b + 2.4 - top)) : 0)}
      />,
    );
  }
  const yLabels = [];
  const yNumberX =
    origin.x - EDITOR_UNITS_PER_CENTIMETRE * Y_AXIS_LABEL_GAP_CENTIMETRES;
  for (const tick of axisTicks(document, "y").reverse()) {
    const baseline = layout.plotBottom - tick.index * layout.square + AXIS_LABEL_FONT_SIZE * 0.34;
    const width = axisLabelBoxWidth(tick.label, AXIS_LABEL_FONT_SIZE);
    const top = baseline - AXIS_LABEL_FONT_SIZE * 0.82;
    const hit = hits(yNumberX - width, yNumberX, top, top + labelHeight);
    yLabels.push(
      <AxisTickLabel
        key={tick.index}
        text={tick.label}
        x={yNumberX - (hit.length ? Math.max(...hit.map((c) => yNumberX - (c.l - 2.4))) : 0)}
        baseline={baseline}
        textAnchor="end"
      />,
    );
  }
  // The y-axis reaches far enough above a top number for the arrowhead to clear it.
  const yArrowExtension = Math.max(
    AXIS_ARROW_EXTENSION,
    axisTicks(document, "y").some((t) => t.index === document.axes.y.negativeSquares + document.axes.y.positiveSquares)
      ? AXIS_LABEL_FONT_SIZE * 0.48 + 2.4 + (document.lines === "bold" ? 22.5 : 15) * 0.85
      : 0,
  );

  return (
    <div ref={stage} className="graph-stage editor-stage" data-tool={tool} data-options-anchor onDoubleClick={onDoubleClick}>
      <div
        className={`graph-board${compact ? " is-compact" : ""}`}
        style={{
          width: controlWidth + (compact ? 144 : 240),
          height: controlHeight + 144,
        }}
      >
        <svg
          ref={svgRef}
          className={document.lines === "bold" ? "graph-canvas graph-canvas--bold" : "graph-canvas"}
          data-style-profile={document.styleProfile ?? "legacy"}
          viewBox={`${paper.x} ${paper.y} ${paper.width} ${paper.height}`}
          style={{ left, top, width: paperWidth, height: paperHeight }}
          preserveAspectRatio="xMidYMid meet"
          role="application"
          aria-label="Interactive coordinate graph. Choose a drawing tool, then use the graph area."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
        >
          <title>Interactive 1 cm square coordinate grid</title>
          <defs>
            <clipPath id="editor-plot-clip">
              <rect
                x={layout.plotLeft}
                y={layout.plotTop}
                width={layout.plotRight - layout.plotLeft}
                height={layout.plotBottom - layout.plotTop}
              />
            </clipPath>
            {/* Lines on the grid's edge show at full weight, as they print. */}
            <clipPath id="editor-line-clip">
              <rect
                x={layout.plotLeft - plotClipBleed(document.lines)}
                y={layout.plotTop - plotClipBleed(document.lines)}
                width={layout.plotRight - layout.plotLeft + 2 * plotClipBleed(document.lines)}
                height={layout.plotBottom - layout.plotTop + 2 * plotClipBleed(document.lines)}
              />
            </clipPath>
            <marker
              id="editor-axis-arrow"
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerUnits="userSpaceOnUse"
              markerWidth={document.lines === "bold" ? 22.5 : 15}
              markerHeight={document.lines === "bold" ? 22.5 : 15}
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          <rect
            className="canvas-paper"
            x={paper.x}
            y={paper.y}
            width={paper.width}
            height={paper.height}
          />
          {gridDivisions(document) > 1 && (
            <g className="grid-lines grid-lines--fine">
              {Array.from(
                { length: horizontalSquares * gridDivisions(document) },
                (_, index) =>
                  index % gridDivisions(document) === 0 ? null : (
                    <line
                      key={`fx-${index}`}
                      x1={layout.plotLeft + (index * layout.square) / gridDivisions(document)}
                      y1={layout.plotTop}
                      x2={layout.plotLeft + (index * layout.square) / gridDivisions(document)}
                      y2={layout.plotBottom}
                    />
                  ),
              )}
              {Array.from(
                { length: verticalSquares * gridDivisions(document) },
                (_, index) =>
                  index % gridDivisions(document) === 0 ? null : (
                    <line
                      key={`fy-${index}`}
                      x1={layout.plotLeft}
                      y1={layout.plotTop + (index * layout.square) / gridDivisions(document)}
                      x2={layout.plotRight}
                      y2={layout.plotTop + (index * layout.square) / gridDivisions(document)}
                    />
                  ),
              )}
            </g>
          )}
          <g className="graph-regions" clipPath="url(#editor-plot-clip)">
            {visibleDocument.objects.map((object) => {
              if (object.kind !== "region") return null;
              const ring = (points: Coordinate[]) =>
                points.length ? `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")} Z` : "";
              const polygon = ring(
                regionPolygon(regionHalfPlanes(object), layout.bounds).map((p) => coordinateToSvg(p, layout)),
              );
              const plot = `M ${layout.plotLeft} ${layout.plotTop} L ${layout.plotRight} ${layout.plotTop} L ${layout.plotRight} ${layout.plotBottom} L ${layout.plotLeft} ${layout.plotBottom} Z`;
              const d = object.shade === "wanted" ? polygon : `${plot} ${polygon}`.trim();
              if (!d) return null;
              return (
                <path
                  key={object.id}
                  data-object-id={object.id}
                  className={`graph-region${object.answerOnly ? " graph-region--answer" : ""}${object.id === visibleDocument.selectedObjectId ? " graph-region--selected" : ""}`}
                  d={d}
                  fillRule="evenodd"
                />
              );
            })}
          </g>
          {!isSketch(document) && (
          <g className={gridDivisions(document) > 1 ? "grid-lines grid-lines--tiered" : "grid-lines"}>
            {Array.from({ length: horizontalSquares + 1 }, (_, index) => (
              <line
                key={`x-${index}`}
                className={(index - document.axes.x.negativeSquares) % 2 === 0 ? "grid-line--heavy" : undefined}
                x1={layout.plotLeft + index * layout.square}
                y1={layout.plotTop}
                x2={layout.plotLeft + index * layout.square}
                y2={layout.plotBottom}
              />
            ))}
            {Array.from({ length: verticalSquares + 1 }, (_, index) => (
              <line
                key={`y-${index}`}
                className={(verticalSquares - index - document.axes.y.negativeSquares) % 2 === 0 ? "grid-line--heavy" : undefined}
                x1={layout.plotLeft}
                y1={layout.plotTop + index * layout.square}
                x2={layout.plotRight}
                y2={layout.plotTop + index * layout.square}
              />
            ))}
          </g>
          )}
          <g className="graph-axes">
            <line
              x1={layout.plotLeft}
              y1={origin.y}
              x2={layout.plotRight + AXIS_ARROW_EXTENSION}
              y2={origin.y}
              markerEnd="url(#editor-axis-arrow)"
            />
            <line
              x1={origin.x}
              y1={layout.plotBottom}
              x2={origin.x}
              y2={layout.plotTop - yArrowExtension}
              markerEnd="url(#editor-axis-arrow)"
            />
          </g>
          {/* Axis numbers sit under every plotted line, as Edexcel prints lines straight through them. */}
          <g className="axis-labels">
            {xLabels}
            {yLabels}
            {sharedOriginLabel(document) && (
              <AxisTickLabel
                text={document.originLabel === "0" ? "0" : "𝑂"}
                x={origin.x - AXIS_LABEL_FONT_SIZE * 0.38}
                baseline={xNumberBaseline}
                textAnchor="end"
                origin={document.originLabel === "0"}
              />
            )}
            {axisLetter("x", document.axes.x) && (
              <text
                className="axis-name axis-name--x"
                x={layout.plotRight + 29}
                y={xNumberBaseline}
                fontFamily={fontFamily}
              >
                {axisLetter("x", document.axes.x)}
              </text>
            )}
            {axisLetter("y", document.axes.y) && (
              <text
                className="axis-name axis-name--y"
                x={Math.min(
                  origin.x - EDITOR_UNITS_PER_CENTIMETRE * axisNameYGapCentimetres(document),
                  // The y letter stays clear of the (longer, possibly bold) arrowhead beside it.
                  origin.x - headHalfWidthAt(18, yArrowExtension, document.lines === "bold" ? 22.5 : 15),
                )}
                y={layout.plotTop - 18}
                textAnchor="end"
                fontFamily={fontFamily}
              >
                {axisLetter("y", document.axes.y)}
              </text>
            )}
            {placement.xTitle && (
              <text
                className="axis-title axis-title--x"
                textAnchor="middle"
                fontFamily={fontFamily}
              >
                {placement.xTitle.lines.map((line, index) => (
                  <tspan
                    key={index}
                    x={(layout.plotLeft + layout.plotRight) / 2}
                    y={
                      layout.plotBottom +
                      (placement.xTitle!.baselineBelowPlot +
                        index * placement.lineHeight) *
                        FROM_PRINT
                    }
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            )}
            {placement.yTitle && (
              <text className="axis-title axis-title--y" fontFamily={fontFamily}>
                {placement.yTitle.lines.map((line, index) => (
                  <tspan
                    key={index}
                    x={layout.plotLeft + placement.yTitle!.leftFromPlotLeft * FROM_PRINT}
                    y={
                      placement.yTitle!.firstBaselineFromPlotTop !== undefined
                        ? // Above the axis, as the print copy places it.
                          layout.plotTop +
                          (placement.yTitle!.firstBaselineFromPlotTop + index * placement.lineHeight) * FROM_PRINT
                        : (layout.plotTop + layout.plotBottom) / 2 +
                          ((index - (placement.yTitle!.lines.length - 1) / 2) *
                            placement.lineHeight) *
                            FROM_PRINT +
                          AXIS_LABEL_FONT_SIZE * 0.34
                    }
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            )}
          </g>
          <g clipPath="url(#editor-line-clip)">
            {visibleDocument.objects.flatMap((object) =>
              object.kind === "region" && object.boundaries
                ? regionBoundaries(regionHalfPlanes(object), layout.bounds).map((b, i) => {
                    const start = coordinateToSvg(b.start, layout);
                    const end = coordinateToSvg(b.end, layout);
                    return (
                      <line
                        key={`${object.id}-${i}`}
                        className={`graph-straight graph-region-boundary${object.answerOnly ? " graph-straight--answer" : ""}${object.id === visibleDocument.selectedObjectId ? " graph-straight--selected" : ""}`}
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        strokeDasharray={b.strict ? STRAIGHT_DASH_ARRAY : undefined}
                      />
                    );
                  })
                : [],
            )}
            {visibleDocument.objects
              .filter(
                (object): object is PolygonObject =>
                  object.kind === "polygon" &&
                  polygonVisible(object, layout.bounds),
              )
              .map((object) => (
                <polygon
                  key={object.id}
                  className={`graph-polygon${object.answerOnly ? " graph-polygon--answer" : ""}${object.shaded ? " graph-polygon--shaded" : ""}${object.id === visibleDocument.selectedObjectId ? " graph-polygon--selected" : ""}`}
                  data-object-id={object.id}
                  points={object.vertices
                    .map((p) => coordinateToSvg(p, layout))
                    .map((p) => `${p.x},${p.y}`)
                    .join(" ")}
                />
              ))}
            {visibleDocument.objects
              .filter(
                (object): object is StraightObject =>
                  object.kind === "straight",
              )
              .map((object) => {
                const visible = visibleStraightPoints(object, layout.bounds);
                if (!visible) return null;
                const start = coordinateToSvg(visible[0], layout);
                const end = coordinateToSvg(visible[1], layout);
                const selected = object.id === visibleDocument.selectedObjectId;
                const line = (
                  <line
                    key={object.id}
                    className={`graph-straight${object.answerOnly ? " graph-straight--answer" : ""}${selected ? " graph-straight--selected" : ""}`}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    strokeDasharray={
                      object.strokeStyle === "dashed"
                        ? STRAIGHT_DASH_ARRAY
                        : undefined
                    }
                  />
                );
                const arrowEnds = vectorArrowEnds(object, layout.bounds);
                if (!arrowEnds) return line;
                const scale = document.lines === "bold" ? 1.5 : 1;
                return (
                  <g key={object.id}>
                    {line}
                    <path
                      className={`graph-vector-arrow${object.answerOnly ? " graph-vector-arrow--answer" : ""}${selected ? " graph-vector-arrow--selected" : ""}`}
                      d={arrowheadPath(
                        coordinateToSvg(arrowEnds[0], layout),
                        coordinateToSvg(arrowEnds[1], layout),
                        object.arrow ?? "end",
                        pointsToDiagramUnits(VECTOR_ARROWHEAD_POINTS.length, EDITOR_UNITS_PER_CENTIMETRE) * scale,
                        pointsToDiagramUnits(VECTOR_ARROWHEAD_POINTS.halfWidth, EDITOR_UNITS_PER_CENTIMETRE) * scale,
                      )}
                    />
                  </g>
                );
              })}
            {visibleDocument.objects.map((object) => {
              const selected = object.id === visibleDocument.selectedObjectId;
              const cls = `graph-straight${object.answerOnly ? " graph-straight--answer" : ""}${selected ? " graph-straight--selected" : ""}`;
              if (object.kind === "circle") {
                const c = coordinateToSvg(object.centre, layout);
                return (
                  <ellipse
                    key={object.id}
                    className={`${cls} graph-circle`}
                    cx={c.x}
                    cy={c.y}
                    rx={(object.radius / document.axes.x.unitsPerSquare) * layout.square}
                    ry={(object.radius / document.axes.y.unitsPerSquare) * layout.square}
                    strokeDasharray={object.strokeStyle === "dashed" ? STRAIGHT_DASH_ARRAY : undefined}
                  />
                );
              }
              if (object.kind === "function") {
                return (
                  <path
                    key={object.id}
                    className={`${cls} graph-function`}
                    d={functionPathData(object, layout.bounds, (p) => coordinateToSvg(p, layout))}
                    strokeLinejoin="round"
                    strokeDasharray={object.strokeStyle === "dashed" ? STRAIGHT_DASH_ARRAY : undefined}
                  />
                );
              }
              if (object.kind === "curve") {
                const pts = object.points.map((p) => coordinateToSvg(p, layout));
                return (
                  <path
                    key={object.id}
                    className={`${cls} graph-curve`}
                    d={object.smooth ? smoothCurvePath(pts) : `M ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")}`}
                    strokeLinejoin="round"
                    strokeDasharray={object.strokeStyle === "dashed" ? STRAIGHT_DASH_ARRAY : undefined}
                  />
                );
              }
              if (object.kind !== "reading" || !pointInBounds(object.at, layout.bounds)) return null;
              const scale = document.lines === "bold" ? 1.5 : 1;
              const length = pointsToDiagramUnits(READING_ARROWHEAD_POINTS.length, EDITOR_UNITS_PER_CENTIMETRE) * scale;
              const half = pointsToDiagramUnits(READING_ARROWHEAD_POINTS.halfWidth, EDITOR_UNITS_PER_CENTIMETRE) * scale;
              return (
                <g key={object.id} className="graph-reading">
                  {readingLegs(object, axesCrossing(document.axes)).map((leg, i) => {
                    const a = coordinateToSvg(leg.start, layout), b = coordinateToSvg(leg.end, layout);
                    const d = Math.hypot(b.x - a.x, b.y - a.y);
                    const stop = leg.head && d > length ? { x: b.x - ((b.x - a.x) / d) * length, y: b.y - ((b.y - a.y) / d) * length } : b;
                    return (
                      <g key={i}>
                        <line className={cls} x1={a.x} y1={a.y} x2={stop.x} y2={stop.y} strokeDasharray={STRAIGHT_DASH_ARRAY} />
                        {leg.head && (
                          <path
                            className={`graph-vector-arrow${object.answerOnly ? " graph-vector-arrow--answer" : ""}${selected ? " graph-vector-arrow--selected" : ""}`}
                            d={arrowheadPath(a, b, "end", length, half)}
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
          <g clipPath="url(#editor-plot-clip)">
            {visibleDocument.objects
              .filter(
                (object): object is PointObject =>
                  object.kind === "point" &&
                  pointInBounds(object.position, layout.bounds),
              )
              .map((object) => (
                <Cross
                  key={object.id}
                  point={coordinateToSvg(object.position, layout)}
                  className={`graph-point${object.answerOnly ? " graph-point--answer" : ""}${object.id === visibleDocument.selectedObjectId ? " graph-point--selected" : ""}`}
                />
              ))}
            {segmentPreview && (
              <line
                className="segment-preview"
                x1={coordinateToSvg(segmentPreview.start, layout).x}
                y1={coordinateToSvg(segmentPreview.start, layout).y}
                x2={coordinateToSvg(segmentPreview.current, layout).x}
                y2={coordinateToSvg(segmentPreview.current, layout).y}
              />
            )}
          </g>
          <g className="equation-labels">
            {visibleDocument.objects
              .filter(
                (object): object is StraightObject =>
                  object.kind === "straight" && object.equationVisible,
              )
              .map((object) => {
                if (!visibleStraightPoints(object, layout.bounds)) return null;
                const position = object.equationLabelPosition
                  ? coordinateToSvg(object.equationLabelPosition, layout)
                  : editorAutoLabelPosition(object, layout);
                return (
                  <text
                    key={object.id}
                    className={
                      object.id === visibleDocument.selectedObjectId
                        ? "selected"
                        : ""
                    }
                    x={position.x}
                    y={position.y}
                    onPointerDown={(event) =>
                      startObjectDrag(event, "label", object.id)
                    }
                  >
                    {equationForObject(object)}
                  </text>
                );
              })}
          </g>
          <g className="gradient-triangles">
            {visibleDocument.objects.flatMap((object) => {
              if (object.kind !== "straight" || !object.gradientTriangle) return [];
              const corners = gradientTriangleCorners(object);
              if (!corners || Math.abs(corners.end.y - corners.corner.y) < 1e-12) return [];
              const [a, b, e] = [corners.start, corners.corner, corners.end].map((p) => coordinateToSvg(p, layout));
              const values = gradientTriangleValues(object)!;
              const mode = object.gradientTriangle.labels;
              const inside = [corners.start, corners.corner, corners.end].every((p) => pointInBounds(p, layout.bounds));
              const place = gradientLabelPlacement(a, b, e, layout, AXIS_LABEL_FONT_SIZE, values.run, mode === "blank" ? GRADIENT_BLANK : values.rise, axisNumberBands(document, layout, AXIS_LABEL_FONT_SIZE));
              // The editor shows blank labels' values in the answer colour, as it shows hidden answers.
              const answer = object.answerOnly || mode === "blank";
              return [
                <g key={object.id} className={`gradient-triangle${object.answerOnly ? " gradient-triangle--answer" : ""}`} data-object-id={object.id}>
                  <path clipPath="url(#editor-line-clip)" d={`M ${a.x} ${a.y} H ${b.x} V ${e.y}`} strokeDasharray={STRAIGHT_DASH_ARRAY} />
                  {mode && inside && (
                    <g className={`point-label${answer ? " point-label--answer" : ""}`} fontFamily={fontFamily} fontSize={AXIS_LABEL_FONT_SIZE}>
                      {["text-halo", undefined].map((halo) => (
                        <g key={halo ?? "text"} aria-hidden={halo ? true : undefined}>
                          <text className={halo} x={place.run.x} y={place.run.y} textAnchor={place.run.anchor}>{values.run}</text>
                          <text className={halo} x={place.rise.x} y={place.rise.y} textAnchor={place.rise.anchor}>{values.rise}</text>
                        </g>
                      ))}
                    </g>
                  )}
                </g>,
              ];
            })}
          </g>
          <g className="point-labels" fontFamily={fontFamily} fontSize={AXIS_LABEL_FONT_SIZE}>
            {visibleDocument.objects.flatMap((object) =>
              object.kind !== "straight" || !object.labels
                ? []
                : object.labels
                    .filter((label) => pointInBounds(label.at, layout.bounds))
                    .map((label, index) => {
                      const place = pointLabelPlacement(
                        document,
                        object,
                        label,
                        layout,
                        AXIS_LABEL_FONT_SIZE,
                        0.12 * EDITOR_UNITS_PER_CENTIMETRE,
                      );
                      return (
                        <g key={`${object.id}-${index}`} className={`point-label${object.answerOnly ? " point-label--answer" : ""}`}>
                          {["text-halo", undefined].map((halo) => (
                            <text key={halo ?? "text"} className={halo} aria-hidden={halo ? true : undefined} x={place.x} y={place.baseline} textAnchor={place.anchor}>
                              {label.text}
                            </text>
                          ))}
                        </g>
                      );
                    }),
            )}
          </g>
          <g className="object-names" fontFamily={fontFamily}>
            {visibleDocument.objects.map((object) => {
              if (!object.name) return null;
              if (
                object.kind === "point"
                  ? !pointInBounds(object.position, layout.bounds)
                  : object.kind === "polygon"
                    ? !polygonVisible(object, layout.bounds)
                  : object.kind === "region"
                    ? !regionPolygon(regionHalfPlanes(object), layout.bounds).length
                  : object.kind === "curve"
                    ? !object.points.some((p) => pointInBounds(p, layout.bounds))
                  : object.kind === "reading"
                    ? true
                  : object.kind === "circle"
                    ? !circleVisible(object, layout.bounds)
                  : object.kind === "function"
                    ? !functionNameAnchor(object, layout.bounds)
                    : !visibleStraightPoints(object, layout.bounds)
              )
                return null;
              const centre = nameCentre(object, layout, EDITOR_UNITS_PER_CENTIMETRE, document.axes)!;
              const box = nameBox(object.name, AXIS_LABEL_FONT_SIZE);
              const parts = nameParts(object.name);
              const style = nameStyle(object);
              const left = centre.x - box.width / 2 + AXIS_LABEL_FONT_SIZE * 0.08;
              const baseline = centre.y + AXIS_LABEL_FONT_SIZE * 0.34;
              return (
                <g
                  key={object.id}
                  className={`object-name${object.answerOnly ? " object-name--answer" : ""}${object.id === visibleDocument.selectedObjectId ? " selected" : ""}`}
                  onPointerDown={(event) => startObjectDrag(event, "name", object.id)}
                >
                  <rect
                    className="object-name-hit"
                    x={centre.x - box.width / 2}
                    y={centre.y - box.height / 2}
                    width={box.width}
                    height={box.height}
                  />
                  {["text-halo", undefined].map((halo) => (
                    <g key={halo ?? "text"} className={halo} aria-hidden={halo ? true : undefined}>
                      <text x={left} y={baseline} fontSize={AXIS_LABEL_FONT_SIZE}>
                        {mathsLetter(parts.letter, style)}
                        {parts.prime ? "′" : ""}
                      </text>
                      {parts.subscript && (
                        <text
                          x={left + box.letterWidth}
                          y={baseline + AXIS_LABEL_FONT_SIZE * 0.22}
                          fontSize={NAME_SUBSCRIPT_FONT_SIZE}
                        >
                          {mathsDigits(parts.subscript, style)}
                        </text>
                      )}
                    </g>
                  ))}
                </g>
              );
            })}
          </g>
          {/* Printed coordinates, A(2, 3), as the pupil copy shows them (a blank shows its dots). */}
          <g className="point-coordinates" fontFamily={fontFamily}>
            {visibleDocument.objects.map((object) => {
              if (object.kind !== "point" || !object.coordinates || !pointInBounds(object.position, layout.bounds)) return null;
              const at = coordinatesAnchor(object, layout, EDITOR_UNITS_PER_CENTIMETRE, document.axes)!;
              const text = coordinatesText(visibleDocument, object, "pupil");
              return ["text-halo", undefined].map((halo) => (
                <text
                  key={`${object.id}-${halo ?? "text"}`}
                  className={halo}
                  aria-hidden={halo ? true : undefined}
                  x={at.x}
                  y={at.y + AXIS_LABEL_FONT_SIZE * 0.34}
                  textAnchor={at.anchor}
                  fontSize={AXIS_LABEL_FONT_SIZE}
                >
                  {text}
                </text>
              ));
            })}
          </g>
          {selected?.kind === "straight" && (
            <g className="selection-handles">
              <circle
                cx={coordinateToSvg(selected.start, layout).x}
                cy={coordinateToSvg(selected.start, layout).y}
                r="8"
                onPointerDown={(event) =>
                  startObjectDrag(event, "start", selected.id)
                }
              />
              <circle
                cx={coordinateToSvg(selected.end, layout).x}
                cy={coordinateToSvg(selected.end, layout).y}
                r="8"
                onPointerDown={(event) =>
                  startObjectDrag(event, "end", selected.id)
                }
              />
            </g>
          )}
        </svg>
        {controls.map(({ axis, end, x, y }) => (
          <div
            className="graph-axis-controls"
            data-axis={axis}
            key={axis + end}
            style={{ left: x, top: y }}
            role="group"
            aria-label={end + " " + axis + " range"}
          >
            {([1, -1] as const).map((delta) => {
              const total =
                document.axes[axis].negativeSquares +
                document.axes[axis].positiveSquares;
              const count =
                document.axes[axis][
                  end === "negative" ? "negativeSquares" : "positiveSquares"
                ];
              const label =
                (delta === 1 ? "Add" : "Remove") +
                " one square at the " +
                end +
                " end of the " +
                axis +
                "-axis";
              return (
                <button
                  key={delta}
                  disabled={
                    disabled ||
                    (delta === 1
                      ? total >= AXIS_LIMITS[axis].maxTotal
                      : count === 0 || total <= AXIS_LIMITS[axis].minTotal)
                  }
                  aria-label={label}
                  title={label}
                  onClick={() => onAxisAdjust(axis, end, delta)}
                >
                  {delta === 1 ? "+" : "−"}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
