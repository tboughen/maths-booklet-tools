/** Half the 44 px touch target (U43). */
export const TAP_REACH = 22;
/**
 * The tick whose screen x is nearest a tap, or null when none is within 22 px. A tap exactly midway between
 * two ticks picks the one that comes first in `ticks` (the lower value).
 */
export function nearestTick(ticks: { v: string; x: number }[], x: number): string | null {
  let best: { v: string; gap: number } | null = null;
  for (const t of ticks) {
    const gap = Math.abs(t.x - x);
    if (gap <= TAP_REACH && (!best || gap < best.gap)) best = { v: t.v, gap };
  }
  return best?.v ?? null;
}
