import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  clampToBounds,
  clientPointToSvg,
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
  tickLabelEvery,
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
  Y_AXIS_LABEL_GAP_CENTIMETRES,
  axisLabelBoxHeight,
  axisLabelBoxWidth,
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
  tool: DrawingTool;
  onCommit: (document: DiagramDocumentV1) => void;
  onSelect: (id: string | null) => void;
  onAxisAdjust: (axis: "x" | "y", end: "negative" | "positive", delta: -1 | 1) => void;
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
const AXIS_LABEL_FONT_SIZE = pointsToDiagramUnits(AXIS_LABEL_FONT_POINTS, EDITOR_UNITS_PER_CENTIMETRE);
const AXIS_ARROW_EXTENSION = 12 + EDITOR_UNITS_PER_CENTIMETRE * AXIS_ARROW_EXTRA_SHAFT_CENTIMETRES;
const AXIS_CONTROL_SIZE = 48;
const AXIS_CONTROL_GAP = 4;
const AXIS_CONTROL_WIDTH = AXIS_CONTROL_SIZE * 2 + AXIS_CONTROL_GAP;

interface AxisTickLabelProps {
  text: string;
  x: number;
  baseline: number;
  textAnchor?: "start" | "middle" | "end";
  origin?: boolean;
}

function AxisTickLabel({ text, x, baseline, textAnchor = "middle", origin = false }: AxisTickLabelProps) {
  const width = axisLabelBoxWidth(text, AXIS_LABEL_FONT_SIZE);
  const height = axisLabelBoxHeight(AXIS_LABEL_FONT_SIZE);
  const rectX = textAnchor === "middle" ? x - width / 2 : textAnchor === "end" ? x - width : x;
  const rectY = baseline - AXIS_LABEL_FONT_SIZE * 0.82;
  const originTransform = origin
    ? `translate(${x} ${baseline}) skewX(-12) translate(${-x} ${-baseline})`
    : undefined;
  return (
    <g className={`axis-number${origin ? " axis-number--origin" : ""}`}>
      <rect x={rectX} y={rectY} width={width} height={height} rx={AXIS_LABEL_FONT_SIZE * 0.05} />
      <text x={x} y={baseline} textAnchor={textAnchor} transform={originTransform}>{text}</text>
    </g>
  );
}

function editorAutoLabelPosition(object: StraightObject, layout: SvgLayout): Coordinate {
  const visible = visibleStraightPoints(object, layout.bounds);
  if (!visible) return { x: layout.plotLeft + 12, y: layout.plotTop + 28 };
  const start = coordinateToSvg(visible[0], layout);
  const end = coordinateToSvg(visible[1], layout);
  return {
    x: Math.min(layout.plotRight - 108, Math.max(layout.plotLeft + 8, start.x + (end.x - start.x) * 0.72)),
    y: Math.min(layout.plotBottom - 8, Math.max(layout.plotTop + 24, start.y + (end.y - start.y) * 0.72 - 13)),
  };
}

function objectHitIds(document: DiagramDocumentV1, layout: SvgLayout, pointer: Coordinate): string[] {
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
    .sort((first, second) => first.priority - second.priority || first.distance - second.distance)
    .map((hit) => hit.id);
}

interface AxisEndControlProps {
  x: number;
  y: number;
  axis: "x" | "y";
  end: "negative" | "positive";
  onAdjust: GraphCanvasProps["onAxisAdjust"];
}

