import { useState } from "react";
import { Copy } from "lucide-react";
import type { GraphObject, PolygonObject } from "../domain/types";
import { parseNumericInput } from "../../packages/graph-core/src/equations";
import {
  describeTransformation,
  imageName,
  imageObjects,
  parseMirrorLine,
  type RotationAngle,
  type RotationDirection,
  type Transformation,
} from "../../packages/graph-core/src/transform";

type Kind = Transformation["kind"];
const KINDS: { kind: Kind; label: string }[] = [
  { kind: "translate", label: "Translate" },
  { kind: "reflect", label: "Reflect" },
  { kind: "rotate", label: "Rotate" },
  { kind: "enlarge", label: "Enlarge" },
];

/**
 * Draws the image of the selected shape under one transformation (U196, U799, U696, U519, U134).
 * The image is added as an ordinary shape with exact corners, so it can be edited or removed with
 * Undo, and it is a hidden answer unless the teacher unticks it: nothing is drawn for pupils
 * unless asked.
 */
export function TransformFields({
  object,
  objects,
  onAdd,
  makeId,
  disabled,
}: {
  object: PolygonObject;
  objects: GraphObject[];
  onAdd: (objects: GraphObject[]) => void;
  makeId: (prefix: "polygon" | "straight") => string;
  disabled?: boolean;
}) {
  const [kind, setKind] = useState<Kind>("reflect");
  const [vx, setVx] = useState("3");
  const [vy, setVy] = useState("-2");
  const [mirror, setMirror] = useState("y = x");
  const [angle, setAngle] = useState<RotationAngle>(90);
  const [direction, setDirection] = useState<RotationDirection>("clockwise");
  const [cx, setCx] = useState("0");
  const [cy, setCy] = useState("0");
  const [scale, setScale] = useState("2");
  const [rays, setRays] = useState(false);
  const [answerOnly, setAnswerOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function number(text: string, what: string): number {
    const v = parseNumericInput(text);
    if (v === null) throw Error(`Type a number or fraction for ${what}, such as 2, −3 or 1/2.`);
    return v;
  }
  function transformation(): Transformation {
    if (kind === "translate") return { kind, vector: { x: number(vx, "the vector's top number"), y: number(vy, "the vector's bottom number") } };
    if (kind === "reflect") {
      const line = parseMirrorLine(mirror);
      if (!line) throw Error("Type the mirror line as an equation, such as x = 2, y = −1, y = x or y = −x + 1.");
      return { kind, mirror: line };
    }
    const centre = { x: number(cx, "the centre's x"), y: number(cy, "the centre's y") };
    if (kind === "rotate") return { kind, centre, angle, direction };
    const scaleFactor = number(scale, "the scale factor");
    if (scaleFactor === 0) throw Error("Use a scale factor that is not 0.");
    return { kind, centre, scaleFactor };
  }
  function draw() {
    try {
      const t = transformation();
      const id = makeId("polygon");
      const made = imageObjects(object, t, {
        id,
        name: imageName(object.name, new Set(objects.map((o) => o.name))),
        shaded: object.shaded,
        answerOnly,
        rays: rays && t.kind === "enlarge",
        rayId: () => makeId("straight"),
      });
      setError(null);
      onAdd(made);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const field = (label: string, value: string, set: (v: string) => void, width = "4.5em") => (
    <label className="transform-field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="text"
        disabled={disabled}
        value={value}
        style={{ width }}
        onChange={(e) => {
          set(e.target.value);
          setError(null);
        }}
      />
    </label>
  );
  let preview = "";
  try {
    preview = describeTransformation(transformation());
  } catch {
    preview = "";
  }
  return (
    <fieldset className="transform-fields" disabled={disabled}>
      <legend>Draw an image of this shape</legend>
      <div className="segmented" role="group" aria-label="Transformation">
        {KINDS.map((k) => (
          <button key={k.kind} className={kind === k.kind ? "active" : ""} aria-pressed={kind === k.kind} onClick={() => setKind(k.kind)}>
            {k.label}
          </button>
        ))}
      </div>
      {kind === "translate" && (
        <div className="transform-row">
          {field("Across (x)", vx, setVx)}
          {field("Up (y)", vy, setVy)}
        </div>
      )}
      {kind === "reflect" && <div className="transform-row">{field("Mirror line", mirror, setMirror, "9em")}</div>}
      {(kind === "rotate" || kind === "enlarge") && (
        <div className="transform-row">
          {field("Centre x", cx, setCx)}
          {field("Centre y", cy, setCy)}
        </div>
      )}
      {kind === "rotate" && (
        <div className="transform-row">
          <label className="transform-field">
            <span>Angle</span>
            <select value={angle} onChange={(e) => setAngle(Number(e.target.value) as RotationAngle)}>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </label>
          {angle !== 180 && (
            <label className="transform-field">
              <span>Direction</span>
              <select value={direction} onChange={(e) => setDirection(e.target.value as RotationDirection)}>
                <option value="clockwise">Clockwise</option>
                <option value="anticlockwise">Anticlockwise</option>
              </select>
            </label>
          )}
        </div>
      )}
      {kind === "enlarge" && (
        <>
          <div className="transform-row">{field("Scale factor", scale, setScale)}</div>
          <label className="checkbox-row">
            <input type="checkbox" checked={rays} onChange={(e) => setRays(e.target.checked)} /> Draw dashed rays from the centre
          </label>
        </>
      )}
      <label className="checkbox-row">
        <input type="checkbox" checked={answerOnly} onChange={(e) => setAnswerOnly(e.target.checked)} /> Answer only: hidden on the pupil copy
      </label>
      {preview && <p className="panel-note">{preview[0].toUpperCase() + preview.slice(1)}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button className="secondary-panel-button" onClick={draw}>
        <Copy size={15} />
        Draw the image
      </button>
    </fieldset>
  );
}
