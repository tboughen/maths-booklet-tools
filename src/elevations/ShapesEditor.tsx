import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { bounds, MAX_LENGTH_LABELS, MAX_SHAPES, meshOf, SHAPE_TYPES, type Axis, type ElevationDocument, type LengthLabel, type Shape, type ShapeType } from "../../packages/elevation-core/src";
import { DraftField } from "./DraftField";
import { cornersText, defaultShape, parseCorners, parsePoint, pointText, SHAPE_NAMES } from "./shapeFields";

type Doc = ElevationDocument;
const SECTION_HELP: Record<Axis, string> = {
  y: "Corners of the front face (across, up). The prism runs back from it.",
  x: "Corners of the left end (back, up). The prism runs to the right.",
  z: "Corners of the base (across, back). The prism stands up from it.",
};
const AXIS_NAMES: Record<Axis, string> = { z: "Upright", y: "Lying, front to back", x: "Lying, left to right" };
const PRISM_AXIS_NAMES: Record<Axis, string> = { y: "Runs back from its front face", x: "Runs right from its left end", z: "Stands up from its base" };

/** The settings for a solid made of shapes: each shape's sizes, the lengths on the 3D drawing and the hidden-line style. */
export function ShapesEditor({ d, blocked, patch, onMessage, onHistory }: {
  d: Doc;
  blocked: boolean;
  patch: (update: (n: Doc) => void, label?: string) => void;
  onMessage: (text: string) => void;
  onHistory: (event: ReactKeyboardEvent<HTMLInputElement>) => boolean;
}) {
  const shapes = d.shapes ?? [];
  const lengths = d.lengths ?? [];
  const setShape = (i: number, update: (s: Shape) => void, label: string) => patch((n) => update(n.shapes![i]), label);
  /** A number of squares: whole or half, checked by the schema when it is applied. */
  const num = (i: number, name: string, value: number, apply: (s: Shape, v: number) => void, label: string) => (
    <label key={name}>
      {name}
      <DraftField
        label={`Shape ${i + 1} ${name.toLowerCase()}`}
        inputMode="decimal"
        maxLength={6}
        value={String(value)}
        disabled={blocked}
        onHistory={onHistory}
        onCommit={(text) => {
          const v = Number(text.trim());
          if (!text.trim() || !Number.isFinite(v)) return onMessage("Type a number of squares, such as 2 or 2.5.");
          setShape(i, (s) => apply(s, v), label);
        }}
      />
    </label>
  );
  const top = () => {
    try {
      return Math.ceil(bounds(meshOf(d)).max.z - 1e-9);
    } catch {
      return 0;
    }
  };
  return (
    <>
      <p className="pt-note">Sizes are in grid squares. Across runs to the right, back runs away from the front and up is height; nothing may go below 0 or above 12.</p>
      {shapes.map((s, i) => (
        <fieldset key={i} className="ev-shape" aria-label={`Shape ${i + 1}`}>
          <legend>
            Shape {i + 1}: {SHAPE_NAMES[s.type]}
          </legend>
          <div className="pt-fields">
            <label>
              Shape
              <select
                aria-label={`Shape ${i + 1} kind`}
                value={s.type}
                disabled={blocked}
                onChange={(ev) => {
                  const type = ev.target.value as ShapeType;
                  patch((n) => void (n.shapes![i] = defaultShape(type, s.at.z)), `make shape ${i + 1} a ${type}`);
                }}
              >
                {SHAPE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SHAPE_NAMES[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {s.type === "prism" || s.type === "pyramid" ? "Corner at" : s.type === "sphere" ? "Centre at" : "Centre of base at"}
              <DraftField
                label={`Shape ${i + 1} position`}
                maxLength={30}
                value={pointText(s.at)}
                disabled={blocked}
                onHistory={onHistory}
                onCommit={(text) => {
                  const p = parsePoint(text);
                  if (typeof p === "string") return onMessage(p);
                  setShape(i, (x) => void (x.at = p), `move shape ${i + 1}`);
                }}
              />
            </label>
            {s.type === "prism" && (
              <>
                <label>
                  Direction
                  <select aria-label={`Shape ${i + 1} direction`} value={s.axis} disabled={blocked} onChange={(ev) => setShape(i, (x) => void (x.type === "prism" && (x.axis = ev.target.value as Axis)), `turn shape ${i + 1}`)}>
                    {(["y", "x", "z"] as const).map((a) => (
                      <option key={a} value={a}>
                        {PRISM_AXIS_NAMES[a]}
                      </option>
                    ))}
                  </select>
                </label>
                {num(i, "Length", s.length, (x, v) => void (x.type === "prism" && (x.length = v)), `set shape ${i + 1} length`)}
              </>
            )}
            {(s.type === "cylinder" || s.type === "cone") && (
              <>
                <label>
                  Direction
                  <select
                    aria-label={`Shape ${i + 1} direction`}
                    value={s.axis}
                    disabled={blocked}
                    onChange={(ev) => setShape(i, (x) => void ((x.type === "cylinder" || x.type === "cone") && (x.axis = ev.target.value as Axis)), `turn shape ${i + 1}`)}
                  >
                    {(["z", "y", "x"] as const).map((a) => (
                      <option key={a} value={a}>
                        {AXIS_NAMES[a]}
                      </option>
                    ))}
                  </select>
                </label>
                {num(i, "Radius", s.r, (x, v) => void ("r" in x && (x.r = v)), `set shape ${i + 1} radius`)}
                {num(i, s.type === "cone" ? "Height" : "Length", s.h, (x, v) => void ("h" in x && (x.h = v)), `set shape ${i + 1} ${s.type === "cone" ? "height" : "length"}`)}
              </>
            )}
            {(s.type === "sphere" || s.type === "hemisphere") && num(i, "Radius", s.r, (x, v) => void ("r" in x && (x.r = v)), `set shape ${i + 1} radius`)}
            {s.type === "hemisphere" && (
              <label>
                Flat face
                <select aria-label={`Shape ${i + 1} flat face`} value={s.flat} disabled={blocked} onChange={(ev) => setShape(i, (x) => void (x.type === "hemisphere" && (x.flat = ev.target.value as "down" | "up")), `turn shape ${i + 1}`)}>
                  <option value="down">Down (a dome)</option>
                  <option value="up">Up (a bowl)</option>
                </select>
              </label>
            )}
            {s.type === "pyramid" && (
              <label>
                Apex from the corner
                <DraftField
                  label={`Shape ${i + 1} apex`}
                  maxLength={30}
                  value={pointText(s.apex)}
                  disabled={blocked}
                  onHistory={onHistory}
                  onCommit={(text) => {
                    const p = parsePoint(text);
                    if (typeof p === "string") return onMessage(p);
                    setShape(i, (x) => void (x.type === "pyramid" && (x.apex = p)), `move shape ${i + 1} apex`);
                  }}
                />
              </label>
            )}
          </div>
          {(s.type === "prism" || s.type === "pyramid") && (
            <label className="ev-corners">
              {s.type === "prism" ? SECTION_HELP[s.axis] : "Corners of the base (across, back), from the corner above."}
              <DraftField
                label={`Shape ${i + 1} ${s.type === "prism" ? "cross-section" : "base"} corners`}
                maxLength={160}
                value={cornersText(s.type === "prism" ? s.section : s.base)}
                disabled={blocked}
                onHistory={onHistory}
                onCommit={(text) => {
                  const c = parseCorners(text);
                  if (typeof c === "string") return onMessage(c);
                  setShape(i, (x) => {
                    if (x.type === "prism") x.section = c;
                    if (x.type === "pyramid") x.base = c;
                  }, `change shape ${i + 1} corners`);
                }}
              />
            </label>
          )}
          <div className="md-options-actions">
            <button type="button" aria-label={`Remove shape ${i + 1}`} disabled={blocked || shapes.length <= 1} onClick={() => patch((n) => void n.shapes!.splice(i, 1), `remove shape ${i + 1}`)}>
              Remove
            </button>
          </div>
        </fieldset>
      ))}
      <label className="pt-fields">
        Add a shape on top
        <select
          aria-label="Add a shape on top"
          value=""
          disabled={blocked || shapes.length >= MAX_SHAPES}
          onChange={(ev) => {
            const type = ev.target.value as ShapeType;
            if (type) patch((n) => void n.shapes!.push(defaultShape(type, top())), `add a ${type}`);
          }}
        >
          <option value="">{shapes.length >= MAX_SHAPES ? `At most ${MAX_SHAPES} shapes` : "Choose a shape"}</option>
          {SHAPE_TYPES.map((t) => (
            <option key={t} value={t}>
              {SHAPE_NAMES[t]}
            </option>
          ))}
        </select>
      </label>
      <h3 className="ev-sub">Lengths on the 3D drawing</h3>
      <p className="pt-note">A length is printed beside the line between two corners, such as (0, 0, 0) to (6, 0, 0) for 6 cm along the front.</p>
      {lengths.map((l: LengthLabel, k) => (
        <div key={k} className="ev-length" role="group" aria-label={`Length ${k + 1}`}>
          <div className="pt-fields">
            {(["a", "b"] as const).map((end) => (
              <label key={end}>
                {end === "a" ? "From" : "To"}
                <DraftField
                  label={`Length ${k + 1} ${end === "a" ? "from" : "to"}`}
                  maxLength={30}
                  value={pointText(l[end])}
                  disabled={blocked}
                  onHistory={onHistory}
                  onCommit={(text) => {
                    const p = parsePoint(text);
                    if (typeof p === "string") return onMessage(p);
                    patch((n) => void (n.lengths![k][end] = p), `move length ${k + 1}`);
                  }}
                />
              </label>
            ))}
            <label>
              Text
              <DraftField label={`Length ${k + 1} text`} maxLength={12} value={l.text} disabled={blocked} onHistory={onHistory} onCommit={(text) => patch((n) => void (n.lengths![k].text = text), `edit length ${k + 1}`)} />
            </label>
          </div>
          <label className="pt-hide">
            <input type="checkbox" disabled={blocked || !l.text.trim()} checked={l.show === "hidden"} onChange={(ev) => patch((n) => void (n.lengths![k].show = ev.target.checked ? "hidden" : "show"), `hide length ${k + 1}`)} />
            Hide for pupils (shown on the answers copy)
          </label>
          <div className="md-options-actions">
            <button
              type="button"
              aria-label={`Remove length ${k + 1}`}
              disabled={blocked}
              onClick={() =>
                patch((n) => {
                  n.lengths!.splice(k, 1);
                  if (!n.lengths!.length) delete n.lengths;
                }, `remove length ${k + 1}`)
              }
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <div className="pt-row">
        <button
          type="button"
          disabled={blocked || lengths.length >= MAX_LENGTH_LABELS}
          onClick={() => {
            const s = shapes[0];
            const a = s.type === "prism" || s.type === "pyramid" ? s.at : { x: 0, y: 0, z: 0 };
            patch((n) => void (n.lengths = [...(n.lengths ?? []), { a: { ...a }, b: { ...a, x: Math.min(12, a.x + 1) }, text: "", show: "show" }]), "add a length");
          }}
        >
          Add a length
        </button>
      </div>
      <label className="pt-hide">
        <input type="checkbox" disabled={blocked} checked={d.hiddenLines === "dashed"} onChange={(ev) => patch((n) => (ev.target.checked ? void (n.hiddenLines = "dashed") : void delete n.hiddenLines), ev.target.checked ? "dash hidden edges" : "leave out hidden edges")} />
        Dash hidden edges (exam plans and elevations leave them out)
      </label>
    </>
  );
}
