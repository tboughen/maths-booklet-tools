/**
 * U58: axis numbering shared by the Graph tool and the value graph (table of values), so a
 * fix to which lines are numbered, how a number prints or when neighbouring numbers touch
 * reaches both renderers. Each renderer keeps its own drawing (fonts, boxes, grid tiers).
 */

/**
 * The values anchor + k × every that lie in [min, max], smallest first. A tiny tolerance keeps
 * an end value that floating point lands just outside the range.
 */
export function axisTickValues(min: number, max: number, every: number, anchor = 0): number[] {
  const out: number[] = [];
  for (let k = Math.ceil((min - anchor - 1e-9) / every); k <= Math.floor((max - anchor + 1e-9) / every); k++)
    out.push(Number((anchor + k * every).toFixed(9)));
  return out;
}

/** An axis number as a decimal (0.25, not 1/4) with a true minus sign: −3. */
export function axisNumberText(value: number): string {
  const text = String(Number(value.toFixed(6)));
  return text.startsWith("-") ? `−${text.slice(1)}` : text;
}

/**
 * True when two neighbouring axis numbers, centred at `at` with printed width `width` (any one
 * unit), come closer than `clearance`.
 */
export function axisNumbersTouch(numbers: readonly { at: number; width: number }[], clearance: number): boolean {
  return numbers.some((a, i) => {
    const b = numbers[i + 1];
    return b !== undefined && Math.abs(b.at - a.at) < (a.width + b.width) / 2 + clearance;
  });
}
