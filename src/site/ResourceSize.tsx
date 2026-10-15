import { formatResourceSize } from "./resourceSizeFormat";
export function ResourceSize({
  width,
  height,
  pending = false,
  error = false,
}: {
  width?: number;
  height?: number;
  pending?: boolean;
  error?: boolean;
}) {
  return (
    <span className="resource-size">
      Actual export size:{" "}
      {pending
        ? "Measuring…"
        : error || width === undefined || height === undefined
          ? "Unavailable — review the resource"
          : formatResourceSize(width, height)}
    </span>
  );
}
