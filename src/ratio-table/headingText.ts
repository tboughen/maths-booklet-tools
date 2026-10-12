import type { RatioDocument } from "../../packages/ratio-table-core/src/schema";

type Heading = RatioDocument["headings"][number];

// Expose legacy heading arrows as editable Unicode without rewriting saved
// tables or changing the print geometry of headings that have not been edited.
export function headingText(heading: Heading): string {
  return (
    heading.text +
    (heading.direction === "right"
      ? " →"
      : heading.direction === "up"
        ? " ↑"
        : "")
  );
}

export function headingFromText(heading: Heading, value: string): Heading {
  const direction = value.endsWith("→")
    ? "right"
    : value.endsWith("↑")
      ? "up"
      : "none";
  return {
    ...heading,
    text: (direction === "none" ? value : value.slice(0, -1)).trim(),
    direction,
  };
}
