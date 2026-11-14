import { artworkSizeMm } from "../../packages/envelope-core/src/worked";

/**
 * A copy's export metrics. Worked notes in the margin (U116) grow the answers copy's page round the
 * artwork, so its rasters and stated print size follow that page, read from the SVG itself; any
 * other copy keeps the family's own metrics.
 */
export function copyMetrics<M extends { width: number; height: number; widthCm: number; heightCm: number }>(svg: string, m: M): M {
  if (!svg.includes('data-layer="worked"')) return m;
  const s = artworkSizeMm(svg),
    w = Math.round(s.width * 100) / 1000,
    h = Math.round(s.height * 100) / 1000;
  if (!(w > 0 && h > 0) || (Math.abs(w - m.widthCm) <= 0.001 && Math.abs(h - m.heightCm) <= 0.001)) return m;
  return { ...m, width: (m.width * w) / m.widthCm, height: (m.height * h) / m.heightCm, widthCm: w, heightCm: h };
}
