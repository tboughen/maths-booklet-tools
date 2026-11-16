import { ChevronDown, ChevronRight, CornerDownLeft, EyeOff, Slash, Spline, SquareDashed, Triangle, X } from "lucide-react";
import { curveVisible, readingVisible } from "../../packages/graph-core/src/curve";
import { formatVertices, polygonInBounds } from "../../packages/graph-core/src/polygon";
import { regionHalfPlanes, regionPolygon } from "../../packages/graph-core/src/region";
import { getBounds, pointInBounds, visibleStraightPoints } from "../domain/diagram";
import { equationForObject, formatNumber } from "../domain/equations";
import type { GraphEditorDocument, GraphObject } from "../domain/types";

interface ObjectsPanelProps {
  document: GraphEditorDocument;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}

function objectTitle(object: GraphObject, index: number): string {
  if (object.kind === "point") return `Point ${index + 1}`;
  if (object.kind === "polygon") return `Shape ${object.name ?? index + 1}`;
  if (object.kind === "region") return `Region ${object.name ?? index + 1}`;
  if (object.kind === "curve") return `${object.smooth ? "Curve" : "Graph"} ${object.name ?? index + 1}`;
  if (object.kind === "reading") return `Reading ${index + 1}`;
  return `${object.display === "line" ? "Line" : "Segment"} ${index + 1}`;
}

function objectDescription(object: GraphObject): string {
  if (object.kind === "point") return `(${formatNumber(object.position.x)}, ${formatNumber(object.position.y)})`;
  if (object.kind === "polygon") return `${formatVertices(object.vertices)}${object.shaded ? " · shaded" : ""}`;
  if (object.kind === "region") return `${object.inequalities.join(", ")}${object.shade === "unwanted" ? " · unwanted side shaded" : ""}`;
  if (object.kind === "curve") return `${formatVertices(object.points)}${object.strokeStyle === "dashed" ? " · dashed" : ""}`;
  if (object.kind === "reading") return `at (${formatNumber(object.at.x)}, ${formatNumber(object.at.y)}) · ${object.read === "both" ? "both axes" : `read ${object.read}`}`;
  return `${equationForObject(object)}${object.strokeStyle === "dashed" ? " · dashed" : ""}`;
}

export function ObjectsPanel({ document, expanded, onToggle, onSelect }: ObjectsPanelProps) {
  const bounds = getBounds(document);
  return (
    <section className={`panel-card objects-panel${expanded ? " expanded" : ""}`}>
      <button className="objects-toggle" aria-expanded={expanded} onClick={onToggle}>
        <span>{expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}<strong>Objects</strong></span>
        <span className="count-badge">{document.objects.length}</span>
      </button>
      {expanded && (
        <div className="objects-list">
          {document.objects.length === 0 ? <p>No objects yet. Add a point, segment, line, shape, region or graph through points.</p> : document.objects.map((object, index) => {
            const offGrid = object.kind === "point" ? !pointInBounds(object.position, bounds) : object.kind === "polygon" ? !polygonInBounds(object, bounds) : object.kind === "region" ? !regionPolygon(regionHalfPlanes(object), bounds).length : object.kind === "curve" ? !curveVisible(object, bounds) : object.kind === "reading" ? !readingVisible(object, bounds) : !visibleStraightPoints(object, bounds);
            const selected = object.id === document.selectedObjectId;
            const title = objectTitle(object, index);
            const description = objectDescription(object);
            return (
              <button key={object.id} type="button" className={selected ? "selected" : ""} aria-pressed={selected} aria-label={`Select ${title}: ${description}`} onClick={() => onSelect(object.id)}>
                <span className="list-icon">{object.kind === "point" ? <X size={16} /> : object.kind === "polygon" ? <Triangle size={16} /> : object.kind === "region" ? <SquareDashed size={16} /> : object.kind === "curve" ? <Spline size={16} /> : object.kind === "reading" ? <CornerDownLeft size={16} /> : <Slash size={16} />}</span>
                <span className="list-copy"><strong>{title}</strong><small>{description}</small></span>
                {offGrid && <span className="off-grid" title="This object is outside the visible grid"><EyeOff size={14} /><span className="sr-only">Off grid</span></span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