function AxisEndControl({ x, y, axis, end, onAdjust }: AxisEndControlProps) {
  const actions: Array<{ symbol: string; delta: -1 | 1; label: string }> = [
    { symbol: "+", delta: 1, label: `Add one square at the ${end} end of the ${axis}-axis` },
    { symbol: "−", delta: -1, label: `Remove one square at the ${end} end of the ${axis}-axis` },
  ];
  return (
    <g className="axis-end-control" transform={`translate(${x} ${y})`}>
      {actions.map((action, index) => (
        <g
          key={action.symbol}
          role="button"
          tabIndex={0}
          aria-label={action.label}
          transform={`translate(${index * (AXIS_CONTROL_SIZE + AXIS_CONTROL_GAP)} 0)`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onAdjust(axis, end, action.delta);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onAdjust(axis, end, action.delta);
            }
          }}
        >
          <rect width={AXIS_CONTROL_SIZE} height={AXIS_CONTROL_SIZE} rx="8" />
          <text x={AXIS_CONTROL_SIZE / 2} y="33" textAnchor="middle">{action.symbol}</text>
        </g>
      ))}
    </g>
  );
}

function Cross({ point, size = 8, className = "graph-point" }: { point: Coordinate; size?: number; className?: string }) {
  return (
    <path
      className={className}
      d={`M ${point.x - size} ${point.y - size} L ${point.x + size} ${point.y + size} M ${point.x - size} ${point.y + size} L ${point.x + size} ${point.y - size}`}
    />
  );
}

