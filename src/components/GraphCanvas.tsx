import { fitResource } from "../site/useResourceFit";
import { getExportMetrics } from "../export/svg";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  AXIS_LIMITS,
  clampToBounds,
  coordinateToSvg,
  createEditorLayout,
  getObjectById,
  getSelectedObject,
  makeId,
  pointInBounds,
  pointToSegmentDistance,
  snapCoordinate,
  squaredDistance,
  svgToCoordinate,
  shouldLabelAxisSquare,
  updateObject,
  visibleStraightPoints,
} from "../domain/diagram";
import { equationForObject, formatNumber } from "../domain/equations";
import {
  AXIS_ARROW_EXTRA_SHAFT_CENTIMETRES,
  AXIS_LABEL_FONT_POINTS,
  AXIS_X_NAME,
  AXIS_Y_NAME,
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
  DiagramDocumentV1,
  DrawingTool,
  GraphObject,
  PointObject,
  StraightObject,
  SvgLayout,
} from "../domain/types";

interface GraphCanvasProps {
  document: DiagramDocumentV1;
  zoom?: number;
  disabled?: boolean;
  tool: DrawingTool;
  onCommit: (document: DiagramDocumentV1) => void;
  onSelect: (id: string | null) => void;
  onAxisAdjust: (
    axis: "x" | "y",
    end: "negative" | "positive",
    delta: -1 | 1,
  ) => void;
}

type ObjectDrag = {
  kind: "point" | "start" | "end" | "label";
  objectId: string;
  baseDocument: DiagramDocumentV1;
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
const AXIS_ARROW_EXTENSION =
  12 + EDITOR_UNITS_PER_CENTIMETRE * AXIS_ARROW_EXTRA_SHAFT_CENTIMETRES;
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
  const originTransform = origin
    ? `translate(${x} ${baseline}) skewX(-12) translate(${-x} ${-baseline})`
    : undefined;
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
        transform={originTransform}
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
  document: DiagramDocumentV1,
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
  const [draftDocument, setDraftDocument] = useState<DiagramDocumentV1 | null>(
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
  const scale =
    zoom ||
    fitResource(
      paper.width,
      paper.height,
      availableWidth,
      availableHeight,
      compact ? 168 : 264,
      144,
    );
  const paperWidth = paper.width * scale,
    paperHeight = paper.height * scale;
  // Small/tall fitted artwork still needs room for native-size button pairs.
  const controlWidth = Math.max(paperWidth, 104),
    controlHeight = Math.max(paperHeight, compact ? 112 : 64),
    gutter = compact ? 72 : 120,
    left = gutter + (controlWidth - paperWidth) / 2,
    top = 72 + (controlHeight - paperHeight) / 2;
  const axisX =
    left + (coordinateToSvg({ x: 0, y: 0 }, layout).x - paper.x) * scale;
  const axisY =
    top + (coordinateToSvg({ x: 0, y: 0 }, layout).y - paper.y) * scale;
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
  const origin = coordinateToSvg({ x: 0, y: 0 }, layout);
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
    const index =
      cycleRef.current.key === key
        ? (cycleRef.current.index + 1) % hits.length
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

  const xLabels = [];
  const xNumberBaseline = origin.y + AXIS_LABEL_FONT_SIZE * 1.08;
  for (let index = 0; index <= horizontalSquares; index += 1) {
    if (
      !shouldLabelAxisSquare(
        index - document.axes.x.negativeSquares,
        document.axes.x.unitsPerSquare,
      )
    )
      continue;
    const value =
      (index - document.axes.x.negativeSquares) *
      document.axes.x.unitsPerSquare;
    if (Math.abs(value) < 1e-9) continue;
    xLabels.push(
      <AxisTickLabel
        key={index}
        text={formatNumber(value)}
        x={layout.plotLeft + index * layout.square}
        baseline={xNumberBaseline}
      />,
    );
  }
  const yLabels = [];
  const yNumberX =
    origin.x - EDITOR_UNITS_PER_CENTIMETRE * Y_AXIS_LABEL_GAP_CENTIMETRES;
  for (let index = 0; index <= verticalSquares; index += 1) {
    if (
      !shouldLabelAxisSquare(
        document.axes.y.positiveSquares - index,
        document.axes.y.unitsPerSquare,
      )
    )
      continue;
    const value =
      (document.axes.y.positiveSquares - index) *
      document.axes.y.unitsPerSquare;
    if (Math.abs(value) < 1e-9) continue;
    yLabels.push(
      <AxisTickLabel
        key={index}
        text={formatNumber(value)}
        x={yNumberX}
        baseline={
          layout.plotTop + index * layout.square + AXIS_LABEL_FONT_SIZE * 0.34
        }
        textAnchor="end"
      />,
    );
  }

  return (
    <div ref={stage} className="graph-stage" data-tool={tool}>
      <div
        className={`graph-board${compact ? " is-compact" : ""}`}
        style={{
          width: controlWidth + (compact ? 144 : 240),
          height: controlHeight + 144,
        }}
      >
        <svg
          ref={svgRef}
          className="graph-canvas"
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
            <marker
              id="editor-axis-arrow"
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerUnits="userSpaceOnUse"
              markerWidth="15"
              markerHeight="15"
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
          <g className="grid-lines">
            {Array.from({ length: horizontalSquares + 1 }, (_, index) => (
              <line
                key={`x-${index}`}
                x1={layout.plotLeft + index * layout.square}
                y1={layout.plotTop}
                x2={layout.plotLeft + index * layout.square}
                y2={layout.plotBottom}
              />
            ))}
            {Array.from({ length: verticalSquares + 1 }, (_, index) => (
              <line
                key={`y-${index}`}
                x1={layout.plotLeft}
                y1={layout.plotTop + index * layout.square}
                x2={layout.plotRight}
                y2={layout.plotTop + index * layout.square}
              />
            ))}
          </g>
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
              y2={layout.plotTop - AXIS_ARROW_EXTENSION}
              markerEnd="url(#editor-axis-arrow)"
            />
          </g>
          <g className="axis-labels">
            {xLabels}
            {yLabels}
            <AxisTickLabel
              text="0"
              x={origin.x - AXIS_LABEL_FONT_SIZE * 0.38}
              baseline={xNumberBaseline}
              textAnchor="end"
              origin
            />
            <text
              className="axis-name axis-name--x"
              x={layout.plotRight + 29}
              y={xNumberBaseline}
              fontFamily={fontFamily}
            >
              {AXIS_X_NAME}
            </text>
            <text
              className="axis-name axis-name--y"
              x={
                origin.x -
                EDITOR_UNITS_PER_CENTIMETRE * axisNameYGapCentimetres(document)
              }
              y={layout.plotTop - 18}
              textAnchor="end"
              fontFamily={fontFamily}
            >
              {AXIS_Y_NAME}
            </text>
          </g>
          <g clipPath="url(#editor-plot-clip)">
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
                return (
                  <line
                    key={object.id}
                    className={`graph-straight${object.id === visibleDocument.selectedObjectId ? " graph-straight--selected" : ""}`}
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
              })}
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
                  className={`graph-point${object.id === visibleDocument.selectedObjectId ? " graph-point--selected" : ""}`}
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
              return (
                <button
                  key={delta}
                  disabled={
                    disabled ||
                    (delta === 1
                      ? total >= AXIS_LIMITS[axis].maxTotal
                      : count === 0 || total <= AXIS_LIMITS[axis].minTotal)
                  }
                  aria-label={
                    (delta === 1 ? "Add" : "Remove") +
                    " one square at the " +
                    end +
                    " end of the " +
                    axis +
                    "-axis"
                  }
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
