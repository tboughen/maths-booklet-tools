// Kept apart from the renderer so the bank page can place cuts without loading it.

/** Room added inside a cut: the cut is split at `at` (cut points) and `size` points are inserted. */
export interface Band { at: number; size: number }

/** The cut drawn in slices with the added room between them: cut top, cut bottom, where it goes. */
export function slices(overlay: { height: number; bands: Band[] }): { from: number; to: number; y: number }[] {
  const out: { from: number; to: number; y: number }[] = [];
  let from = 0, y = 0;
  for (const b of overlay.bands) {
    out.push({ from, to: b.at, y });
    y += b.at - from + b.size;
    from = b.at;
  }
  out.push({ from, to: overlay.height, y });
  return out;
}