export function GraphCanvas({ document, tool, onCommit, onSelect, onAxisAdjust }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const cycleRef = useRef<{ key: string; index: number }>({ key: "", index: 0 });
  const [draftDocument, setDraftDocument] = useState<DiagramDocumentV1 | null>(null);
  const [segmentPreview, setSegmentPreview] = useState<SegmentDrag | null>(null);
  const visibleDocument = draftDocument ?? document;
  const layout = useMemo(() => createEditorLayout(document), [document]);
  const selected = getSelectedObject(visibleDocument);
  const origin = coordinateToSvg({ x: 0, y: 0 }, layout);
  const horizontalSquares = document.axes.x.negativeSquares + document.axes.x.positiveSquares;
  const verticalSquares = document.axes.y.negativeSquares + document.axes.y.positiveSquares;

  function svgPointer(event: ReactPointerEvent<SVGSVGElement>): Coordinate {
    const rect = event.currentTarget.getBoundingClientRect();
    return clientPointToSvg(
      { x: event.clientX, y: event.clientY },
      rect,
      layout,
    );
  }

  function graphPointer(event: ReactPointerEvent<SVGSVGElement>, snap = true): Coordinate {
    const raw = clampToBounds(svgToCoordinate(svgPointer(event), layout), layout.bounds);
    return snap ? snapCoordinate(raw, document.axes.x.unitsPerSquare, document.axes.y.unitsPerSquare) : raw;
  }

  function capturePointer(pointerId: number) {
    try { svgRef.current?.setPointerCapture(pointerId); } catch { /* Pointer capture is best effort. */ }
  }

  function startObjectDrag(
    event: ReactPointerEvent<SVGElement>,
    kind: ObjectDrag["kind"],
    objectId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    onSelect(objectId);
    dragRef.current = { kind, objectId, baseDocument: { ...document, selectedObjectId: objectId }, pointerId: event.pointerId };
    capturePointer(event.pointerId);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const pointer = svgPointer(event);
    const coordinate = graphPointer(event);
    if (tool === "segment") {
      const drag: SegmentDrag = { kind: "new-segment", start: coordinate, current: coordinate, pointerId: event.pointerId };
      dragRef.current = drag;
      setSegmentPreview(drag);
      capturePointer(event.pointerId);
      return;
    }
    if (tool === "point") {
      const point: GraphObject = { id: makeId("point"), kind: "point", position: coordinate };
      onCommit({ ...document, objects: [...document.objects, point], selectedObjectId: point.id });
      return;
    }

    const hits = objectHitIds(document, layout, pointer);
    if (!hits.length) {
      onSelect(null);
      return;
    }
    const key = `${Math.round(pointer.x / 8)}:${Math.round(pointer.y / 8)}:${hits.join(",")}`;
    const index = cycleRef.current.key === key ? (cycleRef.current.index + 1) % hits.length : 0;
    cycleRef.current = { key, index };
    const id = hits[index];
    onSelect(id);
    const hitObject = getObjectById(document, id);
    if (hitObject?.kind === "point") {
      dragRef.current = { kind: "point", objectId: id, baseDocument: { ...document, selectedObjectId: id }, pointerId: event.pointerId };
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
      setDraftDocument(updateObject(drag.baseDocument, { ...existing, position: graphPointer(event) }));
      return;
    }
    if (existing.kind !== "straight") return;
    if (drag.kind === "label") {
      setDraftDocument(updateObject(drag.baseDocument, { ...existing, equationLabelPosition: graphPointer(event, false) }));
      return;
    }
    const coordinate = graphPointer(event);
    const updated = drag.kind === "start"
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
          start: drag.start,
          end: drag.current,
          equationVisible: false,
        };
        onCommit({ ...document, objects: [...document.objects, object], selectedObjectId: object.id });
      }
    } else if (draftDocument) {
      const changed = getObjectById(draftDocument, drag.objectId);
      if (changed?.kind !== "straight" || squaredDistance(changed.start, changed.end) > 1e-8) onCommit(draftDocument);
    }
    dragRef.current = null;
    setDraftDocument(null);
    setSegmentPreview(null);
    try { svgRef.current?.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
  }

  const xLabels = [];
  const xNumberBaseline = origin.y + AXIS_LABEL_FONT_SIZE * 1.08;
  for (let index = 0; index <= horizontalSquares; index += 1) {
    if (index % tickLabelEvery(document.axes.x.unitsPerSquare) !== 0) continue;
    const value = (index - document.axes.x.negativeSquares) * document.axes.x.unitsPerSquare;
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
  const yNumberX = origin.x - EDITOR_UNITS_PER_CENTIMETRE * Y_AXIS_LABEL_GAP_CENTIMETRES;
  for (let index = 0; index <= verticalSquares; index += 1) {
    if (index % tickLabelEvery(document.axes.y.unitsPerSquare) !== 0) continue;
    const value = (document.axes.y.positiveSquares - index) * document.axes.y.unitsPerSquare;
    if (Math.abs(value) < 1e-9) continue;
    yLabels.push(
      <AxisTickLabel
        key={index}
        text={formatNumber(value)}
        x={yNumberX}
        baseline={layout.plotTop + index * layout.square + AXIS_LABEL_FONT_SIZE * 0.34}
        textAnchor="end"
      />,
    );
  }

  return (
    <div className="graph-stage" data-tool={tool}>
      <svg
        ref={svgRef}
        className="graph-canvas"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
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
          <clipPath id="editor-plot-clip"><rect x={layout.plotLeft} y={layout.plotTop} width={layout.plotRight - layout.plotLeft} height={layout.plotBottom - layout.plotTop} /></clipPath>
          <marker id="editor-axis-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="15" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
        </defs>
        <rect className="canvas-paper" width={layout.width} height={layout.height} />
        <g className="grid-lines">
          {Array.from({ length: horizontalSquares + 1 }, (_, index) => <line key={`x-${index}`} x1={layout.plotLeft + index * layout.square} y1={layout.plotTop} x2={layout.plotLeft + index * layout.square} y2={layout.plotBottom} />)}
          {Array.from({ length: verticalSquares + 1 }, (_, index) => <line key={`y-${index}`} x1={layout.plotLeft} y1={layout.plotTop + index * layout.square} x2={layout.plotRight} y2={layout.plotTop + index * layout.square} />)}
        </g>
        <g className="graph-axes">
          <line x1={layout.plotLeft} y1={origin.y} x2={layout.plotRight + AXIS_ARROW_EXTENSION} y2={origin.y} markerEnd="url(#editor-axis-arrow)" />
          <line x1={origin.x} y1={layout.plotBottom} x2={origin.x} y2={layout.plotTop - AXIS_ARROW_EXTENSION} markerEnd="url(#editor-axis-arrow)" />
        </g>
        <g className="axis-labels">
          {xLabels}{yLabels}
          <AxisTickLabel text="0" x={origin.x - AXIS_LABEL_FONT_SIZE * 0.38} baseline={xNumberBaseline} textAnchor="end" origin />
          <text className="axis-name axis-name--x" x={layout.plotRight + 29} y={xNumberBaseline} fontFamily={MATHS_FONT_FAMILY}>{AXIS_X_NAME}</text>
          <text className="axis-name axis-name--y" x={yNumberX} y={layout.plotTop - 18} textAnchor="end" fontFamily={MATHS_FONT_FAMILY}>{AXIS_Y_NAME}</text>
        </g>
        <g clipPath="url(#editor-plot-clip)">
          {visibleDocument.objects.filter((object): object is StraightObject => object.kind === "straight").map((object) => {
            const visible = visibleStraightPoints(object, layout.bounds);
            if (!visible) return null;
            const start = coordinateToSvg(visible[0], layout);
            const end = coordinateToSvg(visible[1], layout);
            return <line key={object.id} className={`graph-straight${object.id === visibleDocument.selectedObjectId ? " graph-straight--selected" : ""}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
          })}
          {visibleDocument.objects.filter((object): object is PointObject => object.kind === "point" && pointInBounds(object.position, layout.bounds)).map((object) => (
            <Cross key={object.id} point={coordinateToSvg(object.position, layout)} className={`graph-point${object.id === visibleDocument.selectedObjectId ? " graph-point--selected" : ""}`} />
          ))}
          {segmentPreview && <line className="segment-preview" x1={coordinateToSvg(segmentPreview.start, layout).x} y1={coordinateToSvg(segmentPreview.start, layout).y} x2={coordinateToSvg(segmentPreview.current, layout).x} y2={coordinateToSvg(segmentPreview.current, layout).y} />}
        </g>
        <g className="equation-labels">
          {visibleDocument.objects.filter((object): object is StraightObject => object.kind === "straight" && object.equationVisible).map((object) => {
            if (!visibleStraightPoints(object, layout.bounds)) return null;
            const position = object.equationLabelPosition
              ? coordinateToSvg(object.equationLabelPosition, layout)
              : editorAutoLabelPosition(object, layout);
            return <text key={object.id} className={object.id === visibleDocument.selectedObjectId ? "selected" : ""} x={position.x} y={position.y} onPointerDown={(event) => startObjectDrag(event, "label", object.id)}>{equationForObject(object)}</text>;
          })}
        </g>
        {selected?.kind === "straight" && (
          <g className="selection-handles">
            <circle cx={coordinateToSvg(selected.start, layout).x} cy={coordinateToSvg(selected.start, layout).y} r="8" onPointerDown={(event) => startObjectDrag(event, "start", selected.id)} />
            <circle cx={coordinateToSvg(selected.end, layout).x} cy={coordinateToSvg(selected.end, layout).y} r="8" onPointerDown={(event) => startObjectDrag(event, "end", selected.id)} />
          </g>
        )}
        <AxisEndControl x={layout.plotLeft - AXIS_CONTROL_WIDTH - 40} y={origin.y - AXIS_CONTROL_SIZE / 2} axis="x" end="negative" onAdjust={onAxisAdjust} />
        <AxisEndControl x={layout.plotRight + 64} y={origin.y - AXIS_CONTROL_SIZE / 2} axis="x" end="positive" onAdjust={onAxisAdjust} />
        <AxisEndControl x={origin.x - AXIS_CONTROL_WIDTH / 2} y={layout.plotTop - 112} axis="y" end="positive" onAdjust={onAxisAdjust} />
        <AxisEndControl x={origin.x - AXIS_CONTROL_WIDTH / 2} y={layout.plotBottom + 52} axis="y" end="negative" onAdjust={onAxisAdjust} />
      </svg>
    </div>
  );
}
