import type { RatioEnvelope } from "../../packages/ratio-table-core/src/interchange";

// What a screen reader hears for a ratio table on screen. Unlike describeRatio (the MCP and saved
// description, which names rows by id so that tools can address them), this numbers rows from 1,
// says "blank" for an empty cell and names arrows in words instead of reading out arrow glyphs.
export function speakRatio(envelope: RatioEnvelope): string {
  const d = envelope.document;
  const heading = (h: (typeof d.headings)[number]) =>
    `${h.text || "blank heading"}${h.direction === "up" ? " (arrow up)" : h.direction === "none" ? "" : " (arrow right)"}`;
  const cell = (c: (typeof d.rows)[number]["cells"][number]) =>
    c.kind === "number" ? c.value : c.kind === "empty" ? "blank" : "answer line";
  const rows = d.rows.map((row, i) => `Row ${i + 1}: ${row.cells.map(cell).join(", ")}`).join(". ");
  const notes = d.mode === "simple" ? "Scaling annotations hidden." : `Scaling arrows ${d.showArrows ? "shown" : "hidden"}; operation labels ${d.showOperations ? "shown" : "hidden"}.`;
  return `Ratio table with headings ${d.headings.map(heading).join(" and ")}. ${rows}. ${notes}`;
}
