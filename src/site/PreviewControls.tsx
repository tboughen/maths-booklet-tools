import { Minus, Plus } from "lucide-react";

/** The zoom steps offered in every editor; 1 shows the resource at its print size. */
const ZOOM_LEVELS = [0.5, 0.6, 0.75, 0.8, 1, 1.25, 1.5, 2, 3, 4];
const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * The zoom controls at the start of every editor's foot strip. Zoom changes the view only: it is
 * never saved with a resource and never changes the print size.
 *
 * `zoom` is 0 for "fit the diagram to its space", else one of the steps. `scale` is the size the
 * diagram is drawn at now (0 while a page has yet to measure it), so Fit can say its percentage
 * and the steps start from it.
 */
export function PreviewControls({
  zoom,
  onZoom,
  scale,
}: {
  zoom: number;
  onZoom: (value: number) => void;
  scale: number;
}) {
  const now = zoom || scale;
  const smaller = [...ZOOM_LEVELS].reverse().find((level) => level < now - 0.004);
  const larger = now > 0 ? ZOOM_LEVELS.find((level) => level > now + 0.004) : undefined;
  return (
    <>
      <span className="preview-zoom" role="group" aria-label="Zoom">
        <button
          type="button"
          className="preview-zoom-step"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={smaller === undefined}
          onClick={() => smaller !== undefined && onZoom(smaller)}
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <select
          aria-label="Preview zoom"
          title="Zoom changes the view only, never the print size"
          value={zoom}
          onChange={(event) => onZoom(Number(event.target.value))}
        >
          <option value={0}>Fit{zoom === 0 && scale > 0 ? ` · ${percent(scale)}` : ""}</option>
          {ZOOM_LEVELS.map((value) => (
            <option key={value} value={value}>
              {percent(value)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="preview-zoom-step"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={larger === undefined}
          onClick={() => larger !== undefined && onZoom(larger)}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </span>
      <button
        type="button"
        className="preview-detail"
        aria-pressed={zoom === 1}
        title="Show the diagram at its print size (100%)"
        onClick={() => onZoom(zoom === 1 ? 0 : 1)}
      >
        Actual size
      </button>
    </>
  );
}
