export function PreviewControls({
  zoom,
  onZoom,
}: {
  zoom: number;
  onZoom: (value: number) => void;
}) {
  return (
    <>
      <label className="preview-zoom">
        Preview zoom{" "}
        <select
          aria-label="Preview zoom"
          value={zoom}
          onChange={(event) => onZoom(Number(event.target.value))}
        >
          <option value={0}>Fit whole resource</option>
          {[0.5, 0.6, 0.75, 0.8, 1, 1.25, 1.5, 2, 3, 4].map((value) => (
            <option key={value} value={value}>
              {Math.round(value * 100)}%
            </option>
          ))}
        </select>
      </label>
      {zoom === 0 && (
        <button className="preview-detail" onClick={() => onZoom(1)}>
          View at 100%
        </button>
      )}
      <button
        className="editor-inspector-link"
        onClick={(event) => {
          const inspector = event.currentTarget
            .closest(".workspace")
            ?.querySelector<HTMLElement>(".inspector-stack");
          if (inspector) {
            inspector.tabIndex = -1;
            inspector.focus();
            inspector.scrollIntoView({ block: "start", behavior: "auto" });
          }
        }}
      >
        Edit settings ↓
      </button>
    </>
  );
}
