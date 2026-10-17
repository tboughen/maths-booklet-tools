import { parseNumericInput, type LineEquation } from "../domain/equations";

/** Deliberately small grammar for existing straight objects, never eval. */
export function parseLineInput(raw: string): LineEquation {
  const help =
    "Use y = 2x + 1, y = 1/2x - 2, y = 3 or x = -3. Curves and inequalities are not supported here.";
  if (raw.length > 160)
    throw Error("Use an equation of at most 160 characters.");
  const value = raw.replaceAll("−", "-").replace(/\s/g, "");
  const number =
    "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:/[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))?";
  const parse = (text: string) => {
    const value = parseNumericInput(text);
    if (value === null || Math.abs(value) > 1000000)
      throw Error(
        "Use finite numbers or fractions between -1000000 and 1000000.",
      );
    return value;
  };
  const vertical = value.match(new RegExp(`^x=(${number})$`));
  if (vertical) return { kind: "vertical", x: parse(vertical[1]) };
  const horizontal = value.match(new RegExp(`^y=(${number})$`));
  if (horizontal)
    return { kind: "slope", slope: 0, intercept: parse(horizontal[1]) };
  const slope = value.match(
    new RegExp(`^y=(${number}|[+-]?)x(?:([+-])(${number}))?$`),
  );
  if (!slope || (slope[3] && /^[+-]/.test(slope[3]))) throw Error(help);
  const m =
    slope[1] === "" || slope[1] === "+"
      ? 1
      : slope[1] === "-"
        ? -1
        : parse(slope[1]);
  return {
    kind: "slope",
    slope: m,
    intercept: slope[3] ? parse(`${slope[2]}${slope[3]}`) : 0,
  };
}
