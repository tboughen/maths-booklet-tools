/**
 * U58: axis numbering shared by the Graph tool and the value graph (table of values), so a
 * fix to which lines are numbered, how a number prints or when neighbouring numbers touch
 * reaches both renderers. Each renderer keeps its own drawing (fonts, boxes, grid tiers).
 */

/**
 * The values anchor + k × every that lie in [min, max], smallest first. A tiny tolerance keeps
 * an end value that floating point lands just outside the range.
 */
export function axisTickValues(min: number, max: number, every: number, anchor = 0, places = 9): number[] {
  const out: number[] = [];
  for (let k = Math.ceil((min - anchor - 1e-9) / every); k <= Math.floor((max - anchor + 1e-9) / every); k++)
    out.push(Number((anchor + k * every).toFixed(places)));
  return out;
}

/**
 * An axis number as a decimal (0.25, not 1/4), rounded to `places`, with true minus signs: −3.
 * The Graph tool prints 6 places; the value graph keeps the 8 its values are rounded to.
 */
export function axisNumberText(value: number, places = 6): string {
  return String(Number(value.toFixed(places))).replaceAll("-", "−");
}

/**
 * True when two neighbouring axis numbers, centred at `at` with printed width `width`, come
 * closer than `clearance`. `distance` turns two positions into the printed gap between them, in
 * the units of width and clearance.
 */
export function axisNumbersTouch(
  numbers: readonly { at: number; width: number }[],
  clearance: number,
  distance: (from: number, to: number) => number = (from, to) => to - from,
): boolean {
  return numbers.some((a, i) => {
    const b = numbers[i + 1];
    return b !== undefined && distance(a.at, b.at) < (a.width + b.width) / 2 + clearance;
  });
}
