import { canonicalNumber } from "../../packages/ratio-table-core/src/numbers";
import { compare, type Solution } from "../../packages/number-line-core/src";

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
