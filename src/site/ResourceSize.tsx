import { Ruler } from "lucide-react";
import { formatResourceSize } from "./resourceSizeFormat";

/** The true size the resource prints and copies at, in the foot strip of every editor. */
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
      <Ruler size={15} aria-hidden="true" />
      {pending ? (
        <span>Measuring the print size…</span>
      ) : error || width === undefined || height === undefined ? (
        <span>Print size unavailable: review the resource</span>
      ) : (
        <span>
          Prints at <b>{formatResourceSize(width, height)}</b>
          <span className="resource-size-note">, whatever the zoom</span>
        </span>
      )}
    </span>
  );
}
