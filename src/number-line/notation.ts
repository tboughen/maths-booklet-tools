import { canonicalNumber } from "../../packages/ratio-table-core/src/numbers";
import {
  add,
  compare,
  validate,
  type Envelope,
  type LineDocument,
  type Solution,
} from "../../packages/number-line-core/src";

type Axis = LineDocument["axis"];

export function parseNotation(raw: string, variable = "x"): Solution {
  if (raw.length > 160) throw Error("Use at most 160 characters.");
  const value = raw
    .replaceAll("−", "-")
    .replaceAll("≤", "<=")
    .replaceAll("≥", ">=")
    .replace(/\s/g, "");
  const letter = variable || "x";
  if (!/^[a-zA-Z]$/.test(letter))
    throw Error("Use the current single-letter axis variable.");
  const number = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:/[+-]?\\d+)?";
  const relation = "(<=|>=|<|>)";
  const parse = (text: string) => canonicalNumber(text);
  const equal = value.match(new RegExp(`^${letter}=(${number})$`));
  if (equal)
    return {
      kind: "points",
      id: "points",
      points: [{ id: "point-1", value: parse(equal[1]), included: true }],
    };
  const chain = value.match(
    new RegExp(`^(${number})${relation}${letter}${relation}(${number})$`),
  );
  if (chain) {
    if (chain[2][0] !== chain[3][0])
      throw Error(
        "Use one interval, such as -3 < x <= 1. Both signs must run in the same direction.",
      );
    const increasing = chain[2][0] === "<";
    const lower = parse(increasing ? chain[1] : chain[4]),
      upper = parse(increasing ? chain[4] : chain[1]);
    if (compare(lower, upper) >= 0)
      throw Error(
        "The lower endpoint must be less than the upper endpoint. Use x = a for a point.",
      );
    return {
      kind: "interval",
      id: "set",
      lower,
      upper,
      lowerIncluded: (increasing ? chain[2] : chain[3]).includes("="),
      upperIncluded: (increasing ? chain[3] : chain[2]).includes("="),
    };
  }
  const right = value.match(new RegExp(`^${letter}${relation}(${number})$`));
  const left = value.match(new RegExp(`^(${number})${relation}${letter}$`));
  if (right || left) {
    const op = right ? right[1] : left![2];
    const direction = (op[0] === "<") === !!right ? "left" : "right";
    return {
      kind: "ray",
      id: "set",
      value: parse(right ? right[2] : left![1]),
      included: op.includes("="),
      direction,
      intentional: false,
      stop: null,
    };
  }
  throw Error(
    `Use ${letter} < 3, -3 < ${letter} <= 1 or ${letter} = 2. Solving expressions, unions and other variables are not supported.`,
  );
}

export function notationSummary(solution: Solution | null, variable = "x") {
  const v = variable || "x";
  if (!solution) return "Blank number line";
  if (solution.kind === "interval")
    return `${solution.lower} ${solution.lowerIncluded ? "≤" : "<"} ${v} ${solution.upperIncluded ? "≤" : "<"} ${solution.upper}`;
  if (
    solution.kind === "ray" &&
    !solution.intentional &&
    solution.stop === null
  )
    return `${v} ${solution.direction === "left" ? (solution.included ? "≤" : "<") : solution.included ? "≥" : ">"} ${solution.value}`;
  if (
    solution.kind === "points" &&
    solution.points.length === 1 &&
    solution.points[0].included !== false &&
    !solution.intervals?.length
  )
    return `${v} = ${solution.points[0].value}`;
  return "Custom drawing";
}

/**
 * The smallest whole-step widening of the axis that shows every value of a drawing, or null when
 * the drawing already fits or would need more than 100 extra steps. A ray also gets one step
 * beyond its start in its direction, so its arrow has room. Nothing calls this silently: the
 * editor offers it as an explicit "Widen the line to fit" action.
 */
export function fitAxis(axis: Axis, solution: Solution): Axis | null {
  const values =
    solution.kind === "interval"
      ? [solution.lower, solution.upper]
      : solution.kind === "ray"
        ? [
            solution.value,
            ...(solution.stop === null ? [] : [solution.stop]),
            add(
              solution.value,
              axis.step,
              solution.direction === "left" ? -1 : 1,
            ),
          ]
        : solution.points.map((p) => p.value);
  let { minimum, maximum } = axis;
  for (let i = 0; values.some((v) => compare(v, minimum) < 0); i++) {
    if (i >= 100) return null;
    minimum = add(minimum, axis.step, -1);
  }
  for (let i = 0; values.some((v) => compare(v, maximum) > 0); i++) {
    if (i >= 100) return null;
    maximum = add(maximum, axis.step, 1);
  }
  return minimum === axis.minimum && maximum === axis.maximum
    ? null
    : { ...axis, minimum, maximum };
}

// The widening offered when a drawing does not fit: only the new first and last tick, and only
// when the whole document, with this drawing on the widened line, passes validation (so a line
// with overlapping labels or too many ticks gets no offer and keeps its original error).
export function offerWidening(
  envelope: Envelope,
  solution: Solution,
): { minimum: string; maximum: string } | null {
  const wider = fitAxis(envelope.document.axis, solution);
  if (!wider) return null;
  try {
    validate({
      ...envelope,
      document: { ...envelope.document, axis: wider, solution },
    });
  } catch {
    return null;
  }
  return { minimum: wider.minimum, maximum: wider.maximum };
}
