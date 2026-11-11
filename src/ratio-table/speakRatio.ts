import type { RatioCell, RatioDocument, RatioEnvelope } from "../../packages/ratio-table-core/src/schema";

// Screen-reader text for the ratio table on screen. describeRatio stays as it is for MCP and saved
// output; this one numbers rows from 1, says "blank" and "answer line", names arrows in words,
// reads fractions as "over" and speaks the scaling operations only when they are printed.
// Every switch is exhaustive, so a new cell kind or direction fails the type check instead of
// being read as another state.

const never = (value: never): never => {
  throw new Error(`Unhandled ratio-table state: ${JSON.stringify(value)}`);
};

const speakNumber = (value: string) => value.replace(/\//g, " over ");

function speakCell(cell: RatioCell, view: "pupil" | "answer"): string {
  switch (cell.kind) {
    case "number": return speakNumber(cell.value);
    case "empty": return "blank";
    case "answer-line": return "answer line";
    case "hidden":
      // The pupil copy is read as pupils see it, without the answer.
      return view === "answer"
        ? `hidden answer ${speakNumber(cell.value)}`
        : `${cell.line ? "answer line" : "blank"}, answer hidden`;
    default: return never(cell);
  }
}

function speakHeading(heading: RatioDocument["headings"][number]): string {
  switch (heading.direction) {
    case "right": return `${heading.text} (arrow right)`;
    case "up": return `${heading.text} (arrow up)`;
    case "down": return `${heading.text} (arrow down)`;
    case "none": return heading.text;
    default: return never(heading.direction);
  }
}

export function speakRatio(envelope: RatioEnvelope, view: "pupil" | "answer" = "pupil"): string {
  const d = envelope.document;
  const rows = d.rows.map((row, i) => `Row ${i + 1}: ${row.cells.map((cell) => speakCell(cell, view)).join(", ")}`).join(". ");
  const rowNumber = (id: string) => d.rows.findIndex((row) => row.id === id) + 1;
  const operations = d.mode === "annotated" && d.showOperations
    ? d.transitions.map((t) => t.hidden && view === "pupil"
        ? ` Row ${rowNumber(t.from)} to row ${rowNumber(t.to)}: operation hidden.`
        : ` Row ${rowNumber(t.from)} to row ${rowNumber(t.to)}: ${t.operation === "multiply" ? "multiply" : "divide"} by ${speakNumber(t.factor)}.`).join("")
    : "";
  const notes = d.mode === "simple"
    ? "Scaling annotations hidden."
    : `Scaling arrows ${d.showArrows ? "shown" : "hidden"}; operation labels ${d.showOperations ? "shown" : "hidden"}.`;
  return `Ratio table with headings ${d.headings.map(speakHeading).join(" and ")}. ${rows}. ${notes}${operations}`;
}
